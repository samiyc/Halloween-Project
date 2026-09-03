# Règles et réglages

> Ce fichier décrit le jeu **tel qu'il est aujourd'hui**. L'économie de mana, les
> billes bleues et les sorts aléatoires sont détaillés dans
> [mana-and-spells.md](mana-and-spells.md), avec les mesures d'équilibrage.

## Le double focus

C'est l'axe de conception du jeu, et il repose sur une opposition franche entre
les deux moyens d'attaquer :

| | Souris (gestes) | Personnage (mêlée) |
| --- | --- | --- |
| Portée | **Aucune limite** — touche tout l'écran | 55 px autour du personnage |
| Cibles | **Toutes** les entités à la fois | **Une seule**, la plus proche |
| Contrainte | Doit correspondre au symbole en tête | Ignore le symbole, retire ce qui vient |
| Rythme | À la volée | Automatique, toutes les 1,5 s |
| Coût | **8 pts de mana** (24 pour ⚡ et @) | **gratuite** |

Et c'est la mana qui referme la boucle : le personnage la ramasse sous forme de
billes bleues, la souris la dépense. Il ne se contente donc plus de compléter les
gestes, il les finance.

Un geste horizontal retire un `_` à *tous* les ennemis qui en attendent un, et
au boss. La mêlée retire *un* symbole à *une* cible, quel qu'il soit.

D'où la tension : les gestes nettoient les vagues mais butent sur une cible dont
le prochain symbole n'est pas celui qu'on trace ; le personnage règle ce cas
précis, à condition d'aller physiquement au contact. C'est pour cela que la
mêlée est mono-cible — une mêlée de zone rendrait le placement trivialement
supérieur aux gestes.

## Victoire et défaite

- **Gagné** quand le boss termine sa dernière retraite sans vie restante.
- **Perdu** dès qu'une entité franchit le bas du canvas — ennemi ou boss.

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

## Les ennemis rares

12 % des apparitions. Violets, plus gros (32 px), plus lents, et leur séquence
contient un ou deux symboles rares (`⚡`, `@`) mêlés à des symboles communs. Ils
restent donc attaquables aux gestes ordinaires, mais on ne peut pas les finir
sans savoir tracer un éclair ou une spirale — ou sans aller les chercher à la
mêlée, qui se moque du symbole.

## Tous les réglages

Ils sont tous dans `src/config/settings.js`, et rien n'est en dur ailleurs.

### Terrain et temps

| Réglage | Valeur | Note |
| --- | --- | --- |
| `CANVAS.width` / `height` | 1200 × 900 | 1,5× l'original (800 × 600), même ratio 4:3 |
| `TIME.referenceFrameMs` | 16,67 | L'unité de toutes les vitesses : « une frame à 60 Hz » |
| `TIME.maxFrameMs` | 100 | Plafond d'un delta ; au-delà le jeu ne saute pas |

### Ennemis

| Réglage | Commun | Rare |
| --- | --- | --- |
| Taille | 25 | 32 |
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
| `size` | 100, −15 par vie |
| `speed` | 0,25, +0,25 par vie |
| `retreatSpeed` | 1,5 (ignore `speed`) |
| Séquence | `6 + vies × 2` symboles |

### Joueur

| Réglage | Valeur |
| --- | --- |
| `size` | 25 — même taille que les carrés gris |
| `speed` | 4 px/frame (240 px/s), normalisée en diagonale |
| `meleeRange` | 55 px, de centre à centre |
| `meleeCooldownMs` | 1500 (1000 sous Frénésie) |

### Mana et ramassages

| Réglage | Valeur |
| --- | --- |
| `MANA.max` / `start` | 100 / 0 |
| `MANA.regenPerSecond` | 2 |
| `MANA.orbValue` | 5 |
| `MANA.costCommon` / `costRare` | 8 / 24 — **le levier de difficulté principal** |
| `MANA_ORB` | 12 px, 1,05 px/frame, 0,0225/frame (≈1,35/s) |
| `SPELL_ORB` | 18 px, 0,7 px/frame, une chute toutes les 15-20 s |

### Apparition

| Réglage | Valeur |
| --- | --- |
| `chancePerFrame` | 0,015 → environ 0,9 ennemi par seconde |
| `rareShare` | 0,12 |

## Un point d'équilibrage à surveiller

Le terrain est passé de 600 à 900 px de haut. À vitesse inchangée, **les ennemis
mettent 1,5× plus de temps à traverser**, ce qui rend le jeu sensiblement plus
facile qu'avant.

C'est volontairement laissé tel quel : les valeurs d'origine sont préservées
pour que le changement soit un choix conscient et non une conséquence subie.
Deux leviers, selon l'effet recherché — augmenter `ENEMY.baseSpeed` pour
retrouver la pression temporelle, ou `SPAWN.chancePerFrame` pour retrouver la
densité à l'écran.
