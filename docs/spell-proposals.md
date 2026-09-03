# Propositions de sorts et de mécaniques

> **Statut : partiellement dépassé.** Ce document suppose que le personnage
> attaque au corps à corps. Cette orientation a été abandonnée à l'essai — elle
> laissait trop peu de décisions au joueur, dont le seul réflexe était de rester
> collé au boss. La direction retenue est dans
> [rewards.md](rewards.md) : le personnage devient un collecteur, et le contact
> avec un ennemi fait perdre.
>
> Ce qui reste valable ici : **les principes de conception** (§ « Les principes
> qui rendent une proposition bonne »), la section **« Ce que je déconseille »**,
> et les sorts qui ne dépendent pas de la mêlée — givre, onde de choc, vortex,
> dash et les quatre runes. Plusieurs sont d'ailleurs repris comme récompenses
> ramassables dans `rewards.md`, ce qui est probablement leur meilleure place :
> obtenus par une prise de risque plutôt que par une touche disponible en
> permanence.

Document de conception, pas de spécification : rien ici n'est implémenté. Les
touches `A` `E` `R` `F`, `Espace` et `1` `2` `3` `4` sont libres.

---

## Les principes qui rendent une proposition bonne

Avant les idées, les quatre règles qui ont servi à les trier. Elles découlent
de ce que le jeu est déjà.

### 1. Le clavier ne doit jamais retirer de symbole « gratuitement »

C'est la règle la plus importante. La souris est le cœur du jeu ; le jour où une
touche fait le même travail sans tracer, la souris devient décorative.

La mêlée automatique est la seule exception, et elle se paie cher : mono-cible,
55 px de portée, une fois toutes les 1,5 s. Elle achète le droit d'ignorer le
symbole en échange d'un déplacement physique.

Un bon sort au clavier fait donc l'une de ces trois choses — **gagner du temps**,
**réorganiser le plateau**, ou **amplifier le prochain geste** — mais pas
infliger des dégâts bruts.

### 2. Ce qui est intéressant, c'est que les têtes de séquence diffèrent

Un geste touche **toutes** les entités à la fois, mais seulement celles dont le
prochain symbole correspond. La difficulté réelle du jeu n'est donc pas de
tracer, c'est que huit ennemis attendent six symboles différents.

Tout sort qui agit sur *quels* symboles sont en tête est structurellement plus
intéressant qu'un sort qui agit sur les dégâts.

### 3. La portée est ce qui donne un sens au placement

Les gestes n'ont aucune limite de portée. Si les sorts n'en ont pas non plus, le
personnage n'a aucune raison de bouger et tout le pilier « positionnement »
s'effondre. **Chaque sort proposé ici a une portée**, et les plus forts ont la
plus courte.

### 4. Le cooldown est la seule ressource

Pas de mana, pas de barre à surveiller. Le HUD reste lisible et la main gauche
n'a qu'une chose à gérer : quand relancer. Ajouter une ressource coûterait de
l'interface pour un gain de profondeur discutable.

---

## A. Contrôle de zone — `A` `E` `R` `F`

### `A` — Onde de choc

| | |
| --- | --- |
| Effet | Repousse vers le haut de 90 px tous les ennemis dans un rayon de 180 px |
| Cooldown | 6 s |
| Dégâts | aucun |

La réponse au moment « cet ennemi touche le bas et je n'ai pas le temps de
tracer sa séquence ». Ne tue pas, achète du temps. Comme la défaite se joue sur
une ligne à défendre, un outil purement défensif a toute sa place.

*Variante* : repousser aussi le boss, mais deux fois moins loin.

### `E` — Givre

| | |
| --- | --- |
| Effet | Les ennemis dans un rayon de 200 px cessent de tomber pendant 2,5 s |
| Cooldown | 8 s |
| Dégâts | aucun |

Ouvre une fenêtre pour tracer une séquence longue tranquillement. S'accorde avec
une règle déjà présente — les ennemis à longue séquence sont déjà plus lents —
en la poussant à l'extrême ponctuellement.

C'est aussi le contre naturel de l'ennemi `⚡` proposé plus bas.

### `R` — Nova runique

| | |
| --- | --- |
| Effet | Retire le symbole de tête de **tous** les ennemis dans un rayon de 90 px |
| Cooldown | 12 s |
| Dégâts | 1 symbole, en zone |

