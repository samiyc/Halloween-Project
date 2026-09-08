# L'univers — Spell Blaster 3000

> **Statut : décidé, pas encore écrit en jeu.** Le nom, les factions et l'arc
> narratif ci-dessous sont arrêtés. Ce qui est en jeu aujourd'hui, ce sont les
> titres et les libellés (menu, HUD) ; les textes de niveaux sont des bouchons,
> voir [story-mode.md](story-mode.md).

## Le nom

**Spell Blaster 3000.** Nom de travail, mais il dit déjà tout le pitch : un sort
d'un côté, un blaster de l'autre, et le « 3000 » de la science-fiction de série
B. Le titre s'affiche dans le menu et dans l'onglet du navigateur.

Le fichier `halloween.html` **n'est pas renommé** : c'est l'URL que le
propriétaire du dépôt ouvre avec Live Server, et un renommage coûterait plus
qu'il ne rapporte. À reconsidérer le jour où le jeu sera publié.

## Ce qui est abandonné

**Les fantômes et Halloween.** C'était le thème d'origine, il ne raconte rien.
Le vocabulaire disparaît au fur et à mesure :

| Avant | Après |
| --- | --- |
| Fantômes | Robots |
| `FANTÔMES` (score du HUD) | `ROBOTS` |
| « Un ennemi a franchi la ligne » | « Un robot a franchi la ligne » |
| Magic Spell Game | Spell Blaster 3000 |

Les carrés gris et violets restent des carrés : ce sont des **unités
mécaniques**, pas des créatures. Leur séquence de glyphes est le code qui les
verrouille, et c'est ce que le sort casse.

## Les deux camps

**La magie contre les machines.** Ce n'est pas le bien contre le mal, c'est deux
manières incompatibles de traiter le monde.

### Le héros ou l'héroïne

Un magicien, une magicienne — le jeu ne tranche pas et ne montre pas de visage :
le personnage est un carré vert. Il ou elle trace des sorts à la main. C'est ce
qui justifie mécaniquement la souris : **un sort se dessine, il ne se
sélectionne pas**. Un robot, lui, ne dessine rien ; il tire.

### L'ennemi

Une armée de robots à blasters et lasers. Ils ne sont pas menaçants un par un :
ils le sont parce qu'ils sont nombreux, méthodiques, et qu'ils avancent tout
droit vers la ligne du bas. Le boss est une machine plus grosse portant une
tourelle — celle de [boss-patterns.md](boss-patterns.md).

Ce qu'ils veulent : **s'emparer de quelque chose que les magiciens protègent.**
La nature exacte de cette chose n'est **volontairement pas fixée** ici. C'est le
moteur de l'enquête (voir ci-dessous), et une réponse trop tôt écrite ferait
perdre tout l'intérêt à la première moitié de la campagne. Il est même
acceptable qu'elle ne soit jamais complètement révélée.

## L'arc narratif

Trois mouvements, et une bascule au milieu.

### 1. Récupérer — on est à l'offensive

L'ennemi a volé des **artefacts**. Chaque niveau en reprend un. Chaque artefact
repris est aussi un **indice** : ce que la machine en faisait, ce qu'elle
cherchait à y lire. Le joueur attaque des positions ennemies ; les niveaux
s'appellent « L'attaque de… ».

### 2. Comprendre — la bascule

À force de pièces, on reconstitue ce que l'ennemi cherche vraiment. Et c'est
précisément **parce qu'on l'a compris** que l'ennemi passe à l'offensive : il
n'a plus le temps d'être discret.

### 3. Défendre — on est à la défensive

Le rapport s'inverse. Ce ne sont plus des positions ennemies qu'on attaque mais
des lieux importants qu'on défend ; les niveaux s'appellent « La défense de… ».
Jusqu'à la bataille finale.

**Mécaniquement, rien ne change.** Des carrés descendent, on les casse. C'est le
texte, le nom du niveau et le décor qui disent de quel côté de la ligne on se
trouve. C'est délibéré : l'histoire habille le jeu, elle ne le complique pas.

### Les petits arcs

À l'intérieur de ces trois mouvements, des arcs courts de deux ou trois
épisodes. Le patron le plus utile :

> **Des alliés ont besoin d'aide dans un épisode, et rendent la pareille plus
> tard.** Un village, un atelier, un ordre de mages : on les sauve, et deux
> niveaux plus loin ils apportent quelque chose — une information, un renfort,
> un lieu sûr. C'est ce qui donne une mémoire à la campagne sans demander une
> seule mécanique nouvelle.

Un arc = en général un environnement (voir [story-mode.md](story-mode.md)).

## Le ton

Sérieux dans l'enjeu, léger dans la forme. Le « 3000 » du titre autorise un
certain second degré ; les textes de fin de niveau font trois à cinq lignes,
jamais plus — ils se lisent après une victoire, quand on veut surtout relancer.

Règle d'écriture : **chaque paragraphe de fin de niveau répond à deux
questions** — où en est-on, et pourquoi la bataille suivante a-t-elle lieu ?
