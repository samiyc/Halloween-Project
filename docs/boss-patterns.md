# La tourelle du boss et ses patterns d'attaque

> Mode **Difficile** uniquement. C'est ce qui donne enfin un sens à la barre de
> vie, et ce qui distingue Difficile de Normal.

## Ce qui est implémenté

Le boss porte une tourelle : un dôme centré sur lui et un canon qui **pivote
lentement** vers le héros. Toutes les 2,5 s elle tire un pattern choisi au sort.

| | Rafale | Rayon |
| --- | --- | --- |
| Fréquence | 4 fois sur 5 | **1 fois sur 5** |
| Durée | 3 projectiles à 250 ms d'écart (500 ms) | amorce 500 ms + 2 s de rayon |
| Dégâts | 10 par projectile, jusqu'à **30** | 5 par seconde, jusqu'à **10** |
| Ce qu'elle demande | bouger avant le tir | quitter l'axe, et rester dehors |

### La rotation lente est la mécanique

Sans plafond de rotation, un canon qui s'aligne sur le héros à chaque frame est
un viseur laser : aucune course ne le sèmerait, et « esquiver » deviendrait
« encaisser ». Le plafond est à **90°/s**, un quart de tour par seconde.

C'est le premier réglage à toucher en jouant. `TURRET.rotationDegPerSecond`.

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
| `TURRET.rotationDegPerSecond` | 90 | **Le premier levier** |
| `TURRET.cooldownMs` | 2500 | Entre deux patterns, quel qu'il soit |
| `TURRET.circleRatio` / `cannonRatio` / `cannonWidthRatio` | 0,30 / 0,55 / 0,14 | Fractions de `boss.size`, donc rétrécit avec le boss |
| `PROJECTILE.radius` | 10 | Exactement une bille de mana |
| `PROJECTILE.speed` | 6 px/frame (360 px/s) | **Le deuxième levier** |
| `PROJECTILE.damage` | 10 | Rafale complète = 30 pv sur 150 |
| `VOLLEY.shots` / `shotIntervalMs` | 3 / 250 | |
| `LASER.chargeMs` / `durationMs` | 500 / 2000 | |
| `LASER.dps` | 5 | Un passage complet = 10 pv, soit un projectile |
| `LASER.beamWidth` | 18 | La largeur de la jauge de mana ; un test le vérifie |
| Poids | `volley: 4`, `laser: 1` | |

### Les règles qui ne se voient pas

- **Pendant la retraite du boss, la tourelle se tait.** Le canon continue de
  pivoter — c'est ce qui rend la reprise lisible — mais rien ne part. Un boss à
  la fois intouchable et armé cumulerait les deux pressions au seul moment où le
  joueur ne peut rien y faire. Le retour donne en plus un cooldown complet.
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

**Gerbe en spirale.** Le canon tourne à vitesse constante en tirant en continu,
en ignorant le héros pendant 3 s. Le motif au sol devient un escargot de
projectiles qu'on traverse en marchant vers l'extérieur, jamais en fuyant tout
droit. C'est le pattern bullet-hell canonique, et il enseigne au joueur que la
distance n'est pas toujours la réponse. ⭐
*Coût : un pattern, plus une rotation qui ignore la cible. Très faible.*

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

1. **La spirale**, parce qu'elle est presque gratuite et qu'elle change
   radicalement la façon dont on se déplace.
2. **Le double tap**, parce qu'il corrige la faiblesse actuelle : fuir en ligne
   droite marche trop bien.
3. **Les mines**, quand il faudra que la tourelle pèse sur la collecte de mana et
   plus seulement sur les déplacements.

Les canons supplémentaires viennent après : ils multiplient un pattern, ils n'en
créent pas. Deux canons qui font la même chose ne sont qu'une rafale plus dense.