La mêlée en version zone. Portée volontairement courte et cooldown long : il
faut plonger dans un groupe, ce qui est dangereux et demande un placement
délibéré. C'est le seul sort proposé qui retire des symboles, et c'est pour cela
qu'il est le plus contraint des quatre.

### `F` — Vortex

| | |
| --- | --- |
| Effet | Attire de 60 px vers le personnage les ennemis dans un rayon de 250 px |
| Cooldown | 10 s |
| Dégâts | aucun |

À double tranchant : rapprocher les ennemis les met en danger de franchir la
ligne plus vite, mais les regroupe. **`F` puis `R`** est le combo évident, et un
combo qu'on découvre soi-même vaut mieux qu'un sort qui fait les deux.

---

## B. Mobilité — `Espace`

### Proposition principale : Dash

| | |
| --- | --- |
| Effet | Bond instantané de 140 px dans la direction de déplacement courante |
| Cooldown | 2 s |

La portée de mêlée est petite (55 px) et les ennemis sont dispersés sur 1200 px :
sans mobilité, le personnage passe son temps à marcher. Un cooldown court en
fait un outil de confort plutôt qu'un sort.

*Question à trancher* : le dash traverse-t-il les ennemis ? Tant qu'il n'y a pas
de collision joueur–ennemi, la question ne se pose pas.

### Alternative : Ancrage

| | |
| --- | --- |
| Effet | Tant que `Espace` est maintenue et que le personnage ne bouge pas, le cooldown de mêlée est divisé par deux |
| Cooldown | aucun |

L'inverse du dash : récompense le fait de tenir une position au lieu d'en
changer. Plus intéressant thématiquement, moins agréable à jouer. À choisir en
fonction de ce que le personnage doit être — un duelliste mobile ou une tourelle
qu'on place.

---

## C. Runes — `1` `2` `3` `4`

Le groupe le plus prometteur, parce qu'il agit sur le **prochain geste** plutôt
que sur le plateau. Chaque rune s'arme, puis se consomme au geste suivant.

### `1` — Rune de charge

| | |
| --- | --- |
| Effet | Le prochain geste réussi retire 2 symboles au lieu de 1 |
| Cooldown | 8 s |

L'amplification la plus simple. Sert de point de comparaison pour les autres.

### `2` — Rune joker

| | |
| --- | --- |
| Effet | Le prochain geste correspond à **n'importe quel** symbole, sur toutes les cibles |
| Cooldown | 10 s |

Rattrape un geste mal tracé, et surtout perce un mur de têtes qui ne
correspondent à rien de ce qu'on sait tracer. Puissant, d'où le cooldown long.

### `3` — Rune de focalisation ⭐

| | |
| --- | --- |
| Effet | Marque l'ennemi le plus proche dans 300 px. Tant qu'il est marqué, les gestes ne touchent **que lui**, mais retirent 2 symboles |
| Durée | 5 s |
| Cooldown | 6 s |

**La proposition qui répond le plus directement à l'intention de départ** —
« attaquer un ennemi plus robuste ». Elle échange la portée globale des gestes
contre de la puissance mono-cible, c'est-à-dire qu'elle traduit en sort la
tension même du jeu. Et elle a un vrai coût : pendant 5 s, le reste du plateau
continue de descendre sans être touché.

### `4` — Rune d'harmonisation ⭐

| | |
| --- | --- |
| Effet | Réécrit le symbole de tête de tous les ennemis à l'écran avec un même symbole |
| Cooldown | 15 s |

Puis un seul geste nettoie la vague entière. Le paiement est spectaculaire et
n'est possible que parce que les gestes sont globaux : c'est une mécanique qui ne
pourrait exister dans aucun autre jeu.

*À trancher* : le symbole choisi est-il aléatoire (on subit) ou est-ce le plus
fréquent à l'écran (on optimise) ? La seconde option est plus généreuse et
probablement plus satisfaisante.

---

## D. Idées liées aux ennemis rares

Les glyphes `⚡` et `@` existent déjà. Leur donner un comportement propre leur
donnerait une raison d'être au-delà d'un tracé plus difficile.

**L'ennemi `⚡` — instable.** Mélange sa séquence restante toutes les 4 s. On ne
peut donc pas planifier une suite de gestes contre lui : soit on l'achève vite,
soit on le fige (`E`). Donne au givre un rôle qui n'est pas seulement défensif.

