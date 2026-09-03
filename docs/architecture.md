# Architecture

## Le principe directeur

**La logique de jeu ne connaît ni le canvas, ni le DOM, ni l'horloge.**

C'est la seule règle qui compte, et tout le reste en découle. Avant, chaque
entité recevait `canvas` et `ctx` dans son constructeur et se dessinait
elle-même : impossible de tester quoi que ce soit sans navigateur, et
impossible de savoir si une règle du jeu était juste autrement qu'en jouant.

Aujourd'hui `src/entities/`, `src/game/`, `src/engine/gesture/` et
`src/config/` tournent sous Node sans aucune émulation de DOM. Une partie
entière se déroule dans un test unitaire.

## Carte des modules

```
                        halloween.html
                              │
                        src/main.js ──────────── le seul module qui connaît
                       ╱      │      ╲            le DOM ET le jeu
                      ╱       │       ╲
              engine/      game/      render/
                 │            │            │
                 │        entities/        │  ← ctx 2D, uniquement ici
                 │            │            │
                 └────── config/ ──────────┘
                          tools/
```

| Dossier | Rôle | Connaît le DOM ? |
| --- | --- | --- |
| `config/` | Glyphes et réglages. Aucune logique. | non |
| `tools/` | Générateur aléatoire injectable. | non |
| `entities/` | `Entity`, `Enemy`, `Boss`, `Player` : état + comportement. | non |
| `game/` | `Game` (orchestration), `combat`, `spawner`. | non |
| `engine/gesture/` | Géométrie pure et reconnaissance. | non |
| `engine/` (racine) | `GameLoop`, `Keyboard`, `PointerTracker`. | oui — événements |
| `render/` | `Renderer`, `Hud`, `palette`. | oui — contexte 2D |
| `main.js` | Câblage. | oui |

Les dépendances ne vont que vers le bas. `entities/` n'importe jamais
`render/`; `game/` n'importe jamais `engine/keyboard.js`.

## Le flux d'une frame

```
GameLoop (rAF)
  └─ deltaMs ─► App.frame()
                  ├─ Game.update(deltaMs, Keyboard.moveDirection())
                  │     ├─ Player.update()      déplacement + cooldown
                  │     ├─ advanceBoard()       boss + ennemis, puis purge
                  │     ├─ runMelee()           combat.resolveMelee()
                  │     ├─ Spawner.tick()
                  │     └─ settleEndConditions()  victoire / défaite, une fois
                  └─ App.render()
                        ├─ Renderer  entités, joueur, tracé en cours
                        └─ Hud       score, cooldown, légende, écran de fin
```

Et en parallèle, hors boucle :

```
PointerTracker  mouseup ─► recognizeStroke(path) ─► Game.castGesture(glyphId)
```

## Décisions structurantes

### `deltaMs` partout, jamais « par frame »

L'ancien code faisait `this.y += this.speed` une fois par frame d'animation. Sur
l'écran de test, mesuré à **163 Hz**, le jeu tournait donc 2,7× trop vite ; sur
un écran 60 Hz, à la vitesse prévue. La vitesse dépendait du matériel.

Tout passe maintenant par `toFrames(deltaMs)` (`config/settings.js`), qui
convertit un delta en « frames à 60 Hz ». À 60 Hz le résultat vaut exactement 1,
donc le réglage d'origine est préservé, et toutes les autres fréquences
s'alignent dessus.

Corollaire : **tout ce qui consomme un delta doit passer par `clampDelta()` ou
`toFrames()`**. Un onglet en arrière-plan ou un point d'arrêt produit un delta
de plusieurs secondes ; consommé brut, il téléporte les entités ou recharge
instantanément un cooldown.

### L'aléatoire est injecté, jamais appelé directement

`Math.random()` n'apparaît qu'une fois dans tout le projet, dans
`tools/random.js`. Tout le reste reçoit un objet `Rng`.

C'est ce qui rend `Game` déterministe : `createSeededRandom(42)` rejoue
exactement la même partie, donc le spawn, les séquences et les vitesses sont
testables. C'est aussi ce qui évite d'avoir la règle SonarJS `pseudo-random`
signalée à chaque appel.

### Le découplage ennemi ↔ boss

`Enemy.update()` prenait le boss en argument et lisait `boss.lives` pour décider
de son sens de déplacement. Toute suppression du boss faisait planter la boucle,
et personne ne pouvait tester un ennemi sans fabriquer un boss.

La signature est devenue `update(deltaMs, { reversed })`. C'est `Game` qui
calcule `reversed` une fois par frame. L'ennemi ne sait plus qu'un boss existe.

> À noter : la marche arrière n'est visible que pendant la **retraite finale** du
> boss. Dès que `lives` tombe à 0 *et* que la retraite s'achève, la partie est
> gagnée.

### Un seul point d'entrée HTML

`halloween.html` ne charge que `src/main.js`. Le graphe de modules fait le
reste. Avant, trois `<script type="module">` chargeaient `enemy.js`, `boss.js`
et `game.js` — les deux premiers étant déjà importés par le troisième, ils
étaient donc évalués pour rien.

## Ajouter une entité

1. Créer la classe dans `src/entities/`, en étendant `Entity` si elle porte une
   séquence de glyphes. Elle hérite alors de `matches()`,
   `decrementSequence()`, `stripSymbol()` et `isDefeated()` — **ne pas
   réimplémenter la correspondance geste → symbole**, c'était précisément le
   défaut d'origine.
2. Mettre ses constantes dans `config/settings.js`, pas en dur.
3. Lui faire prendre `rng` en paramètre si elle utilise de l'aléatoire.
4. Ajouter son rendu dans `render/renderer.js`. L'entité ne dessine pas.
5. La brancher dans `game/game.js`.
6. Tester : la classe est utilisable directement sous Node.

## Ce qui n'existe plus

Le code mort signalé dans l'ancienne version a été supprimé, pas déplacé :

- `checkWinCondition()` — jamais appelée, référençait une variable inexistante.
- `enemySize` — inutilisé, `Enemy` porte sa propre taille.
- `drawPath()` — **appelée à chaque `mousemove` sans jamais avoir été définie**,
  donc une `ReferenceError` par mouvement de souris. C'est pour cela qu'aucun
  tracé n'apparaissait à l'écran. Le rendu du geste vit maintenant dans
  `Renderer.drawStroke()`.
- `location.reload()` au redémarrage — remplacé par `Game.reset()`, ce qui rend
  l'état réinitialisable et testable.
