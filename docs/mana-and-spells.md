# Mana et sorts aléatoires

**Implémenté.** Les chiffres ci-dessous sont ceux du code, et deux d'entre eux
ont changé par rapport à la conception initiale après mesure — voir
« Ce que la simulation a corrigé ».

---

## Le problème que ça résout

Les gestes à la souris étaient gratuits et illimités. Le personnage n'avait donc
aucune raison d'exister : quoi qu'il fasse, la souris faisait le travail. Tout le
déséquilibre clavier/souris venait de là.

La mana renverse le rapport : **les gestes deviennent une ressource, et le
personnage devient la source de cette ressource.** Le déplacement n'est plus un
à-côté, c'est ce qui finance l'attaque.

---

## L'économie

### Les coûts

| Action | Coût | En billes |
| --- | --- | --- |
| Geste commun — `_` `\|` `V` `Ʌ` | **8 pts** | 1,6 |
| Geste rare — `⚡` `🌀` | **24 pts** | 4,8 |
| Mêlée automatique | **gratuite** | — |
| Sort du bonus jaune | **gratuit** | — |

Jauge : **max 150**, **démarre à 20**, régénération passive de **1 pt / 0,5 s**
(soit 2 pts/s). Une bille bleue vaut **5 pts**.

Le départ à 20 laisse de quoi lancer deux gestes communs sans rien avoir
ramassé : de quoi réagir à la première vague, pas de quoi se passer de collecte.

### Ce que la simulation a corrigé

Deux valeurs ont changé après mesure. Les deux erreurs allaient dans des sens
opposés, et aucune n'était visible sans faire tourner le jeu.

**La bille est passée de 1 à 5 points.** Avec 1 bille = 1 pt et un sort à 2 pts,
la régénération passive rapportait 2 pts/s contre **1,35 pt/s** pour une collecte
*intégrale*. Rester immobile aurait rapporté plus qu'un jeu parfait, et les
billes auraient été décoratives — l'exact inverse du but.

**Le sort est passé de 10 à 8 points.** Une partie complète a été rejouée sans
navigateur, avec un bot qui ramasse et lance au mieux. Le verdict :

| Grandeur | Mesure |
| --- | --- |
| Plafond de collecte réel (bot qui ne fait *que* ramasser) | **45 %** des billes |
| Offre maximale correspondante | **5,07 pts/s** (3,07 collecte + 2 passif) |
| Demande pour suivre le rythme des ennemis | **9 à 18 pts/s** |

L'offre plafonne à moins des deux tiers de la demande. Le « 100 % de collecte »
de la conception initiale n'existe pas : on ne peut pas être partout, et les
billes continuent de tomber ailleurs pendant qu'on va en chercher une. À 10 pts
le sort, une partie n'était gagnée que **4 fois sur 10** ; à 8 pts, **8 fois sur
10**.

Conséquence : « un sort coûte 2 billes » était le bon instinct mais ne tient pas
au chiffre près. Un sort coûte 1,6 bille.

### Le coût est un levier bien plus fort que le taux de chute

Table de calibration mesurée, 10 parties par ligne. Relevée sur le terrain de
1200×900 d'alors ; les proportions valent toujours, seuls les taux absolus ont
bougé avec l'agrandissement (section suivante) :

| Configuration | Victoires |
| --- | --- |
| coût 10/30, billes ×1,5 | 4/10 |
| coût 10/30, billes ×2 | 5/10 |
| coût 10/30, billes ×2,5 | 8/10 |
| **coût 8/24, billes ×1,5** — retenu | **8/10** |
| coût 6/18, billes ×1,5 | 10/10 |

Baisser le coût de 20 % double le taux de victoire ; augmenter le nombre de
billes de 33 % ne fait gagner qu'un point. La raison est le plafond de collecte :
**des billes qu'on ne peut pas atteindre ne valent rien.** Pour régler la
difficulté, toucher `MANA.costCommon` d'abord, `MANA_ORB.chancePerFrame`
seulement si l'écran doit paraître plus ou moins chargé.

Pour mémoire, les proportions qui restent vraies :

