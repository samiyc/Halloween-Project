# Règles et réglages

> Ce fichier décrit le jeu **tel qu'il est aujourd'hui**, au mode **Normal** —
> celui qui contient tout. Facile en retire des mécaniques, Difficile ajoute une
> barre de vie : voir [difficulty.md](difficulty.md).
>
> L'économie de mana, les billes bleues et les sorts aléatoires sont détaillés
> dans [mana-and-spells.md](mana-and-spells.md), avec les mesures d'équilibrage.

## Le double focus

C'est l'axe de conception du jeu, et il repose sur une opposition franche entre
les deux moyens d'attaquer :

| | Souris (gestes) | Personnage (mêlée) |
| --- | --- | --- |
| Portée | **Aucune limite** — touche tout l'écran | **75 px** autour du personnage |
| Cibles | **Toutes** les entités à la fois | **Toutes celles du cercle** |
| Contrainte | Doit correspondre au symbole en tête | Ignore le symbole, retire ce qui vient |
| Rythme | À la volée | Automatique, toutes les 1,5 s |
| Coût | **8 pts de mana** (24 pour ↯ et @) | **gratuite** |

Les deux sont donc des attaques de zone, mais opposées : le geste couvre tout
l'écran et ne touche que ce qui attend *son* symbole ; la mêlée couvre un petit
cercle et ne regarde aucun symbole. Aller se placer au milieu d'un groupe est
ce qui la rend rentable.

Et c'est la mana qui referme la boucle : le personnage la ramasse sous forme de
billes bleues, la souris la dépense. Il ne se contente donc plus de compléter les
gestes, il les finance.

Un geste horizontal retire un `_` à *tous* les ennemis qui en attendent un, et
au boss. La mêlée retire *un* symbole à *une* cible, quel qu'il soit.

D'où la tension : les gestes nettoient les vagues mais butent sur une cible dont
le prochain symbole n'est pas celui qu'on trace ; le personnage règle ce cas
précis, à condition d'aller physiquement au contact.

La mêlée a d'abord été mono-cible, pour que le placement ne domine pas les
gestes. Elle frappe désormais tout le cercle — c'est ce qui récompense le fait
de plonger dans un groupe — et sa portée a été resserrée de 15 % en compensation.

## Le retour visuel des dégâts

Perdre un symbole ne se lisait qu'en relisant la séquence au-dessus de la cible
— exactement ce qu'on n'a pas le temps de faire en pleine vague. Un carré touché
**vire instantanément au blanc cassé (`#F2F6F8`), puis revient progressivement à
sa couleur** en 100 ms.

Trois décisions valent d'être notées :

- **Instantané à l'aller, progressif au retour.** Une montée en fondu diluerait
  la frame même qu'on cherche à confirmer. C'est le retour qui est graduel.
- **Un ton clair, pas une couleur vive.** Gris, violet et orange n'ont en commun
  que d'être plus sombres que le flash ; une confirmation saturée lisible sur
  l'un disparaîtrait sur l'autre.
- **Un seul point d'accroche.** Geste et mêlée passent tous deux par
  `Entity.dropFirstSymbol()`, c'est donc là — et là seulement — que le compteur
  est armé. Aucune source de dégâts ne peut l'oublier, y compris celles qui
  n'existent pas encore.

Le flash s'applique à **tous les niveaux de difficulté** et à toutes les cibles :
ennemi gris, ennemi rare, boss. Le boss en retraite est invincible, `stripSymbol()`
y renvoie `null` : rien n'est retiré, donc rien ne clignote.

Un ennemi gelé par Givre flashe aussi, et **revient au bleu givre, pas au gris** :
`Enemy` redéfinit `baseColor` et non `displayColor`, pour que les deux états se
composent au lieu de s'écraser.

## Les repères de la ligne du bas

La façon la plus bête de perdre : un ennemi à longue séquence descend lentement
pendant que l'attention est ailleurs, franchit la ligne du bas, et la partie
s'arrête sans qu'on l'ait vu venir. Le boss a exactement le même défaut — il
descend à 0,25 px/frame pendant qu'on regarde les carrés gris.

