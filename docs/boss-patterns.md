# La tourelle du boss et ses patterns d'attaque

> Mode **Difficile** uniquement. C'est ce qui donne enfin un sens à la barre de
> vie, et ce qui distingue Difficile de Normal.

## Ce qui est implémenté

Le boss porte une tourelle : un dôme centré sur lui et un canon qui **pivote
lentement** vers le héros. À la fin de chaque cooldown elle tire un pattern
choisi au sort **dans la table de sa phase**.

### Les quatre attaques

| | Rafale | Rayon | Spirale | Gros projectile |
| --- | --- | --- | --- | --- |
| Phases | 1, 2, 3 | 1 et 3 | 2 et 3 | 2 et 3 |
| Durée | 3 tirs à 250 ms (500 ms) | amorce 500 ms + 2 s | 25 tirs à 100 ms (2,5 s) | un seul tir |
| Dégâts | 10 par tir, jusqu'à **30** | 10 par seconde, jusqu'à **20** | 10 par tir | **50** |
| Rotation | 90°/s, suit le héros | **15°/s**, suit le héros | 162°/s, **aveugle** | 90°/s, suit le héros |
| Cooldown après | 2500 ms | 2500 ms | 2500 ms | **1500 ms** |
| Ce qu'elle demande | bouger avant le tir | quitter l'axe et rester dehors | sortir de la spirale par l'extérieur | ne jamais la toucher |

### Les phases

La phase se lit sur les vies du boss : **1** à trois vies, **2** à deux, **3** à
une. `Boss.phaseNumber` la calcule, la tourelle la reçoit à chaque frame, et
`patternsForPhase()` en tire la table.

| Phase | Table | Chaque attaque rare |
| --- | --- | --- |
| 1 | rafale 4, rayon 1 | rayon 1/5 |
| 2 | rafale 3, spirale 1, gros 1 | 1/5 chacune |
| 3 | rafale 2, spirale 1, gros 1, rayon 1 | 1/5 chacune |

**La rafale de trois est dans les trois phases et ne change jamais.** C'est la
ligne de base à laquelle tout le reste est comparé ; le rayon est la signature
de la phase 1, la spirale prend sa place en phase 2, et la dernière phase est la
seule où les quatre peuvent tomber.

### La rotation lente est la mécanique — et elle est par attaque

Sans plafond de rotation, un canon qui s'aligne sur le héros à chaque frame est
un viseur laser : aucune course ne le sèmerait, et « esquiver » deviendrait
« encaisser ». Le plafond de suivi est à **90°/s**, un quart de tour par seconde.

Mais un plafond unique ne suffisait pas. **Le rayon n'a rien à anticiper** : il
lui suffit de continuer à pointer, donc à 90°/s il restait collé au héros et
était impossible à fuir. Il tourne désormais à **15°/s**, un sixième — et c'est
précisément parce qu'on peut en sortir qu'il peut se permettre de faire deux
fois plus mal (5 → **10 dps**).

Chaque pattern peut donc déclarer son `rotationDegPerSecond` ; à défaut il prend
celui de `TURRET`. La spirale est un cas à part : elle ne suit pas, elle balaie.

### La spirale balaie, elle ne vise pas

405° — un tour plus 45° — en 2,5 s, soit 162°/s, en tirant toutes les 100 ms.
Le canon **ignore complètement le héros** pendant ce temps : une spirale qui
suivrait ne serait qu'une rafale très rapide.

Les 45° en trop comptent : sans eux le bras se refermerait exactement sur son
départ et formerait un anneau plein. Décalé, les derniers tirs tombent **entre**
les premiers et laissent un passage. Le sens de rotation est tiré au sort à
chaque lancement, pour qu'on ne puisse pas apprendre le bras par cœur.

Les projectiles de spirale sont **plus lents** (3 px/frame contre 6) : le bras
doit rester au sol assez longtemps pour qu'on ait à en sortir en marchant vers
l'extérieur, plutôt qu'à l'esquiver.

### Le gros projectile

Cinq fois le rayon, 50 pv — un tiers de la barre — et 2 px/frame seulement. Il
n'est jamais un test de réflexe : c'est **un morceau de terrain interdit qui
dérive vers vous**. Il porte un liseré jaune vif, parce que la taille seule se
lit comme « proche » et non comme « mortel ».

Son cooldown est court (1500 ms), mais il ne sort qu'une fois sur cinq, donc en
pratique un toutes les douze secondes environ.

### L'éventail n'est pas un paramètre