| Source | Revenu | Équivaut à |
| --- | --- | --- |
| Passif seul | 2 pts/s | 1 sort commun / 4 s |
| Collecte réaliste (45 %) | 5,07 pts/s | 1 sort commun / 1,6 s |

La collecte rapporte environ **1,5× le passif**, qui ne sert donc qu'à éviter le
blocage total. Et 150 pts font 18 sorts : une réserve confortable, qui se vide
tout de même en une poussée soutenue.

### Ce que l'agrandissement du terrain a changé

Le terrain est passé de 1200×900 à **1300×1200** quand les bandeaux latéraux ont
été ajoutés. Mesuré avant et après :

| | Collecte | Revenu | Victoires (bot, 10 parties) |
| --- | --- | --- | --- |
| 1200×900 | 52 % | 5,54 pts/s | 9/10 |
| **1300×1200** | **45 %** | 5,07 pts/s | **10/10** |

Deux constats contre-intuitifs. D'abord la zone jouable **grandit de 44 %**
(1,56 Mpx contre 1,08) : encadrer le jeu ne l'a pas rétréci. Ensuite le revenu
baisse — les billes sont plus dispersées — **sans que la difficulté augmente**,
parce que le terrain 33 % plus haut ralentit autant la menace que la collecte.

À retenir : la géométrie **n'apporte pas** de mana. Ce sont `max: 150` et
`start: 20` qui l'ont fait.

### Le geste raté doit coûter

C'est le point le plus important de tout le document.

Au plafond de collecte, on peut lancer un sort toutes les 1,6 s, alors que
tracer un geste en prend environ 1. **Si seuls les gestes réussis coûtaient, la
mana ne contraindrait quasiment jamais** et tout ce système ne serait qu'un
compteur décoratif.

Ce qui produit l'effet recherché — « ça force le joueur à être précis » — c'est
de payer aussi les gestes qui ne touchent rien. La distinction retenue :

| Situation | Coût |
| --- | --- |
| Geste reconnu, touche une ou plusieurs cibles | **payé** |
| Geste reconnu, ne correspond à aucune tête de séquence | **payé** |
| Tracé non reconnu (trop court, `recognizeStroke` renvoie `null`) | **gratuit** |
| Mana insuffisante | rien n'est lancé, rien n'est prélevé |

Un tracé non reconnu ne lance aucun sort, donc ne prélève rien : sanctionner un
mouvement de souris accidentel serait injuste. En revanche, un `Ʌ` propre tracé
au mauvais moment est une décision, et elle se paie.

### La mêlée est le plancher anti-blocage

Jauge vide, ennemis qui descendent, plus rien à lancer : c'est une situation sans
issue, et toute économie de ressource doit en prévoir une.

Ici la sortie de secours est la mêlée, **gratuite**. Elle est lente (1,5 s) et
mono-cible, donc elle ne remplace jamais les gestes, mais elle garantit qu'aucune
partie ne devient injouable. C'est la vraie raison de la conserver — et la raison
pour laquelle elle ne doit jamais coûter de mana.

### L'arbitrage sur les ennemis rares

Les gestes rares coûtent le triple. Face à un ennemi violet, deux routes :

| Route | Coût |
| --- | --- |
| Tout aux gestes (≈ 2 communs + 2 rares) | **64 pts** de mana, soit 13 billes |
| Aller au contact et laisser la mêlée faire | ~6 s de déplacement, **gratuit** |

C'est exactement la décision recherchée : le personnage n'est plus un
figurant, il est l'alternative économique au sort cher.

---

## Les billes bleues

| Propriété | Valeur | Note |
| --- | --- | --- |
| Forme | cercle bleu | |
| Diamètre | **12 px** | la moitié d'un cube gris (25 px) |
| Vitesse de chute | **×1,5 celle des ennemis** → ~1,05 px/frame | traversée en 19 s (terrain de 1200 px) |
| Taux d'apparition | **×1,5 celui des ennemis** → ~1,35/s | ennemis : 0,9/s |
| Valeur | 5 pts | |

