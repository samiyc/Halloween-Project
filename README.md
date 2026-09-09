# Spell Blaster 3000

Jeu navigateur : la magie contre les machines. Des robots tombent du haut d'un
canvas HTML5 ; on les détruit en traçant à la souris le geste correspondant au
**premier symbole** de la séquence affichée au-dessus d'eux. Un personnage vert
— magicien ou magicienne —, déplacé au clavier, ajoute une attaque de mêlée
automatique à courte portée.

L'univers est décrit dans [docs/lore.md](docs/lore.md) ; le fichier d'entrée
s'appelle encore `halloween.html`, du nom du thème d'origine.

JavaScript vanilla, modules ES, **aucune étape de build**.

---

## Lancer le jeu

Les modules ES sont chargés en CORS : ouvrir `halloween.html` en `file://`
échoue silencieusement sur un canvas vide. Il faut servir en HTTP.

**Avec « Go Live » (VS Code / Live Server)** — le flux habituel :
clic droit sur `halloween.html` → *Open with Live Server*, puis
<http://127.0.0.1:5500/halloween.html>.

**Sans VS Code** :

```bash
npm run serve      # puis http://localhost:3000/halloween.html
```

> Note : `npx serve` réécrit les URL (« clean URLs ») et **supprime la query
> string**, donc `?debug` y est perdu. Live Server et `npx http-server` la
> conservent.

## Commandes

| Commande | Effet |
| --- | --- |
| `npm test` | Toute la suite de tests (`node --test`, natif, zéro dépendance) |
| `npm run test:watch` | Relance à chaque sauvegarde |
| `npm run test:coverage` | Suite + rapport de couverture |
| `node --test tests/game.test.js` | **Un seul fichier** de test |
| `node --test --test-name-pattern="mêlée"` | **Un seul test**, par nom |
| `npm run lint` | ESLint + SonarJS + budget de complexité |
| `npm run lint:fix` | Corrige ce qui est corrigible automatiquement |
| `npm run check` | `lint` puis `test` — à lancer avant de committer |

`npm install` n'est nécessaire que pour le lint (le jeu et les tests n'ont
aucune dépendance runtime).

## Commandes du jeu

| Entrée | Effet |
| --- | --- |
| **Échap** | Ouvre le menu (la partie se met en pause) et y revient |
| Souris (glisser) | Lance un geste. **Aucune limite de portée** : touche tout l'écran |
| `Z` `Q` `S` `D` | Déplace le personnage vert (fonctionne aussi en `W` `A` `S` `D` sur QWERTY, et aux flèches) |
| — | La mêlée se déclenche **seule** toutes les 1,5 s sur **tous** les ennemis du cercle |
| `E` ou **clic droit** | Lance le sort en réserve, affiché en haut à gauche |
| Clic gauche | Recommence la partie une fois l'écran de fin affiché |
| Bouton « Pause / Menu » | En haut du bandeau droit : même effet qu'Échap |

Le jeu s'ouvre sur un menu en deux colonnes.

- **Entraînement**, à gauche : Facile, Normal, Difficile. Les modes n'ajustent
  aucun chiffre, ils activent les mécaniques une par une — Facile n'a ni mana ni
  sorts ni ennemis rares, Normal est le jeu complet, Difficile y ajoute une
  barre de vie. Détail dans [docs/difficulty.md](docs/difficulty.md).
- **Histoire**, au centre : des épisodes nommés qui se débloquent l'un après
  l'autre, sauvegardés dans le navigateur, avec un paragraphe d'histoire à la
  victoire et un petit bouton info pour le relire. Le boss y arrive après une
  trentaine de secondes. Détail dans [docs/story-mode.md](docs/story-mode.md).

Les gestes coûtent de la **mana** : 8 points, 24 pour l'éclair et la spirale. On
la ramasse en **billes bleues** avec le personnage ; la jauge monte à 150 et
**démarre vide**. Un
geste reconnu est facturé **même s'il ne touche rien**, ce qui récompense la
précision. La mêlée, elle, reste gratuite. Une **orbe jaune** tombe toutes les
15-20 s et offre un sort tiré au hasard parmi quatre. Quand le sort en réserve
couvre une zone — le Givre — son rayon s'affiche en pointillés autour du
personnage, pour voir qui sera touché avant de le dépenser. Chaque sort a sa
propre couleur — orange, cyan, magenta, vert — reprise par la bordure et le nom
dans l'emplacement, pour l'identifier sans le lire.

