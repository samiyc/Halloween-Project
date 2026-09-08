# Le mode histoire

> **Statut : squelette en place.** Le menu, le déblocage, la sauvegarde, les
> textes et l'arrivée retardée du boss fonctionnent. Les **cinq niveaux
> existants sont des bouchons** : ils tournent tous en règles *Facile*, et les
> phases décrites plus bas ne sont pas encore implémentées. La liste « Ce qui est
> un bouchon » en fin de page dit exactement quoi.

L'univers et l'arc narratif sont dans [lore.md](lore.md).

## Pourquoi

Facile / Normal / Difficile ne sont pas trois difficultés, ce sont **trois
paliers de tutoriel** : chacun ajoute un système (mana, ennemis rares et sorts,
puis barre de vie). Une fois les trois traversés, le joueur connaît le jeu et il
n'y a plus rien à faire.

Le mode histoire est ce « rien à faire ». Ce n'est **pas** une quatrième
difficulté : c'est une suite de niveaux courts, nommés, qui se débloquent l'un
après l'autre et racontent quelque chose entre deux.

## La structure

### Des séries par environnement

Comme une série télé : deux ou trois épisodes par décor, puis on change.

| Environnement | Épisodes | Idée directrice |
| --- | --- | --- |
| Forêt | 2-3 | Le décor d'entrée, le plus lisible |
| Sable | 3 | Visibilité réduite, vent |
| Ciel | 3 | Le terrain pousse, rien n'est immobile |
| Eau | 3 | Tout est ralenti, y compris le héros |
| Lave | 3 | Des zones du terrain deviennent interdites |

Un environnement apporte **une identité visuelle et une variation d'une
mécanique existante**, jamais un système entier de plus. Le jeu a déjà beaucoup
de choses à suivre : gestes, mana, sorts, mêlée, repères, tourelle. Les
propositions par environnement sont dans
[content-proposals.md](content-proposals.md).

Les ennemis et les boss **se réutilisent d'un environnement à l'autre**. Le même
carré gris dans le sable et sous l'eau ne se joue pas pareil si le décor change
sa vitesse ou sa visibilité : c'est là qu'est le travail, pas dans un bestiaire.

### Des phases, pas un éditeur de carte

**Il n'y aura pas de fichier plaçant chaque ennemi.** C'est un éditeur de
niveaux déguisé, et c'est un projet en soi.

À la place, un niveau est une suite de **4 à 5 phases**. Une phase décrit *ce
qui se passe pendant un moment*, aléatoirement :

```
Phase 1  ── 45 s ─────────────► ennemis communs, spawn lent, pas de boss
Phase 2  ── 60 s ─────────────► + ennemis rares, billes plus fréquentes
Phase 3  ── le boss arrive ───► spawn réduit, la tourelle prend le relais
Phase 4  ── le boss perd une vie ─► vague dense pendant sa retraite
Phase 5  ── final ────────────► tout en même temps
```

On passe à la phase suivante **au bout d'un temps donné, ou quand le boss perd
une vie** — le premier des deux. Ce qu'une phase peut régler : le taux
d'apparition, la part d'ennemis rares, le taux de billes, la présence du boss,
et plus tard les particularités de l'environnement.

C'est la même idée que `PHASE_PATTERNS` pour la tourelle, un cran au-dessus :
une table de données lue par un module, pas du code par niveau.

### Le boss arrive tard

En mode histoire, le boss **n'est pas là au lancement** : il descend au bout de
30 à 60 secondes. Cela donne une ouverture — le temps de ramasser, de se placer,
de lire le terrain — et cela fait exister la première phase.

Implémenté par `Boss.arrivalDelayMs` : tant que le délai court, le boss est en
phase `waiting`, garé au-dessus du terrain et **invincible**. Il ne peut donc ni
être touché au geste ni frappé en mêlée, sa tourelle ne tire pas (elle lit déjà
`canFire: !boss.isInvincible`), et aucun repère de menace ne le désigne. Les
trois modes tutoriel gardent un délai de 0 : rien ne change pour eux.

## Le déblocage et la sauvegarde

- Le **premier** niveau est toujours ouvert.
- Un niveau s'ouvre quand le **précédent** est gagné. L'ordre est celui de
  `LEVEL_IDS` dans `src/config/levels.js`.
- La progression est enregistrée dans le **`localStorage`** du navigateur, sous
  la clé `spellblaster.progress`, au format versionné
  `{ version: 1, completed: [...] }`.

Pourquoi `localStorage` et pas un cookie : même effet, mais l'API est un
`get`/`set` au lieu d'une chaîne à parser, il n'y a pas de date d'expiration à
gérer ni de limite à 4 Ko — et comme il n'existe aucun serveur, l'unique
avantage du cookie (être envoyé avec les requêtes) ne sert à rien.

Trois règles de robustesse, chacune couverte par un test :

1. **Une sauvegarde absente, illisible ou d'une autre version repart de zéro.**
   Une clé corrompue ne doit jamais empêcher le menu de s'afficher.
2. **`localStorage` peut jeter** (navigation privée stricte, site data bloqué) :
   tout accès est dans un `try/catch` et le jeu continue sans mémoire.