Les trois projectiles d'une rafale partent avec des angles légèrement
différents, mais il n'existe **aucun réglage de dispersion**. Le canon continue
simplement de suivre le héros pendant la rafale : si le héros bouge, la rafale
s'ouvre ; s'il ne bouge pas, les trois tirs se suivent en file. L'éventail est
donc une information — il dit que le joueur s'est déplacé au bon moment.

### L'amorce du rayon

Le rayon est précédé de 500 ms de trait fin pointillé, sans dégâts. Un rayon qui
apparaît déjà sur le héros retire des points de vie avant qu'il y ait quoi que
ce soit à lire, et la rotation lente ne sert alors plus à rien. La règle
générale, pour tout pattern à venir : **une attaque qui ne peut pas être vue
venir n'est pas une attaque, c'est une taxe.**

`LASER.chargeMs` à 0 supprime l'amorce.

### Les valeurs

| Réglage | Valeur | Note |
| --- | --- | --- |
| `TURRET.rotationDegPerSecond` | 90 | Le suivi de base. **Le premier levier** |
| `TURRET.cooldownMs` | 2500 | Sauf si le pattern déclare le sien |
| `TURRET.circleRatio` / `cannonRatio` / `cannonWidthRatio` | 0,30 / 0,55 / 0,14 | Fractions de `boss.size`, donc rétrécit avec le boss |
| `PROJECTILE.radius` | 10 | Exactement une bille de mana |
| `PROJECTILE.speed` | 6 px/frame (360 px/s) | **Le deuxième levier** |
| `PROJECTILE.damage` | 10 | Rafale complète = 30 pv sur 150 |
| `VOLLEY.shots` / `shotIntervalMs` | 3 / 250 | Intouché : c'est la ligne de base |
| `LASER.chargeMs` / `durationMs` | 500 / 2000 | |
| `LASER.rotationDegPerSecond` | **15** | Sinon le rayon reste collé au héros |
| `LASER.dps` | **10** | Un passage complet = 20 pv, deux projectiles |
| `LASER.beamWidth` | 18 | La largeur de la jauge de mana ; un test le vérifie |
| `SPIRAL.sweepDegrees` / `durationMs` | 405 / 2500 | 162°/s, dérivé — jamais écrit deux fois |
| `SPIRAL.shotIntervalMs` | 100 | 25 projectiles par spirale |
| `SPIRAL.shot.speed` | 3 px/frame | Moitié d'un tir visé |
| `HEAVY.shot.radius` / `damage` / `speed` | 50 / 50 / 2 | ×5, un tiers de la barre |
| `HEAVY.cooldownMs` | 1500 | Court, mais une fois sur cinq |
| Poids | voir la table des phases | |

### Les règles qui ne se voient pas

- **Pendant la retraite du boss, la tourelle est hors service.** Rien ne part, le
  canon **se fige** et le dôme passe au gris. Un boss à la fois intouchable et
  armé cumulerait les deux pressions au seul moment où le joueur ne peut rien y
  faire ; le canon immobile sur un dôme gris dit que la tourelle est endommagée,
  au lieu de laisser croire à une menace qui ne peut pas tirer. Le retour donne
  en plus un cooldown complet.

  > Une première version gardait le canon en rotation pendant la retraite, pour
  > que sa reprise soit lisible. Elle l'était, mais elle mentait : un canon qui
  > suit se lit comme un canon qui va tirer.
- **Aucune invulnérabilité après un impact.** Une rafale entière qui touche coûte
  bien 30 pv. C'est le prix de ne pas avoir bougé, et c'est ce qui fait de la
  rotation lente une vraie fenêtre.
- **Les projectiles sortent par les quatre bords.** Une bille de mana ne fait que
  tomber, un projectile va où il a été tiré.
- **Le rayon ne blesse pas derrière le canon.** La distance est mesurée sur une
  demi-droite, pas une droite.
- **Le clignotement blanc du héros confirme un impact, pas le rayon.** Rester
  dans le faisceau blanchirait le carré en permanence et le vert perdrait son
  sens ; le rayon est déjà visible sur lui.

---

## Propositions — inspiration « bullet hell »

Classées par ce qu'elles demandent au joueur, pas par leur difficulté. Coût
indiqué en supposant l'infrastructure actuelle (`Turret`, `Projectile`,
`boss-attacks.js`) déjà en place : la plupart ne sont qu'un pattern de plus dans
`startPattern()`.

### A. Ce que la structure actuelle offre presque gratuitement

**~~Gerbe en spirale~~ — implémentée**, voir plus haut. Elle a aussi apporté
l'infrastructure dont vivent la moitié des propositions ci-dessous : un canon
qui balaie sans viser, et une cadence de tir découplée du nombre de tirs.

