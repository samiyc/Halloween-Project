# Difficulté, menu et pause

## Les trois modes

Les modes ne changent **aucun chiffre** : ni la vitesse des ennemis, ni leur
fréquence d'apparition. Ils changent **quelles mécaniques existent**.

| Règle | Facile | Normal | Difficile |
| --- | --- | --- | --- |
| `mana` — gestes payants, billes bleues, jauge | non | **oui** | oui |
| `rareEnemies` — ennemis violets, glyphes `↯` `@` | non | **oui** | oui |
| `spells` — orbe jaune, emplacement, `E` / clic droit | non | **oui** | oui |
| `health` — barre de vie rouge | non | non | **oui** |

Tout est déclaré dans `src/config/difficulty.js`, en données pures. `Game` prend
une difficulté, en tire ses règles, et rien d'autre dans le code ne connaît le
nom des modes.

### Cumulatif, et vérifié comme tel

Chaque niveau est un **sur-ensemble** du précédent : on ne découvre jamais qu'un
seul système nouveau à la fois. C'est une propriété facile à énoncer et facile à
casser par mégarde en ajoutant une règle — un test la vérifie donc en parcourant
`DIFFICULTY_IDS` dans l'ordre.

### Ce que chaque règle coupe réellement

Peu de code sait qu'une difficulté existe, parce que les coutures étaient déjà
là :

- **`rareEnemies`** passe `rareShare: 0` au `Spawner`, qui l'acceptait déjà.
  Aucun ennemi rare ⇒ **aucune séquence ne contient d'éclair ni de spirale**.
  « Pas de gestes compliqués en Facile » n'est donc pas une seconde règle, c'est
  une conséquence : les symboles rares n'atteignent une séquence que par un
  ennemi rare.
- **`mana`** fait sauter le `spend()` dans `Game.castGesture()`, et coupe le
  flux de billes du `PickupSpawner`.
- **`spells`** coupe le flux d'orbes jaunes et verrouille `Game.castSpell()`.
- **`health`** crée la jauge rouge. Absente ailleurs, `game.health` vaut `null`.

Le HUD lit `game.rules` : ce qui n'existe pas dans le mode n'est pas dessiné.
En Facile il ne reste donc que le score, la mêlée et les quatre glyphes communs.

## Ce que Difficile ajoute vraiment

Le boss porte une **tourelle** qui vise le héros et lui tire dessus. La barre de
vie n'est donc plus un décor : elle descend, et à zéro la partie est perdue —
une troisième raison de défaite à côté de « un ennemi est passé » et « le boss
est passé ».

Voir [boss-patterns.md](boss-patterns.md) pour les deux patterns, leurs valeurs
et les propositions suivantes.

> Cette section remplace un avertissement « ⚠️ Difficile ≡ Normal, pour
> l'instant » : les patterns d'attaque restaient à concevoir et la barre était
> affichée pleine sans que rien ne l'entame. Le test qui gardait ce trou,
> « leaves the health bar untouched for now », a été remplacé par son inverse.

La tourelle est **branchée sur la règle `health`**, sans commutateur à elle. Un
`bossAttacks` ne pourrait jamais valoir autre chose : la barre n'existe que pour
la tourelle, et rien d'autre ne peut retirer des points de vie.

## Le menu

Quatre boutons centrés : les trois difficultés, plus **Retour au jeu**, grisé
tant qu'aucune partie n'est en cours.

```
Facile        →  nouvelle partie
Normal        →  nouvelle partie
Difficile     →  nouvelle partie
Retour au jeu →  reprend la partie gelée
```

**Un bouton de difficulté démarre toujours une nouvelle partie**, même celle
qu'on jouait déjà. Reprendre est le rôle exclusif du quatrième bouton — sinon
un clic distrait sur « Normal » effacerait la partie en cours sans le dire.

Une partie **perdue ou gagnée n'est plus reprenable** : le bouton redevient
grisé, il n'y a plus rien où revenir.

## La pause

`Échap` fait l'aller-retour entre le plateau et le menu, et le bouton
**« Pause / Menu »** en haut du bandeau droit fait la même chose à la souris.

La pause n'est pas un drapeau dans `Game` : c'est simplement `main.js` qui
**cesse d'appeler `game.update()`** tant que le menu est affiché. La partie est
gelée, pas détruite — vérifié en navigateur, position du joueur, ennemis et
score identiques après une seconde passée dans le menu.

### Le cooldown de 300 ms

Sans lui, une touche Échap maintenue basculerait d'écran à chaque frame.

Il a révélé un piège au passage : soustraire des deltas de frame **n'atteint
jamais exactement zéro**. Dix-huit soustractions de 1000/60 à partir de 300
laissent un résidu de 7,1 × 10⁻¹⁵, suffisant pour garder `> 0` vrai et avaler un
Échap de plus. `Session.tick()` ramène donc à zéro tout reste inférieur à la
milliseconde — en dessous, il n'y a plus de cooldown, quoi qu'en dise
l'arithmétique.

## Deux repères de coordonnées

Les boutons vivent en coordonnées **canvas**, les entités en coordonnées
**terrain**. `PointerTracker` expose donc deux conversions :

| Méthode | Corrige | Sert à |
| --- | --- | --- |
| `toCanvasPoint()` | l'échelle CSS | tester les clics sur les boutons |
| `toFieldPoint()` | l'échelle **puis** l'offset des bandeaux | enregistrer un tracé |

Les deux n'en faisaient qu'une tant que seuls les gestes lisaient la souris ; les
boutons du HUD ont rendu la confusion intenable.

Conséquence pratique : un clic sur le bouton pause ne doit pas aussi démarrer un
geste, puisque les deux écouteurs reçoivent le même `mousedown`. `isEnabled`
reçoit le point canvas et refuse la zone du bouton.

## Où c'est implémenté

| Fichier | Rôle |
| --- | --- |
| `src/config/difficulty.js` | Les règles, en données pures |
| `src/config/health.js` | La jauge de vie : mêmes valeurs que la mana |
| `src/game/session.js` | Menu / partie, pause, cooldown — pur, sans DOM |
| `src/game/gauge.js` | `Gauge`, partagée par la mana et la vie |
| `src/render/layout.js` | **Rectangles purs** des boutons, sans `ctx` |
| `src/render/menu.js` | L'écran de menu et le style de bouton |
| `src/render/gauges.js` | `drawVerticalGauge()` — mana **et** vie |
| `src/config/turret.js` | Les réglages de la tourelle et de ses deux patterns |
| `src/entities/turret.js` | La machine à états : vise, choisit, tire |
| `src/game/boss-attacks.js` | Projectiles et rayon contre le héros, en pur |

`layout.js` est le pivot : la même géométrie sert au dessin **et** au test de
clic, donc un bouton ne peut pas être dessiné là où il n'est pas cliquable. Et
comme il est pur, c'est la seule partie de l'interface qu'un test unitaire peut
réellement contrôler.