3. **La logique ne connaît pas le navigateur.** `Progress` reçoit un objet
   `{read, write}` injecté, exactement comme `Rng` est injecté ; l'adaptateur
   `localStorage` vit seul dans `src/engine/storage.js`, et les tests utilisent
   `memoryStorage()`.

> Conséquence à connaître : la sauvegarde est **par origine**. Ouvrir le jeu sur
> `127.0.0.1:5500` et sur `localhost:5500` donne deux progressions différentes,
> et `file://` n'en garde aucune.

## Le menu

```
        Spell Blaster 3000

  ENTRAÎNEMENT          HISTOIRE
  ┌────────────┐   ┌──────────────────┐ ┌─┐
  │  Facile    │   │ Le relais de …   │ │i│
  ├────────────┤   ├──────────────────┤ └─┘
  │  Normal    │   │ La clairière …   │
  ├────────────┤   ├──────────────────┤
  │  Difficile │   │ 🔒 verrouillé    │
  ├────────────┤   ├──────────────────┤
  │ Retour jeu │   │ 🔒 verrouillé    │
  └────────────┘   └──────────────────┘

  ┌───────────────────────────────────────┐
  │ le texte du niveau, quand on a cliqué │
  │ sur son bouton info                   │
  └───────────────────────────────────────┘
```

- **Entraînement à gauche**, les trois modes plus « Retour au jeu ».
- **Histoire au centre**, un bouton par niveau. Un niveau verrouillé est grisé
  et ne réagit pas au clic — comme « Retour au jeu » quand aucune partie n'est
  en cours, le comportement existe déjà.
- **Un petit bouton info** est accolé à chaque niveau débloqué. Il ne lance
  rien : il déplie le texte de l'histoire **sous** le menu. Un second clic le
  replie ; cliquer sur un autre bascule dessus.

Toute la géométrie reste dans `src/render/layout.js`, qui ne touche aucun `ctx`
et que les tests peuvent donc vérifier : les mêmes rectangles servent au dessin
et au clic, si bien qu'un bouton ne peut pas être dessiné là où il n'est pas
cliquable.

Le repli du texte passe par `wrapLines(text, maxChars)`, une fonction pure —
pas de `ctx.measureText()`. Les polices du menu sont fixes, une largeur en
caractères suffit, et le panneau reste testable.

## Les textes

Deux paragraphes par niveau, dans `src/config/levels.js` :

| Champ | Quand il s'affiche | Ce qu'il dit |
| --- | --- | --- |
| `brief` | bouton info du menu | où on en est, pourquoi on y va |
| `debrief` | écran de victoire, puis bouton info une fois le niveau gagné | ce qu'on a appris, et ce qui mène à la bataille suivante |

Trois à cinq lignes chacun, pas plus : ils se lisent au moment où l'on veut
surtout relancer une partie.

## Les noms de niveaux

Chaque épisode porte son nom, affiché **dans le HUD pendant la partie** et sur
son bouton de menu. Le patron :

- offensive → « **L'attaque** du relais de Grandbois »
- défensive → « **La défense** de l'atelier des Cendres »

C'est le nom, et non une mécanique, qui dit de quel côté de la ligne on se
trouve. Voir [lore.md](lore.md).

## Où c'est implémenté

| Fichier | Rôle |
| --- | --- |
| `src/config/levels.js` | Le registre des niveaux : données pures, aucun code |
| `src/game/progress.js` | Ce qui est débloqué, ce qui est terminé — pur, stockage injecté |
| `src/engine/storage.js` | Le seul endroit qui touche `localStorage` |
| `src/game/session.js` | `startLevel()`, `noteOutcome()`, quel texte est déplié |
| `src/entities/boss.js` | `arrivalDelayMs` et la phase `waiting` |
| `src/render/layout.js` | Les deux colonnes, les boutons info, `wrapLines()` |
| `src/render/menu.js` | Le dessin du menu et du panneau de texte |
| `src/render/hud.js` | Le nom du niveau, le paragraphe de victoire |

## Ce qui est un bouchon

À remplacer, dans cet ordre :

1. **Les cinq niveaux tournent en règles `easy`.** C'est volontaire : il fallait
   éprouver le déblocage, la sauvegarde et l'affichage des textes avant
   d'écrire du vrai contenu. Chaque niveau déclare déjà sa `difficulty`, donc
   passer l'un d'eux en `medium` ou `hard` est un changement d'une ligne.
2. **Les phases n'existent pas.** Un niveau n'a aujourd'hui qu'un délai
   d'arrivée du boss. La table de phases décrite plus haut est le prochain gros
   morceau, et elle demandera un `PhaseRunner` pilotant `Spawner` et
   `PickupSpawner`.
3. **Les environnements n'ont aucun effet.** Le champ `environment` est présent
   et inutilisé ; il ne sert pour l'instant qu'à ranger les niveaux par série.
4. **Les textes sont d'entraînement.** Ils tiennent la route mais n'engagent
   rien : à réécrire avec les vrais artefacts et les vrais alliés.
5. **Aucun écran de fin de campagne.** Gagner le dernier niveau ne fait rien de
   particulier.