**Anneau à brèche.** Douze projectiles partis du boss dans toutes les
directions, sauf un secteur. La brèche est visible parce qu'elle est vide : le
joueur cherche le trou au lieu de fuir. Excellent avec la salve suivante décalée
d'un demi-secteur.
*Coût : une boucle d'angles. Très faible.*

**Rafale en mur.** Sept projectiles alignés sur une ligne horizontale qui
descend, avec une trouée. Convertit le terrain en couloir pendant deux secondes.
*Coût : les projectiles naissent ailleurs qu'au canon — petit ajout.*

**Double tap.** La rafale actuelle, mais la deuxième salve vise **où le héros
sera** s'il continue son mouvement. Punit la fuite en ligne droite sans rien
changer à la vitesse des projectiles. ⭐
*Coût : mémoriser la position du héros d'une frame à l'autre. Faible.*

### B. Ce qui demande un type de projectile

**Projectile chercheur lent.** Vitesse réduite de moitié, mais il corrige son cap
vers le héros, avec le même plafond de rotation que le canon. On ne le sème pas,
on le fait tourner autour de soi et on le laisse loin derrière. Un ou deux par
salve, jamais plus.
*Coût : `Projectile` gagne un cap et une méthode de virage — `turnToward` existe
déjà. Faible.*

**Projectile scindé.** Après 1 s, il se remplace par trois projectiles plus
petits en éventail. Le danger n'est pas où on le regarde ; il faut anticiper la
scission, pas le projectile.
*Coût : un compteur et un retour « ces projectiles-ci en remplacent un ». Moyen.*

**Mines.** Le boss dépose un projectile immobile qui reste 4 s puis éclate en
anneau. Elles s'accumulent et grignotent le terrain — c'est le seul pattern qui
change **où** le joueur peut aller collecter la mana, pas seulement comment il
bouge. ⭐
*Coût : vitesse nulle, minuteur, et l'anneau existe déjà si on l'a fait. Moyen.*

**Projectile rebondissant.** Rebondit une fois sur un bord du terrain au lieu de
sortir. Rend les coins dangereux, ce qu'aucun pattern actuel ne fait.
*Coût : inverser une composante de vitesse au bord. Faible, mais attention — la
purge des quatre bords est justement ce qui empêche l'accumulation.*

### C. Ce qui demande plus de canons

Tu prévois des canons supplémentaires à 2 et 1 vie. La structure y est déjà :
`Turret` ne connaît qu'un point de montage et un angle, donc `Game` peut en
tenir un tableau. Ce qui compte est **ce que le deuxième canon fait**, pas qu'il
existe :

- **En opposition** (180° du premier) : interdit de tourner autour du boss, la
  stratégie évidente contre un canon unique.
- **Décalé de 30°** : les deux rafales se croisent à une distance précise, et il
  y a une bonne distance à tenir.
- **Un canon rayon, un canon rafale** : le rayon pousse, la rafale punit là où on
  a été poussé. C'est le duo le plus lisible et probablement le meilleur pour la
  phase à 1 vie. ⭐

### D. Ce que je déconseille

- **Les rideaux denses.** Le terrain sert aussi à ramasser de la mana ; un
  bullet hell véritable rendrait la collecte impossible et casserait l'économie.
  La tourelle doit **pousser** le joueur, pas l'immobiliser.
- **Les projectiles rapides.** Au-delà d'environ 10 px/frame l'esquive devient
  une question de réflexe, alors que tout le reste du jeu se joue en
  anticipation. Garder le danger lent et lisible.
- **Les patterns qui suivent parfaitement.** Toute attaque doit avoir une
  réponse spatiale ; sinon c'est un impôt sur le temps de combat.
- **Les dégâts pendant l'écran de fin ou la retraite.** Déjà écarté, à ne pas
  réintroduire par un pattern qui oublierait `canFire`.

### Par où continuer

1. **Le double tap**, parce qu'il corrige la faiblesse restante : fuir en ligne
   droite marche encore trop bien contre la rafale.
2. **L'anneau à brèche**, désormais quasi gratuit — le balayage de la spirale a
   déjà apporté le canon qui tire sans viser.
3. **Les mines**, quand il faudra que la tourelle pèse sur la collecte de mana et
   plus seulement sur les déplacements.

Les canons supplémentaires viennent après : ils multiplient un pattern, ils n'en
créent pas. Deux canons qui font la même chose ne sont qu'une rafale plus dense.
