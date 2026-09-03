# Récompenses et prise de risque

Document de conception. Rien ici n'est implémenté.

Il remplace l'orientation « personnage de corps à corps » : la mêlée automatique
donne trop peu de décisions au joueur, qui n'a qu'une chose à faire — rester
collé au boss. Le personnage devient donc un **collecteur sous pression** : il
va chercher des récompenses qui tombent, et le moindre contact avec un ennemi
fait perdre la partie.

---

## Ce que le pivot change

| | Avant (mêlée) | Après (collecte) |
| --- | --- | --- |
| Rôle du personnage | Source de dégâts secondaire | Preneur de risques |
| Décision par seconde | ~0 — on se colle et on attend | Une par récompense : y aller ou pas |
| Contact ennemi | Sans effet | **Défaite immédiate** |
| Attention demandée | Faible | Partagée entre les séquences et sa propre trajectoire |

Le gain n'est pas d'ajouter du contenu, c'est de créer une **deuxième source
d'attention en concurrence avec la première**. Lire les séquences demande de
regarder le haut de l'écran ; conduire son personnage demande de regarder son
voisinage immédiat. On ne peut pas faire les deux parfaitement, et c'est
exactement là que naît le jeu.

---

## Les six règles qui rendent une récompense bonne

Elles servent à trier les propositions plus bas, et elles sont plus importantes
que les propositions elles-mêmes.

### 1. La valeur doit croître avec le danger du trajet

Si une récompense placée au milieu d'une nuée vaut autant qu'une récompense
isolée, le jeu optimal consiste à ne ramasser que les faciles — et le pilier
risque/récompense s'effondre.

Concrètement : la valeur doit se calculer **au moment du ramassage**, en
fonction du nombre d'ennemis proches, pas au moment de l'apparition.

### 2. Il faut pouvoir renoncer

Une récompense qu'on prend toujours n'est pas une décision, c'est une corvée.
Il faut donc que certaines soient régulièrement **trop chères pour ce qu'elles
rapportent** — d'où l'intérêt d'annoncer la valeur à l'écran avant le ramassage.

### 3. Aucune récompense ne doit être nécessaire pour survivre

Dès qu'un objet devient obligatoire, ce n'est plus une prise de risque, c'est
une contrainte. Les boucliers en particulier doivent rester un confort, jamais
la condition pour tenir.

### 4. La souris reste le cœur du jeu

La majorité des récompenses doivent **amplifier les gestes**, pas les remplacer.
Le personnage sert la souris ; l'inverse rendrait le tracé accessoire.

### 5. Il faut voir venir pour pouvoir planifier

Une récompense doit apparaître en haut et descendre **plus lentement que les
ennemis**, afin qu'on ait le temps de calculer un trajet. Une récompense qui
surgit à côté du joueur ne se mérite pas.

### 6. La hitbox du joueur doit être plus petite que le carré

Point technique, mais c'est lui qui décide si le jeu est juste ou frustrant. La
norme dans tous les jeux d'esquive : la zone de collision réelle fait environ un
tiers du sprite, centrée. Le joueur a alors le sentiment de « passer de
justesse » au lieu d'avoir l'impression de morts injustes.

Avec un carré de 25 px, une hitbox de 8 à 10 px est un bon point de départ.

---

## A. Récompenses qui amplifient les gestes

Les plus alignées avec la règle 4 : le déplacement sert à mieux tracer.

### Rune de charge

| | |
| --- | --- |
| Effet | Les 3 prochains gestes réussis retirent 2 symboles au lieu de 1 |
| Rareté | courante |
| Décision | Presque toujours bonne à prendre. Sert de référence de valeur |

### Joker (mis en réserve)

| | |
| --- | --- |
| Effet | Stocke un joker. Une touche le dépense : le prochain geste correspond à **n'importe quel** symbole |
| Rareté | peu courante |
| Décision | Deux décisions : aller le chercher, puis choisir **quand** le dépenser |

Le fait qu'il se stocke est ce qui le rend intéressant : il crée une ressource
qu'on peut garder trop longtemps.

### Harmonisation

| | |
| --- | --- |
| Effet | Réécrit le symbole de tête de tous les ennemis à l'écran avec un même symbole |
| Rareté | rare |
| Décision | Vaut un gros détour, mais seulement quand le plateau est chargé — sinon on gaspille |

C'est la récompense la plus spécifique à ce jeu : elle n'a de sens que parce que
les gestes touchent tout l'écran mais sont bloqués par le symbole en tête. Sa
valeur dépend entièrement du moment, ce qui en fait un excellent objet de
décision.

### Purge