Le joueur se déplace à 240 px/s et traverse toute la largeur en 5,4 s, alors qu'une
bille reste 19 s à l'écran. On pourrait croire que presque toutes sont
atteignables : la mesure dit **45 %** pour un bot qui ne fait que ramasser, parce
qu'on ne peut pas être à deux endroits et que les billes tombent en continu. Le
jeu porte sur le **routage**, pas sur la vitesse pure.

### ⚠️ Densité à l'écran

À 1,35 bille/s pour 19 s de traversée, il y aurait **environ 26 billes
simultanément** si aucune n'était ramassée, en plus des ennemis. C'est chargé —
et c'est une des raisons d'avoir sorti le HUD de la zone de jeu.

Si l'écran devient illisible à l'essai, le bon levier est **d'accélérer la
chute** — elles restent moins longtemps, la densité baisse, le revenu total ne
change pas. Baisser le taux d'apparition réduirait la densité *et* le revenu, ce
qui n'est pas la même décision.

---

## Le bonus jaune et les sorts

### Le principe

Emprunté à Mario Kart et Tricky Towers : on ne choisit pas son sort, on reçoit ce
que le hasard donne, et tout l'intérêt est de savoir **quand** le dépenser.

| Propriété | Valeur |
| --- | --- |
| Forme | cercle jaune, ~18 px |
| Fréquence | une chute toutes les **15-20 s** |
| Effet du ramassage | débloque **un** sort tiré au hasard dans la liste |
| Affichage | **coin supérieur gauche** de l'écran |
| Touche | **`E`** ou **clic droit** |
| Coût | **gratuit** — aucune mana, aucun cooldown |

Aucun cooldown par sort : la rareté de l'orbe jaune assure déjà le rythme, et
c'est la mana qui régule la souris. Deux systèmes de limitation suffisent, un
troisième ne ferait qu'ajouter de l'interface.

### Pourquoi les sorts sont gratuits

L'orbe jaune est déjà la ressource, et elle est rare. Une double barrière
rendrait le bonus injouable au moment précis où on le ramasse.

L'argument décisif : la **Grande potion de mana** deviendrait absurde s'il fallait
dépenser de la mana pour en gagner.

### La liste

| Sort | Effet | Durée | Signal visuel |
| --- | --- | --- | --- |
| **Frénésie** | vitesse d'attaque mêlée ×1,5 — cooldown 1500 → 1000 ms | 8 s | halo **orange** sur le héros |
| **Givre** | ennemis dans un rayon autour du héros ralentis ×0,5 | 8 s | ennemis touchés en **bleu clair** |
| **Célérité** | vitesse de déplacement ×1,5 — 4 → 6 px/frame | 8 s | halo **cyan** sur le héros |
| **Grande potion** | +50 pts de mana | instantané | flash de la jauge |

Rayon du givre : **200 px** proposé, à confirmer à l'essai. C'est presque quatre
fois la portée de mêlée (55 px), donc un vrai outil de zone et pas un doublon.

La potion à +50 représente la moitié de la jauge, soit 5 sorts communs. C'est
volontairement fort : elle doit rester un tirage qu'on est content d'avoir.

### ⚠️ Le vert est déjà pris

Le héros est **déjà vert** (`PLAYER.color = "#3FD35F"`). Un buff de déplacement
« vert » serait donc invisible — c'est le seul point de la proposition initiale
qui ne peut pas fonctionner tel quel.

Solution proposée : **le remplissage porte l'identité, le contour porte l'état.**

```
   remplissage vert  = c'est le héros, toujours
   halo orange       = Frénésie active
   halo cyan         = Célérité active
   deux halos        = les deux, en anneaux concentriques
```

Ce découplage règle du même coup un problème que le changement de teinte ne sait
pas exprimer : **deux buffs simultanés**. Les sorts durent 8 s et l'orbe tombe
toutes les 15-20 s, donc le recouvrement est rare mais parfaitement possible —
et une couleur de remplissage unique serait alors obligée d'en cacher un.

### Questions ouvertes

- **Un bonus tombe alors qu'un sort est déjà en réserve ?** Proposition : l'orbe
  **n'est pas ramassée** et poursuit sa chute. Ça crée une pression à dépenser
  avant de restocker, et évite d'écraser un sort qu'on gardait exprès.
