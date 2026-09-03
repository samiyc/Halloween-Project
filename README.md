# Magic Spell Game

Jeu navigateur : des formes tombent du haut d'un canvas HTML5. On les détruit en
traçant à la souris le geste correspondant au **premier symbole** de la séquence
affichée au-dessus d'elles. Un personnage vert, déplacé au clavier, ajoute une
attaque de mêlée automatique à courte portée.

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
| Souris (glisser) | Lance un geste. **Aucune limite de portée** : touche tout l'écran |
| `Z` `Q` `S` `D` | Déplace le personnage vert (fonctionne aussi en `W` `A` `S` `D` sur QWERTY, et aux flèches) |
| — | La mêlée se déclenche **seule** toutes les 1,5 s sur la cible la plus proche dans le cercle |
| Clic | Recommence la partie une fois l'écran de fin affiché |

Six gestes existent : trait horizontal `_`, trait vertical `|`, chevron bas `V`,
chevron haut `Ʌ`, éclair `⚡` et spirale `@`. Les deux derniers n'apparaissent
que sur les ennemis rares (violets).

## Documentation

| Fichier | Contenu |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Carte des modules, règles de dépendance, comment ajouter une entité |
| [docs/gestures.md](docs/gestures.md) | Reconnaissance des gestes, seuils, **comment ajouter un geste** |
| [docs/gameplay.md](docs/gameplay.md) | Règles, cycle du boss, tous les paramètres réglables |
| [docs/quality.md](docs/quality.md) | Tests et lint : conventions et budget de complexité |
| [docs/rewards.md](docs/rewards.md) | **Direction retenue** : récompenses à ramasser, prise de risque |
| [docs/spell-proposals.md](docs/spell-proposals.md) | Propositions de sorts (partiellement dépassé, principes toujours valables) |

## Structure

```
halloween.html          point d'entrée (un seul <script>)
styles/                 CSS
src/
  main.js               câblage DOM ↔ jeu (le seul module qui connaît les deux)
  config/               glyphes et réglages — la vérité unique
  engine/               boucle, entrées, reconnaissance de gestes
  entities/             Entity, Enemy, Boss, Player — état et comportement
  game/                 orchestration, combat, spawn
  render/               tout ce qui touche au contexte 2D
  tools/                générateur aléatoire injectable
tests/                  node:test
docs/
```

## Debug

Ouvrir `halloween.html?debug` expose la partie en cours dans la console :

```js
__magicSpell.game.enemies      // ennemis à l'écran
__magicSpell.game.boss.phase   // "descending" ou "retreating"
__magicSpell.game.player       // position, cooldown de mêlée
```

Sans `?debug`, la page n'expose rien.
