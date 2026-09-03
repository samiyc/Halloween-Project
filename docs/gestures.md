# Les gestes

## Le contrat

Un glyphe est déclaré **une seule fois**, dans `src/config/glyphs.js` :

```js
chevronUp: { id: "chevronUp", symbol: "Ʌ", name: "Chevron haut", rarity: "common" },
```

`id` est ce que renvoie le reconnaisseur, `symbol` est ce qui apparaît dans les
séquences. La correspondance entre les deux ne vit qu'à cet endroit, et
`Entity.matches()` la consulte :

```js
matches(glyphId) {
  const symbol = symbolFor(glyphId);
  return symbol !== null && this.nextSymbol === symbol;
}
```

Auparavant cette table était **recopiée à l'identique** dans
`Enemy.decrementSequence()` et `Boss.decrementSequence()` sous forme d'une
chaîne de `||` — deux méthodes de complexité 9 qu'il fallait garder synchronisées
à la main. Ajouter un geste demandait de toucher quatre endroits ; il en reste
deux, et un seul si le geste réutilise une forme déjà détectée.

## Le tableau des glyphes

| Geste tracé | `id` | `symbol` | Rareté |
| --- | --- | --- | --- |
| Trait horizontal | `horizontal` | `_` | commun |
| Trait vertical | `vertical` | `\|` | commun |
| Chevron bas | `chevronDown` | `V` | commun |
| Chevron haut | `chevronUp` | `Ʌ` | commun |
| Éclair (zigzag) | `bolt` | `⚡` | rare |
| Spirale | `spiral` | `@` | rare |

## ⚠️ La contrainte sur les symboles

Les séquences sont des chaînes consommées avec `sequence[0]` et
`sequence.slice(1)`, qui travaillent sur des **unités de code UTF-16**.

Tout symbole doit donc tenir sur **une seule unité de code**, c'est-à-dire
appartenir au plan multilingue de base (U+0000 à U+FFFF).

```js
"⚡".length   // 1  → U+26A1, OK
"@".length    // 1  → U+0040, OK
"⟳".length    // 1  → U+27F3, OK
"🌀".length   // 2  → U+1F300, CASSE TOUT
```

Un émoji astral comme 🌀 compte pour deux unités : `slice(1)` n'en retirerait
que la moitié et corromprait silencieusement la séquence. C'est pour cela que la
spirale utilise `@` et non un émoji.

`assertGlyphSymbolsAreSafe()` vérifie cette règle et un test unitaire la fait
échouer si elle est violée — l'erreur se produit donc au `npm test`, pas en jeu.

`Ʌ` est **U+0245 LATIN CAPITAL LETTER TURNED V**, ni un lambda grec `Λ` (U+039B),
ni un `A` ASCII. Garder les fichiers en UTF-8, sinon la correspondance échoue
sans message d'erreur.

## Comment un tracé est classé

`recognizeStroke()` (`src/engine/gesture/recognizer.js`) teste dans cet ordre —
et l'ordre est la moitié de l'algorithme, chaque test filtrant pour les suivants :

```
1. spirale   angle cumulé ≥ 450°
2. éclair    ≥ 2 inversions de direction en X
3. chevron   le point milieu dépasse 20 % de la largeur du tracé
4. trait     l'angle départ→arrivée tranche entre horizontal et vertical
```

**Pourquoi cet ordre.** Une spirale et un éclair seraient tous deux avalés par le
test du chevron ou par celui de l'angle s'ils passaient après. Et les chevrons
restent devant le test d'angle pour qu'ils gagnent les cas limites — c'était le
comportement d'origine, conservé tel quel pour ne pas changer le ressenti.

**Comment chevron et éclair sont séparés.** C'est net, et pas approximatif :

- Un `V` ou un `Ʌ` s'inverse **en Y**, tandis que X progresse toujours dans le
  même sens → **0 inversion en X**.
- Un éclair est un zigzag : il s'inverse **en X**, plusieurs fois.

Le seuil est donc à 2 inversions en X, et un chevron ne peut structurellement
pas le franchir.

## Les seuils

Tous dans `STROKE`, dans `src/config/settings.js` :

| Réglage | Valeur | Rôle |
| --- | --- | --- |
| `minLength` | 50 | Distance départ→arrivée en dessous de laquelle le tracé est ignoré |
| `chevronRatio` | 0.2 | Fraction de la largeur que le milieu doit dépasser |
| `reversalDeadzone` | 14 | Sous ce déplacement, c'est du tremblement, pas une intention |
| `boltMinReversals` | 2 | Inversions en X nécessaires pour un éclair |
| `spiralMinTurn` | 450 | Degrés cumulés pour une spirale (1,25 tour) |
| `turnSampleDistance` | 26 | Écart entre deux points pour mesurer une direction |
| `turnSmoothingWindow` | 5 | Lissage appliqué avant de mesurer la courbure |

### Les deux pièges de la mesure de courbure

Ils ont tous les deux été trouvés par les tests, pas en jouant.

**Le tremblement de main.** Additionner les changements de direction est
extrêmement sensible au bruit : quelques pixels de dents de scie retournent la
direction locale de près de 180° à chaque point, et la somme fait passer un
trait parfaitement droit pour une spirale. D'où le lissage par moyenne mobile
(`smoothed()`) *avant* toute mesure d'angle, et l'échantillonnage tous les 26 px
plutôt qu'à chaque point.

**La spirale qui revient sur elle-même.** `minLength` mesure la distance
départ→arrivée, pas la longueur parcourue. Une spirale bien enroulée finit près
de son point de départ et serait donc rejetée avant même d'être classée.
`isStrokeUsable()` la rattrape : si l'encombrement du tracé est suffisant *et*
que l'angle cumulé dépasse le seuil de spirale, le tracé est accepté malgré une
distance directe faible.

## Ajouter un geste

1. **Déclarer le glyphe** dans `src/config/glyphs.js` — en respectant la règle
   de l'unité de code unique.
2. **Le détecter** dans `recognizer.js` : ajouter une fonction `detectXxx()` et
   l'insérer dans la chaîne `??` de `recognizeStroke()`, **à la bonne place**
   (du plus spécifique au plus générique).
3. Mettre les seuils dans `STROKE`, pas en dur dans le détecteur.
4. Ajouter une fixture dans `tests/helpers/strokes.js` et un cas dans
   `tests/recognizer.test.js` — en particulier un test qui prouve que le nouveau
   geste **ne vole pas** un geste existant, et réciproquement.

Rien d'autre. Les entités, le HUD et la légende se mettent à jour tout seuls à
partir du registre.

> Les seuils de l'éclair et de la spirale sont des points de départ raisonnables,
> pas des valeurs éprouvées à la main. Ils demanderont un ajustement au ressenti.