- **Clic droit** : impose un `preventDefault` sur `contextmenu`, et le bouton
  droit ne doit pas démarrer un tracé dans `PointerTracker` (qui ne filtre pas le
  bouton aujourd'hui). `E` est plus simple et fonctionne à l'identique sur AZERTY
  et QWERTY (`KeyE` est à la même place physique).
- **Le givre affecte-t-il le boss ?** Cohérent avec la règle actuelle : oui hors
  phase de retraite, non pendant, où il est déjà invincible.

---

## ⚠️ Le risque principal du design

**Sans collision joueur/ennemi, la collecte n'a aucun coût.**

C'est la décision retenue pour l'instant, et elle est raisonnable pour valider
l'économie avant d'ajouter du danger. Mais il faut en avoir conscience : la
souris et le clavier occupent deux mains différentes, donc **on peut tracer tout
en se déplaçant**. Rien n'est sacrifié pour aller chercher une bille.

Le seul coût réel est l'**attention** — lire les séquences en haut de l'écran
pendant qu'on pilote son personnage en bas — et le **routage**, puisqu'une bille
ratée est perdue. C'est un vrai test d'habileté, mais ce n'est pas une prise de
risque.

Si la mana s'avère trop abondante à l'essai, les leviers sont, dans l'ordre :

1. la valeur de la bille (5 pts),
2. le coût des gestes (10 / 30 pts),
3. la régénération passive (2 pts/s),
4. **et seulement ensuite** la collision, traitée dans
   [rewards.md](rewards.md), qui donnerait un coût réel au déplacement.

---

## Où vit le code

### Créé

| Fichier | Rôle |
| --- | --- |
| `src/config/mana.js` | Coûts, valeur de la bille, régénération, max — une seule source de vérité, et `castCost()` lit la rareté dans le registre des glyphes |
| `src/config/pickups.js` | Taille, couleur, vitesse et taux des deux orbes |
| `src/config/spells.js` | Les 4 sorts en données pures, plus les couleurs de halo |
| `src/entities/pickup.js` | Bille bleue et orbe jaune : chute, collecte |
| `src/game/mana.js` | La jauge : `spend()`, `gain()`, `regenerate(deltaMs)` |
| `src/game/collection.js` | `collectPickups()`, en fonction pure |
| `src/game/pickup-spawner.js` | Deux rythmes : probabiliste pour les billes, minuterie pour les orbes |
| `src/game/effects.js` | Les buffs à durée |
| `src/game/spellbook.js` | Ce que chaque sort fait — table de handlers, pas de `switch` |

### Modifié

- `src/game/game.js` — la jauge, les listes de billes, le sort en réserve.
- `src/game/combat.js` — `resolveGesture()` doit renvoyer de quoi facturer, et
  `Game.castGesture()` refuser si la mana est insuffisante.
- `src/entities/player.js` — vitesse et cooldown de mêlée deviennent des valeurs
  *effectives*, modulées par les buffs plutôt que lues directement dans `PLAYER`.
- `src/entities/enemy.js` — un multiplicateur de vitesse pour le givre.
- `src/render/hud.js` — la jauge de mana, le sort en réserve en haut à gauche.
- `src/render/renderer.js` — billes, halos de buff, ennemis gelés.
- `src/engine/keyboard.js` — rien à ajouter : `takePresses()` existait déjà.
- `src/engine/pointer.js` — ignore les boutons autres que le gauche, sinon le
  clic droit démarrerait un tracé que le relâchement ferait payer.

### ⚠️ Le piège, évité

Tout ce qui consomme un delta — régénération, durée des buffs, ralentissement des
ennemis, cadence de mêlée — **passe par `clampDelta()`** (`src/config/settings.js`).

C'est l'erreur déjà commise une fois sur le cooldown de mêlée : consommé brut, un
delta de plusieurs secondes après un changement d'onglet remplissait la jauge et
rechargeait tout d'un coup. Chacun des quatre points a désormais son test de
régression, qui pousse une frame de 60 s et vérifie que rien ne saute.