Un **triangle** est donc posé sur la ligne du bas, aligné horizontalement avec la
menace qu'il annonce, et coloré selon sa progression :

| Progression | Couleur | Combien de repères |
| --- | --- | --- |
| < 60 % | gris translucide | un seul, sur la menace la plus basse |
| 60 % → 80 % | jaune | un par menace au-delà de 60 % |
| > 80 % | rouge | idem |

Six décisions valent d'être notées :

- **Au-delà du seuil jaune, chaque menace a son propre repère.** Deux ennemis à
  quelques pixels l'un de l'autre se partageaient un seul triangle : le second
  restait invisible jusqu'à ce que le premier soit réglé, ce qui est exactement
  la surprise que le repère existe pour éviter. `threatMarkers()` renvoie donc
  une liste, pas une menace.
- **En dessous du seuil, un seul repère gris**, sur la menace la plus basse. Rien
  n'est urgent : un rappel discret de l'état du bas du terrain suffit, un
  triangle sous chaque ennemi ne serait que du bruit.
- **Le boss compte comme une menace.** `Game.threats` vaut
  `[...enemies, boss]` : les deux font perdre en franchissant la même ligne, et
  le boss est celui qu'on oublie. Il obtient donc un repère comme les autres.
- **La progression se mesure sur le bord *haut*, pas sur le bas du carré.**
  C'est exactement la grandeur que compare `hasEscaped()` (`y > fieldHeight`) :
  100 % est donc la frame où la partie est perdue, ni avant ni après. Mesurer le
  bord bas ferait virer au rouge à des distances différentes pour un ennemi de
  40 px et un boss de 160.
- **Ils sont dessinés en dernier**, après le joueur et le tracé en cours. Dessiné
  en premier, le corps du boss recouvrait entièrement son propre repère au moment
  précis où il servait. Un liseré sombre les garde lisibles sur l'orange du boss
  comme sur le terrain, et la taille (33 x 21 px) a été augmentée d'une moitié
  après un premier essai qu'on ne voyait pas.
- **Toutes les difficultés.** Rien dans le chemin ne lit `game.rules` : ce n'est
  pas une aide qu'on retire en Difficile, c'est de la lisibilité.

Les repères informent sans jouer à la place du joueur : ils donnent une position
en X et une urgence, jamais la séquence à tracer — la souris reste le cœur du jeu.

## Victoire et défaite

- **Gagné** quand le boss termine sa dernière retraite sans vie restante.
- **Perdu** dès qu'une entité franchit le bas du canvas — ennemi ou boss. Le
  repère décrit plus haut existe précisément pour que ça ne surprenne pas.
- **Perdu** aussi quand la barre de vie se vide, en Difficile uniquement : c'est
  la tourelle du boss qui l'entame. Voir [boss-patterns.md](boss-patterns.md).

La condition est évaluée **une fois par frame**, à la fin. L'ancienne version la
testait à l'intérieur de la boucle de dessin : deux ennemis franchissant le bord
sur la même frame déclenchaient chacun un écran de fin complet, empilant les
minuteries et les écouteurs de redémarrage.

Le redémarrage se fait par un clic, une seconde après l'écran de fin, et
appelle `Game.reset()` — plus de `location.reload()`.

## Le cycle du boss

Ce n'est pas un gros ennemi, c'est une machine à états :

```
   descente ──── séquence vidée ────► retraite (invincible, monte)
       ▲                                      │
       └────────── atteint le haut ───────────┘
                   −1 vie, séquence plus longue,
                   corps plus petit, descente plus rapide
```

À chaque vie perdue : la séquence passe à `6 + vies × 2` symboles, la taille
perd 15 px et la vitesse gagne 0,25. Le combat devient donc **plus petit, plus
rapide et plus long** à mesure qu'il avance.

