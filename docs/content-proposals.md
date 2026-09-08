# Propositions de contenu pour le mode histoire

> **Statut : rien de tout ceci n'est implémenté.** C'est un catalogue d'idées à
> piocher, un ou deux éléments par niveau, pas une feuille de route.

Le contexte est dans [story-mode.md](story-mode.md), l'univers dans
[lore.md](lore.md).

## La règle qui commande tout

> **Des variations des mécaniques existantes, pas de nouveaux systèmes.**

Le jeu demande déjà beaucoup d'attention : la séquence de chaque carré, la
mana, l'emplacement de sort, la mêlée automatique, les billes qui tombent, les
repères du bas, et la tourelle en Difficile. Un système de plus ne rendrait pas
le jeu plus riche, il le rendrait illisible.

D'où le test que doit passer toute proposition, celui des bonus actuels :

1. **Optionnelle.** On peut jouer le niveau sans jamais s'en occuper.
2. **Discrète.** Elle n'occupe pas le centre de l'écran et ne clignote pas.
3. **Payante si on la prend en compte.** Celui qui la voit et l'utilise va plus
   vite, dépense moins, ou souffre moins.
4. **Jamais nécessaire pour survivre.** Sinon ce n'est plus un bonus, c'est une
   taxe déguisée.

Et la contrainte de fond, inchangée depuis le début : **une touche ne doit
jamais retirer un symbole gratuitement**, ou la souris — le cœur du jeu —
devient décorative.

Coût d'implémentation noté **F** (faible : des données et un peu de dessin),
**M** (moyen : un module ou une règle de jeu), **É** (élevé : touche le moteur
ou le reconnaisseur).

---

## A. De nouveaux symboles à tracer

Ajouter un geste, c'est une entrée dans `src/config/glyphs.js` plus un
`detectXxx()` dans `recognizer.js` — la procédure est dans
[gestures.md](gestures.md). Ce qui est cher, ce n'est jamais le glyphe : c'est
de ne pas déstabiliser les six qui existent, dont l'ordre de test est porteur.

### Le cercle `O` — **M**

Un tour complet qui **se referme sur son départ**. Distinct de la spirale, qui
demande 450° cumulés et finit loin de son point de départ ; le cercle tourne
entre 270° et 450° et revient à moins de X px de son origine.

Attention : le cas piège existe déjà et il est testé — `closedSpiralStroke` est
justement une spirale qui se referme. C'est la frontière à régler, et le test
existant dit de quel côté elle doit tomber.

Bon candidat pour être **le glyphe rare d'un nouvel environnement** : il se
trace lentement, donc il coûte du temps, comme `↯` et `@`.

### Les diagonales `/` et `\` — **M**, avec un risque

Le test d'angle range aujourd'hui tout trait en horizontal ou vertical. Le
découper en quatre secteurs de 45° donne deux glyphes pour presque rien.

Le risque est réel : un trait horizontal bâclé deviendrait une diagonale, alors
qu'aujourd'hui il pardonne. À n'envisager qu'avec une zone morte autour des
diagonales — et à mesurer en jouant, pas en raisonnant.

### L'équerre `L` — **M**