| | |
| --- | --- |
| Effet | Retire un symbole à chaque ennemi présent |
| Rareté | peu courante |
| Décision | Sa valeur monte avec le nombre d'ennemis — donc avec le danger du trajet. La règle 1 s'applique toute seule |

---

## B. Récompenses de temps et de sécurité

### Sablier

| | |
| --- | --- |
| Effet | Tous les ennemis se figent 3 s |
| Rareté | peu courante |
| Décision | Rarement refusée, mais le vrai choix est **quand** la ramasser : la figer au bon moment ouvre une fenêtre pour aller chercher deux autres récompenses |

Le sablier est le seul objet qui se combine avec lui-même : il rend accessibles
des récompenses qui ne l'étaient pas.

### Bouclier

| | |
| --- | --- |
| Effet | Absorbe un contact avec un ennemi |
| Rareté | rare |
| Décision | Change complètement le calcul de risque tant qu'on l'a |

L'objet le plus structurant du système : il **convertit une défaite instantanée
en ressource consommable**. Avec un bouclier en poche, on ose des trajets qu'on
ne tenterait jamais autrement — et c'est le moment où le jeu devient tendu, pas
punitif.

⚠️ Attention à la règle 3 : si le rythme d'apparition est réglé pour qu'on ait
besoin d'un bouclier, ce n'est plus une récompense. Le viser comme un bonus
occasionnel, pas comme un consommable régulier.

### Recul

| | |
| --- | --- |
| Effet | Repousse tous les ennemis de 120 px vers le haut |
| Rareté | courante |
| Décision | Objet de secours. Se ramasse d'autant plus volontiers qu'on est en danger, donc naturellement bien placé |

---

## C. Récompenses de score pur

Aucun effet sur le combat : elles n'existent que pour la prise de risque. C'est
le cœur du système, parce que ce sont les seules dont on puisse dire non sans
regret mécanique.

### Fragments d'âme

| | |
| --- | --- |
| Effet | +1 au score |
| Rareté | très courante |
| Décision | Individuellement négligeable. Ils entretiennent le mouvement permanent |

Leur rôle n'est pas de valoir des points, c'est de **donner une raison de ne
jamais rester immobile**. Sans eux, le joueur se met dans un coin sûr entre deux
gros objets.

### Multiplicateur

| | |
| --- | --- |
| Effet | Score ×2 pendant 15 s |
| Rareté | peu courante |
| Décision | Ne vaut le détour que si on compte être actif ensuite — donc si on se sent capable d'enchaîner |

### Grand coffre

| | |
| --- | --- |
| Effet | +25 au score, ou +50 s'il est ramassé avec moins de 100 px d'écart avec un ennemi |
| Rareté | rare |
| Décision | La récompense qui applique la règle 1 explicitement, avec un bonus de frôlement |

Le bonus de frôlement — récompenser le fait de passer *près* d'un ennemi — est
une des mécaniques les plus efficaces du genre : elle transforme la peur en
appât.

---

## D. Récompenses qui modifient le personnage

### Célérité

| | |
| --- | --- |
| Effet | +50 % de vitesse de déplacement pendant 15 s |
| Rareté | courante |
| Décision | Presque toujours bonne |

⚠️ Effet boule de neige : aller plus vite permet de ramasser plus, donc d'aller
plus vite plus longtemps. À surveiller — soit une durée courte, soit pas de
cumul.

### Aimant

| | |
| --- | --- |
| Effet | Attire les récompenses dans un rayon de 200 px pendant 10 s |
| Rareté | peu courante |
| Décision | Bonne récompense **de** l'effort : elle rend le suivant moins coûteux |

### Vision

| | |
| --- | --- |
| Effet | Affiche pendant 20 s la trajectoire et la valeur des récompenses à venir |
| Rareté | peu courante |
| Décision | Ne donne aucune puissance, seulement de l'information — donc de meilleures décisions |

Sous-estimée : dans un jeu de risque, l'information *est* de la puissance, et
elle ne déséquilibre rien.

---

## E. Récompenses à choix — les plus intéressantes

C'est ici que naissent les vraies décisions, celles qui manquaient au corps à
corps.

### Pacte

| | |
| --- | --- |
| Effet | +40 au score immédiatement, mais le rythme d'apparition des ennemis augmente de 50 % pendant 20 s |
| Décision | **Refuser est souvent correct.** C'est tout l'intérêt |

### Double ou rien

| | |
| --- | --- |
| Effet | Double le score accumulé depuis la dernière partie… sauf si on touche un ennemi dans les 8 s, auquel cas on perd le bonus |
| Décision | Ramasser, puis jouer prudemment 8 s — ce qui veut dire renoncer aux autres récompenses pendant ce temps |

Élégant, parce que la récompense **crée elle-même** sa propre contrainte de jeu.