**L'ennemi `@` — scission.** Tué **par un geste**, il se scinde en deux ennemis
plus petits à séquence courte. Tué **à la mêlée**, il meurt pour de bon. Une
raison mécanique, et pas seulement esthétique, d'aller le chercher avec le
personnage — exactement le double focus recherché.

---

## E. Idées liées au boss

**La fenêtre de punition.** Pendant sa retraite, le boss est invincible aux
gestes comme à la mêlée. Le laisser rester sensible aux **sorts** — un givre qui
ralentit sa remontée, une onde de choc qui le repousse vers le bas — créerait une
phase où le placement compte alors qu'on ne peut plus rien tracer. Aujourd'hui,
la retraite est un temps mort.

**Des invocations.** Le boss fait apparaître deux ennemis à chaque vie perdue.
`A` et `R` deviennent alors des outils défensifs, et le rythme du combat gagne
une respiration.

---

## F. Ce que je déconseille

Aussi utile que la liste précédente.

**Une touche qui retire un symbole sans condition.** Rend la souris facultative.
C'est la seule idée qui casse le jeu plutôt que de le compliquer.

**Des points de vie au personnage.** Change la condition de défaite : on passe de
« défendre une ligne » à « survivre ». Il faudrait alors des dégâts au contact,
des frames d'invulnérabilité, un recul, une barre de vie — et une refonte de
l'équilibrage. C'est une bonne idée, mais c'est une **décision de conception à
part entière**, pas un ajout à glisser au passage.

**Une barre de mana.** Les cooldowns rythment déjà le jeu. Une ressource de plus
ajoute de l'interface sans ajouter de choix.

**Plus de cinq sorts actifs.** La main droite trace déjà en continu. Au-delà de
`AERF` + `Espace`, les touches ne seront pas utilisées.

---

## Par où commencer

Trois sorts, choisis pour couvrir les trois familles et se valider mutuellement :

| Ordre | Sort | Pourquoi celui-là |
| --- | --- | --- |
| 1 | **Dash** (`Espace`) | Rend le personnage agréable immédiatement. Aucun état nouveau sur les ennemis. |
| 2 | **Givre** (`E`) | L'outil « gagner du temps » le plus lisible. Introduit un état temporaire sur l'ennemi, brique réutilisable. |
| 3 | **Rune de focalisation** (`3`) | Répond à l'intention initiale et valide le mécanisme des runes. |

Si ces trois-là sont agréables, l'infrastructure pour les dix autres est en
place.

## Coût d'implémentation

L'ossature est déjà là : `Keyboard.takePresses()` sert précisément à ça.

**Ce qu'il faudrait créer :**

- `src/config/spells.js` — un registre bâti comme `glyphs.js` : un sort déclaré
  une fois, avec `id`, `key`, `cooldownMs`, `range` et `cast(game)`.
- `src/game/spellbook.js` — les cooldowns restants, avancés avec `deltaMs`.
  ⚠️ Doit passer par `clampDelta()`, sinon une frame longue recharge tout d'un
  coup (l'erreur exacte déjà commise sur le cooldown de mêlée).
- `Game.castSpell(spellId)`, à côté de `castGesture()`.
- Un affichage de cooldowns dans `render/hud.js`.

**Ce qui demande un état nouveau sur les entités :**

| Sort | Ajout |
| --- | --- |
| Givre | `frozenMs` sur `Enemy`, testé dans `update()` |
| Focalisation | `markedUntil`, lu par `resolveGesture()` |
| Charge / Joker | Un modificateur sur `Game`, consommé au geste suivant |
| Scission de `@` | Un retour de `resolveGesture` distinguant geste et mêlée |

Onde de choc, vortex, dash et harmonisation ne demandent **aucun état nouveau** :
ils déplacent ou réécrivent des champs existants. Ce sont donc les moins chers,
et de bons candidats pour un premier essai si l'objectif est de sentir le jeu
avant d'investir.

## Questions ouvertes

- Les sorts doivent-ils toucher le boss ? Ma préférence : oui, sauf en retraite,
  sinon les phases de retraite restent des temps morts.
- Le personnage peut-il se faire toucher ? Tout le reste dépend de la réponse.
- Une rune armée doit-elle expirer si on ne trace pas ? Sans expiration, on
  arme systématiquement dès que c'est prêt et la décision disparaît.
- Faut-il un retour visuel des zones d'effet avant de lancer ? Sans aperçu, une
  portée de 90 px se joue au jugé.