Pendant la retraite le boss est **invincible** : ni les gestes ni la mêlée ne
l'atteignent, et il ignore sa vitesse pour remonter à 1,5 px/frame. Il n'est
vaincu que hors de la phase de retraite, sans vie — mourir en pleine retraite le
ferait disparaître alors qu'il est encore à l'écran.

Effet de bord conservé de la version d'origine : quand le boss n'a plus de vie,
les ennemis **font demi-tour et remontent**. La fenêtre où c'est visible est
courte — la retraite finale — après quoi la partie est gagnée.

### Sa tourelle, en Difficile

Le boss porte un dôme et un canon qui pivote lentement vers le héros, et tire à
la fin de chaque cooldown un pattern tiré au sort **dans la table de sa phase** :
la rafale de trois projectiles partout, le rayon en phases 1 et 3, la spirale et
le gros projectile à partir de la phase 2. Encaisser fait clignoter le héros en
blanc et descendre la barre de vie ; à zéro, la partie est perdue.

La phase se lit sur les vies : 1 à trois vies, 2 à deux, 3 à une.

**Pendant la retraite, la tourelle est hors service** : le canon se fige et le
dôme passe au gris. Un boss à la fois intouchable et armé cumulerait les deux
pressions au seul moment où le joueur ne peut rien y faire.

Les patterns, leurs valeurs et les suivants envisagés :
[boss-patterns.md](boss-patterns.md).

## Les ennemis rares

12 % des apparitions. Violets, plus gros (32 px), plus lents, et leur séquence
contient un ou deux symboles rares (`↯`, `@`) mêlés à des symboles communs. Ils
restent donc attaquables aux gestes ordinaires, mais on ne peut pas les finir
sans savoir tracer un éclair ou une spirale — ou sans aller les chercher à la
mêlée, qui se moque du symbole.

## Tous les réglages

Ils sont tous dans `src/config/settings.js`, et rien n'est en dur ailleurs.

### Terrain et temps

| Réglage | Valeur | Note |
| --- | --- | --- |
| `CANVAS` | 1900 × 1200 | Toute la surface de dessin, affichée **en 1:1** |
| `FIELD` | 1300 × 1200 à x = 300 | **La zone jouable.** C'est elle qui sert de bornes au jeu |
| `SIDEBAR` | 300 × 1200, `#40494E` | Les deux bandeaux du HUD, un ton plus sombre |
| `TIME.referenceFrameMs` | 16,67 | L'unité de toutes les vitesses : « une frame à 60 Hz » |
| `TIME.maxFrameMs` | 100 | Plafond d'un delta ; au-delà le jeu ne saute pas |

Le canvas est affiché **en 1:1** partout où l'écran le permet : 1 px de code =
1 px à l'écran, donc une mesure prise dans un éditeur d'image correspond aux
constantes de `settings.js`. Il faut pour cela un viewport d'au moins
**1224 px de haut** ; en dessous, le canvas rétrécit au lieu de déborder.

C'est la réponse à un piège qui reviendra sinon à chaque mesure : le navigateur
étirait le canvas pour remplir la hauteur, et le facteur dépendait des
dimensions. En 1200×900 il valait ×1,376, en 1900×1200 seulement ×1,032 — un
carré de 25 px passait donc de 34 à 26 px à l'écran **sans qu'une seule
constante ait changé**. Le monde a depuis été agrandi ×1,6 pour retrouver la
lisibilité d'avant, cette fois sans zoom.

`FIELD` est **dérivé** de `CANVAS` et `SIDEBAR`, pas écrit en dur : les trois ne
peuvent donc pas diverger. La logique de jeu travaille entièrement en
coordonnées terrain (0..1300 × 0..1200) et ignore l'existence des bandeaux —
c'est le renderer qui translate et découpe, et le pointeur qui retranche
l'offset.

### Ennemis

| Réglage | Commun | Rare |
| --- | --- | --- |
| Taille | 40 | 50 |
| Longueur de séquence | 1 à 5 | 2 à 4 |
| Vitesse de base | 0,6 | 0,35 |
| Dispersion | +0 à 0,8 | +0 à 0,35 |
| Malus par symbole | −0,1 | −0,05 |