Six gestes existent : trait horizontal `_`, trait vertical `|`, chevron bas `V`,
chevron haut `Ʌ`, éclair `↯` et spirale `@`. Les deux derniers n'apparaissent
que sur les ennemis rares (violets).

## L'écran

Le canvas fait 1900×1200 : une **zone jouable de 1300×1200 au centre**, encadrée
par deux **bandeaux de 300 px** qui portent tout le HUD. Rien ne se dessine plus
par-dessus le jeu.

```
┌────────────┬──────────────────────┬────────────┐
│ Sort       │                      │ Gestes     │
│ Robots     │     zone jouable     │            │
│ Mêlée      │      1300×1200       │ Mission    │
│       Mana │                      │       Vie  │
└────────────┴──────────────────────┴────────────┘
     300              1300               300
```

Le canvas est affiché **en 1:1** dès que l'écran fait au moins 1224 px de haut :
1 px de code = 1 px à l'écran, du gris reste autour. Sur un écran plus petit il
rétrécit au lieu de déborder.

La logique de jeu travaille en coordonnées terrain et ignore les bandeaux : le
renderer translate, le pointeur retranche l'offset.

## Documentation

| Fichier | Contenu |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Carte des modules, règles de dépendance, comment ajouter une entité |
| [docs/lore.md](docs/lore.md) | **L'univers** : la magie contre les machines, les artefacts, l'arc narratif |
| [docs/story-mode.md](docs/story-mode.md) | **Le mode histoire** : épisodes, phases, déblocage, sauvegarde, menu |
| [docs/content-proposals.md](docs/content-proposals.md) | Propositions pour la suite : symboles, bonus, boss, environnements |
| [docs/boss-patterns.md](docs/boss-patterns.md) | La tourelle du boss, ses quatre attaques et ses phases |
| [docs/gestures.md](docs/gestures.md) | Reconnaissance des gestes, seuils, **comment ajouter un geste** |
| [docs/difficulty.md](docs/difficulty.md) | **Les trois modes**, le menu, la pause |
| [docs/gameplay.md](docs/gameplay.md) | Règles, cycle du boss, tous les paramètres réglables |
| [docs/quality.md](docs/quality.md) | Tests et lint : conventions et budget de complexité |
| [docs/mana-and-spells.md](docs/mana-and-spells.md) | Économie de mana, billes bleues, sorts aléatoires, **et les mesures d'équilibrage** |
| [docs/rewards.md](docs/rewards.md) | Catalogue de récompenses et prise de risque (deux hypothèses abandonnées, voir bandeau) |
| [docs/spell-proposals.md](docs/spell-proposals.md) | Propositions de sorts (modèle de distribution non retenu, principes toujours valables) |

## Structure

```
halloween.html          point d'entrée (un seul <script>)
styles/                 CSS
src/
  main.js               câblage DOM ↔ jeu (le seul module qui connaît les deux)
  config/               glyphes, réglages, niveaux — la vérité unique
  engine/               boucle, entrées, gestes, accès au localStorage
  entities/             Entity, Enemy, Boss, Player — état et comportement
  game/                 orchestration, combat, spawn, progression
  render/               tout ce qui touche au contexte 2D
  tools/                générateur aléatoire injectable
tests/                  node:test
docs/
```

## Debug

Ouvrir `halloween.html?debug` expose la partie en cours dans la console :

```js
__magicSpell.game.enemies      // robots à l'écran
__magicSpell.game.boss.phase   // "waiting", "descending" ou "retreating"
__magicSpell.game.player       // position, cooldown de mêlée
__magicSpell.session.progress  // niveaux débloqués et terminés
```

Sans `?debug`, la page n'expose rien.

Pour repartir d'une campagne vierge :

```js
localStorage.removeItem("spellblaster.progress");   // puis recharger
```

Et pour ouvrir toute la campagne sans la rejouer, deux interrupteurs dans
`src/config/dev.js` :

| Flag | Effet |
| --- | --- |
| `unlockAllLevels` | Tous les épisodes jouables, quelle que soit la sauvegarde |
| `revealAllStories` | Les textes de fin lisibles dans le menu sans avoir gagné |

Ils ne touchent jamais à la progression enregistrée, et le sous-titre du menu
affiche « mode dev » tant que l'un des deux est actif. À remettre à `false`
avant de committer.
