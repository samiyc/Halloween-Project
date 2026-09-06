# Tests et qualité

## Les tests

### Pourquoi `node --test`

Node 20 embarque un lanceur de tests. Aucune dépendance, aucun bundler, aucune
configuration — cohérent avec un projet qui n'a pas d'étape de build. Vitest
aurait apporté une meilleure ergonomie au prix d'environ 90 paquets et d'un
outil de build dans un projet qui n'en a pas.

```bash
npm test                                        # tout
npm run test:watch                              # en continu
npm run test:coverage                           # avec couverture
node --test tests/game.test.js                  # un fichier
node --test --test-name-pattern="mêlée"         # un test par son nom
```

### Ce qui est couvert

**312 tests, 100 % des lignes** de tous les modules de logique.

| Fichier | Ce qu'il vérifie |
| --- | --- |
| `glyphs.test.js` | Le registre : unicité, aller-retour id ↔ symbole, et la règle UTF-16 |
| `recognizer.test.js` | Les six gestes, les priorités entre eux, le tremblement, la spirale fermée |
| `entities.test.js` | Séquences, machine à états du boss, déplacement et cooldown du joueur |
| `combat.test.js` | Portée de la mêlée, ciblage du plus proche, invincibilité du boss |
| `game.test.js` | Parties complètes : victoire, défaite, score, spawn, déterminisme |
| `threat.test.js` | Les repères du bas : qui est suivi, les seuils, un repère par menace |

Ce qui n'est pas testé : `render/` — hors ses tables pures, `layout.js` et les
couleurs de `palette.js` —, `engine/keyboard.js`, `engine/pointer.js`,
`engine/loop.js` et `main.js`. Ce sont les couches qui touchent le DOM ; les
tester demanderait jsdom pour peu de valeur. Elles sont volontairement minces —
tout ce qui décide de quelque chose vit ailleurs.

### Ce qui rend les tests possibles

**L'aléatoire injecté.** `createSeededRandom(42)` rejoue exactement la même
partie. Sans cela, aucune assertion sur le spawn ou les séquences ne serait
stable.

**Le temps passé en argument.** `Game.update(deltaMs)` accepte n'importe quel
delta, donc un test déroule 600 frames en une boucle `for` sans horloge.

**L'absence de canvas.** `new Game()` fonctionne sous Node tel quel.

### Écrire un test

Les fixtures de tracés sont dans `tests/helpers/strokes.js` : elles produisent
le même tableau de points que la souris, donc un test de reconnaissance suit
exactement le chemin d'un vrai geste.

Convention utile : quand un test protège un bug précis, le commentaire dit
**quel** bug. Par exemple, dans `game.test.js` :

```js
it("settles the loss once per frame, not once per escaping enemy", () => {
  // L'ancien code testait la défaite dans la boucle de dessin, donc deux
  // ennemis franchissant le bord sur la même frame déclenchaient chacun un
  // écran de fin complet.
```

Un test dont on ne sait plus ce qu'il protège finit par être supprimé au premier
refactor gênant.

## Le lint

### L'équivalent de SonarLint

`eslint-plugin-sonarjs` **est** le moteur de règles de SonarLint. Les
signalements du terminal correspondent donc à ceux de l'IDE.

```bash
npm run lint         # signale
npm run lint:fix     # corrige ce qui est automatisable
npm run check        # lint puis tests — avant de committer
```

> Versions figées à ESLint 9 et non 10 : ESLint 10 exige Node ≥ 20.19, et ce
> poste tourne en 20.10. Le passage à ESLint 10 devra suivre une mise à jour de
> Node.

### Le budget de complexité

C'est la partie qui répond directement au besoin de limiter la longueur et la
complexité des méthodes. Défini une fois dans `eslint.config.js` :

| Règle | Limite | Ce qu'elle empêche |
| --- | --- | --- |
| `complexity` | 8 | Les cascades de branches |
| `sonarjs/cognitive-complexity` | 10 | L'imbrication difficile à suivre |
| `max-lines-per-function` | 40 | Les fonctions fourre-tout |
| `max-lines` | 220 | Le retour d'un `game.js` de 228 lignes |
| `max-depth` | 3 | Les `if` empilés |
| `max-params` | 4 | Les signatures illisibles |
| `max-statements` | 20 | Les fonctions qui font trop |
| `max-nested-callbacks` | 2 | Les pyramides de callbacks |

Les tests assouplissent la longueur (un `describe` est long par nature) mais
gardent les règles de complexité.

Ce budget est ce qui a imposé la découpe : `game.js` faisait 228 lignes et
portait douze responsabilités ; aucun module ne peut plus y revenir sans que
`npm run lint` échoue.

### Ce que le lint a trouvé sur l'ancien code

Avant même le refactor, en passant les trois fichiers d'origine dans cette
configuration :

| Signalement | Réalité |
| --- | --- |
| `'drawPath' is not defined` | **Une `ReferenceError` à chaque mouvement de souris** — le tracé n'était jamais visible |
| `'maxEnemiesDefeated' is not defined` | Dans `checkWinCondition()`, une fonction jamais appelée |
| `'enemySize' assigned but never used` | Code mort |
| `spawnEnemy` : 2 arguments pour 0 attendu | Appel incohérent |
| `decrementSequence` complexité 9 (×2) | La table geste → symbole dupliquée |

Le premier était un vrai bug visible en jeu, présent dans `main`, et personne ne
l'avait vu. C'est le meilleur argument pour garder cette configuration.

### Sur `sonarjs/pseudo-random`

SonarJS signale chaque `Math.random()` (règle de sécurité). Dans un jeu, ce
n'est pas pertinent. Plutôt que de désactiver la règle globalement — ce qui la
neutraliserait aussi le jour où elle aurait raison — l'appel est isolé dans
`tools/random.js` avec une exception locale et justifiée :

```js
// eslint-disable-next-line sonarjs/pseudo-random -- gameplay variety, never security-sensitive
```

## Avant de committer

```bash
npm run check
```

Il n'y a pas de hook Git installé : c'est volontaire, mais rien n'empêche d'en
ajouter un si le besoin s'en fait sentir.