La vitesse décroît avec la longueur de la séquence : un ennemi coriace laisse
aussi plus de temps.

### Boss

| Réglage | Valeur |
| --- | --- |
| `lives` | 3 |
| `size` | 160, −24 par vie |
| `speed` | 0,25, +0,25 par vie |
| `retreatSpeed` | 1,5 (ignore `speed`) |
| Séquence | `6 + vies × 2` symboles |

### Joueur

| Réglage | Valeur |
| --- | --- |
| `size` | 40 — même taille que les carrés gris |
| Position de départ | **centre du terrain** (650, 600) |
| `speed` | 4 px/frame (240 px/s), normalisée en diagonale |
| `meleeRange` | **75 px**, de centre à centre, **en zone** |
| `meleeCooldownMs` | 1500 (1000 sous Frénésie) |

### Mana et ramassages

| Réglage | Valeur |
| --- | --- |
| `MANA.max` / `start` | 150 / 20 |
| `MANA.regenPerSecond` | 2 |
| `MANA.orbValue` | 5 |
| `MANA.costCommon` / `costRare` | 8 / 24 — **le levier de difficulté principal** |
| `MANA_ORB` | 20 px, 1,05 px/frame, 0,0225/frame (≈1,35/s) |
| `SPELL_ORB` | 28 px, 0,7 px/frame, une chute toutes les 15-20 s |

### Apparition

| Réglage | Valeur |
| --- | --- |
| `chancePerFrame` | 0,015 → environ 0,9 ennemi par seconde |
| `rareShare` | 0,12 |

### Retour visuel

| Réglage | Valeur |
| --- | --- |
| `HIT_FLASH.durationMs` | 100 — assez court pour que deux coups ne se confondent pas |
| `HIT_FLASH.color` | `#F2F6F8`, blanc cassé |
| `THREAT.warnRatio` | 0,60 — jaune, **et** seuil d'apparition d'un repère par menace |
| `THREAT.dangerRatio` | 0,80 — puis rouge |

### Tourelle du boss (Difficile)

Le tableau complet est dans [boss-patterns.md](boss-patterns.md) ; l'essentiel :

| Réglage | Valeur |
| --- | --- |
| `TURRET.rotationDegPerSecond` | 90 — le suivi de base, **le levier principal** |
| `TURRET.cooldownMs` | 2500, sauf si le pattern déclare le sien |
| `PROJECTILE.speed` / `damage` / `radius` | 6 / 10 / 10 |
| `VOLLEY.shots` / `shotIntervalMs` | 3 / 250 |
| `LASER.rotationDegPerSecond` / `durationMs` / `dps` | 15 / 2000 / 10 |
| `SPIRAL.sweepDegrees` / `durationMs` / `shotIntervalMs` | 405 / 2500 / 100 |
| `HEAVY.shot.radius` / `damage` / `cooldownMs` | 50 / 50 / 1500 |
| Poids des patterns | par phase, voir `PHASE_PATTERNS` |

## Un point d'équilibrage à surveiller

Le terrain a grandi deux fois : 800×600 à l'origine, puis 1200×900, et
aujourd'hui **1300×1200**. À vitesses inchangées, les ennemis mettent donc
deux fois plus de temps à traverser qu'au départ.

Contre-intuitif mais mesuré : encadrer la zone de jeu ne l'a pas rétrécie, elle
a **grandi de 44 %** (1,56 Mpx contre 1,08). Le taux de victoire n'a pourtant pas
bougé, parce que le terrain plus haut ralentit autant la menace que la collecte
de mana. Détail dans [mana-and-spells.md](mana-and-spells.md).

Deux leviers si le jeu devient trop facile — `ENEMY.baseSpeed` pour la pression
temporelle, `SPAWN.chancePerFrame` pour la densité — et `MANA.costCommon` pour
la tension de ressource, qui est de loin le plus sensible.