Un trait, un angle net d'environ 90°, un autre trait. Se distingue
structurellement du chevron (qui **s'inverse en Y** avec X monotone) : l'équerre
ne s'inverse ni en X ni en Y, elle tourne une fois. C'est le même genre de
critère structurel que celui qui sépare déjà l'éclair du chevron, donc il
s'insère proprement dans l'ordre de test.

### Les gestes à plusieurs traits (croix, étoile) — **É**, déconseillé

Le `PointerTracker` livre un tracé par appui. Il faudrait une notion de tracé
composé, avec un délai d'attente, donc un état de plus dans la boucle d'entrée
— pour un geste qui, de toute façon, prend trop de temps pendant une vague.

---

## B. De nouveaux bonus

Même canal que les sorts actuels : une bille jaune, un emplacement, une touche
`E` ou un clic droit. Ils tiennent tous dans `SPELLS` + `spellbook.js`, avec
leur couleur dans `SPELL_COLORS` (écart de teinte minimal de 45° imposé par un
test).

| Bonus | Effet | Pourquoi il est intéressant | Coût |
| --- | --- | --- | --- |
| **Écho** | Le prochain geste est rejoué tout seul 1 s plus tard | Récompense l'anticipation : il faut lancer le premier geste en prévoyant où seront les cibles à la seconde suivante | M |
| **Prisme** | Le prochain geste retire **deux** symboles à chaque cible touchée | Le bonus « fort mais borné » : il ne fait rien tout seul, il double un geste bien choisi | F |
| **Rappel** | Renvoie les trois menaces les plus basses de 200 px vers le haut | Achète du temps au lieu de faire des dégâts — la contrepartie exacte du repère du bas | M |
| **Sceau** | Marque un ennemi ; à sa mort il lâche trois billes au lieu de rien | Crée une cible qu'on a envie de garder en vie un instant | M |
| **Brouillage** | La tourelle du boss ne tire plus pendant 8 s | Colle au thème machine, et n'existe qu'en Difficile — un bonus qui ne sert que là où il fait mal | F |
| **Aimant** | Les billes viennent au héros pendant 10 s | Déjà proposé dans [rewards.md](rewards.md) ; il rend le déplacement moins coûteux en attention | M |
| **Bouclier** | Absorbe le prochain impact de la tourelle | Le seul bonus purement défensif ; à réserver aux niveaux avec barre de vie | M |

Deux garde-fous :

- **Un seul emplacement, toujours.** L'intérêt du système est qu'on **renonce**
  à une bille jaune quand l'emplacement est plein — cette bille continue de
  tomber sous les yeux du joueur. Deux emplacements tueraient ce choix.
- **La liste ne doit pas devenir un inventaire.** Six ou sept sorts est déjà
  beaucoup pour un tirage aléatoire : mieux vaut **varier la table par
  environnement** que l'allonger indéfiniment.

---

## C. De nouveaux boss

La tourelle actuelle et ses quatre patterns sont considérés terminés (voir
[boss-patterns.md](boss-patterns.md)). Ce qui suit, ce sont d'**autres** boss,
qui réutilisent la machine à états existante — descente, séquence, retraite,
vies — en changeant une règle.

### Les jumeaux — **M**

Deux boss de taille moitié, séquences plus courtes, une vie chacun. Abattre le
premier **accélère** le second. La tension vient du partage de l'attention, pas
d'une nouvelle attaque. Techniquement, `Game` ne gère qu'un boss aujourd'hui :
c'est la seule vraie modification, et elle est utile bien au-delà de ce boss.

### Le porteur — **M**

Il détient l'artefact et, une fois sa séquence entamée, il **fuit vers le
haut**. Le renversement est complet : la défaite n'est plus qu'il franchisse la
ligne du bas, c'est qu'il s'échappe par le haut. Toute la logique de fuite
existe déjà (`retreatSpeed`, `hasEscaped`), il n'y a qu'à changer le bord
regardé.

### Le blindé — **M**

Une plaque absorbe le **premier symbole retiré toutes les 5 s**. La mêlée
gratuite ne suffit donc plus à l'user seule, il faut grouper les gestes. C'est
une règle sur `dropFirstSymbol()`, le point de passage unique de tous les
dégâts — et donc un très bon endroit pour expérimenter sans rien casser.

### Le nid — **É**

Pas de séquence propre : il **fabrique des ennemis** et n'est vulnérable que
lorsqu'il en reste peu à l'écran. Change la boucle « casser les carrés » en
« nettoyer puis frapper ». C'est le plus intéressant et le plus cher.

### Patterns d'attaque à réutiliser

- **Les mines** : un projectile immobile qui explose après 2 s en croix. Ajoute
  la notion de terrain interdit *choisi à l'avance*, là où le gros projectile
  dérive.
- **Le mur troué** : une ligne de projectiles avec un trou, qui descend. Se lit
  instantanément, se joue au placement, et ne demande qu'une boucle de tirs.
- **Le drone d'escorte** : un petit satellite qui tourne autour du boss et tire
  peu. Rend le boss dangereux **par le côté**, ce qu'aucun pattern actuel ne
  fait.
- D'autres propositions, déjà rédigées, sont dans la seconde moitié de
  [boss-patterns.md](boss-patterns.md).

---

## D. Les mécaniques d'environnement

Une par décor, pas deux. Elle doit être **visible sans explication** et se
mesurer en une phrase.

| Décor | Mécanique | Ce qu'elle change | Coût |
| --- | --- | --- | --- |
| **Forêt** | Des troncs masquent des colonnes du terrain | On lit moins bien les séquences derrière : se déplacer devient un acte d'information | M |
| **Sable** | Une tempête réduit la visibilité par vagues de quelques secondes | Le repère du bas devient l'instrument principal — une mécanique existante prend enfin toute sa valeur | M |
| **Ciel** | Un vent latéral pousse les ennemis (et les billes) en biais | Casse la chute verticale, seule constante du jeu depuis le début | F |
| **Eau** | Tout est ralenti : ennemis, billes, héros, cadence de mêlée | Un niveau qui se joue au tempo inverse. Les gestes, eux, ne ralentissent pas : la souris devient l'arme rapide | F |
| **Lave** | Des geysers rendent des zones interdites quelques secondes | Réutilise le gros projectile — un morceau de terrain interdit — mais fixe et annoncé | M |

Trois remarques valables pour toutes :

- **Ne jamais toucher au tracé du geste.** Un vent qui dévierait la souris
  serait ressenti comme un bug de reconnaissance. Le vent pousse les *entités*.
- **Elles doivent pouvoir se cumuler avec les phases** d'un niveau : une
  tempête de sable est un bon effet de phase 3.
- **Elles se réutilisent.** Le vent du ciel dans un niveau de forêt tardif, la
  visibilité réduite dans un niveau de lave nocturne : c'est ce qui évite
  d'avoir à inventer une mécanique par épisode.

---

## Par où commencer

Si un seul élément devait être ajouté au premier vrai niveau du mode histoire :

1. **Les phases** (voir [story-mode.md](story-mode.md)) — sans elles, tous les
   niveaux se ressemblent, quel que soit le contenu ajouté par ailleurs.
2. **Une mécanique d'environnement à coût F** — le vent ou l'eau : beaucoup
   d'effet ressenti pour très peu de code.
3. **Un bonus à coût F** — Prisme ou Brouillage.

Le reste attend d'avoir été joué.