### Reliquaire à retardement

| | |
| --- | --- |
| Effet | Se pose au sol et ne devient ramassable qu'au bout de 3 s. Valeur élevée |
| Décision | Oblige à **s'engager sur une position** pendant que les ennemis continuent de tomber autour |

Le meilleur générateur de tension du lot : ce n'est plus « traverser », c'est
« tenir ».

### Offrande

| | |
| --- | --- |
| Effet | Deux objets tombent côte à côte, à 400 px d'écart. Ramasser l'un fait disparaître l'autre |
| Décision | Un choix explicite entre deux effets, sous contrainte de temps |

---

## Par où commencer

Trois objets suffisent à valider ou invalider tout le système :

| Ordre | Objet | Ce qu'il teste |
| --- | --- | --- |
| 1 | **Fragments d'âme** | Le socle : est-ce que ramasser en esquivant est agréable ? Si non, rien d'autre ne sauvera le système |
| 2 | **Bouclier** | Est-ce que la défaite instantanée est vivable une fois qu'on peut l'amortir ? |
| 3 | **Pacte** | Est-ce que refuser une récompense est une décision satisfaisante ? |

Dans cet ordre. Le premier valide la boucle, le deuxième l'équilibrage, le
troisième la profondeur.

---

## La question à trancher avant de coder

**Le contact est-il vraiment une défaite immédiate ?**

C'est ce qui est demandé, et c'est cohérent : ça donne un poids réel au
déplacement. Mais avec une dizaine d'ennemis à l'écran, c'est très sévère, et le
risque est que le joueur cesse de bouger — ce qui produirait exactement le
problème qu'on cherche à résoudre.

Trois options :

| Option | Effet |
| --- | --- |
| **Défaite immédiate** + hitbox indulgente + boucliers | Tension maximale. Demande un réglage soigné de la hitbox et du taux de boucliers |
| **3 vies** avec invulnérabilité brève après un contact | Beaucoup plus permissif, courbe d'apprentissage plus douce, tension moindre |
| **Perte du bonus** au lieu de la partie | Le contact coûte les effets actifs et le multiplicateur. Punitif sans être fatal |

Ma recommandation : **défaite immédiate, mais avec la hitbox réduite dès le
premier jour**, plus une invulnérabilité de 2 s au démarrage et après chaque
relance. Ça donne la tension voulue tout en évitant l'essentiel des morts
perçues comme injustes. La troisième option est le repli si le jeu s'avère trop
dur à l'essai — elle se teste vite, sans rien changer d'autre.

---

## Coût d'implémentation

### Ce qu'il faut retirer

Le corps à corps disparaît :

- `src/game/combat.js` → `resolveMelee()` et `findMeleeTarget()`
- `src/entities/player.js` → `meleeCooldownMs`, `meleeRange`, `meleeChargeRatio`, `isMeleeReady()`, `startMeleeCooldown()`, `distanceTo()` reste utile
- `src/game/game.js` → `runMelee()` et `lastMeleeTarget`
- `src/render/hud.js` → la barre de cooldown ; `renderer.js` → le cercle de portée
- `src/config/settings.js` → `PLAYER.meleeRange`, `PLAYER.meleeCooldownMs`
- Les tests associés dans `combat.test.js` et `entities.test.js`

Conséquence à noter : **le boss ne sera plus attaquable qu'aux gestes.** C'est
plus propre, mais il faudra revoir sa durée de vie — aujourd'hui le corps à
corps grignote une partie de ses séquences.

### Ce qu'il faut créer

- `src/config/pickups.js` — le registre, bâti comme `glyphs.js` : un objet
  déclaré une fois, avec `id`, `symbol`, `rarity`, `color` et `apply(game)`.
- `src/entities/pickup.js` — chute, valeur, durée de vie.
- `src/game/pickup-spawner.js` — calqué sur `Spawner`, avec des raretés
  pondérées.
- `src/game/collection.js` — `collectPickups()` et `checkFatalContact()`, en
  fonctions pures comme le reste de `game/`.
- `src/game/effects.js` — les effets à durée (`frozenMs`, multiplicateur,
  bouclier, célérité). ⚠️ **Doit passer par `clampDelta()`** : c'est l'erreur
  déjà commise une fois sur le cooldown de mêlée, où une frame longue rechargeait
  tout d'un coup.
- `PLAYER.hitboxSize` dans `settings.js`, distinct de `PLAYER.size`.
- Affichage des effets actifs dans le HUD.

L'architecture actuelle s'y prête : `Game` orchestre déjà des listes d'entités
et la logique est testable sans navigateur, donc les règles de collecte et de
collision se testent exactement comme le combat aujourd'hui.
