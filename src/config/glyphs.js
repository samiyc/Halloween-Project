/**
 * The single source of truth for castable glyphs.
 *
 * Before this file existed, every glyph had two independent representations —
 * an orientation string returned by the recognizer ("horizontal") and a symbol
 * stored in an entity's sequence ("_") — and the mapping between them was
 * duplicated verbatim inside `Enemy.decrementSequence()` and
 * `Boss.decrementSequence()`. Adding one gesture meant editing four places.
 *
 * Now a glyph is declared once, here. Matching is a single symbol comparison
 * (see `Entity.matches()`), so adding a gesture means: add an entry below, and
 * teach `engine/gesture/recognizer.js` how to detect it. Nothing else.
 *
 * ---------------------------------------------------------------------------
 * HARD CONSTRAINT ON `symbol`
 * ---------------------------------------------------------------------------
 * Sequences are plain strings consumed with `sequence[0]` and
 * `sequence.slice(1)`, which operate on UTF-16 code units. Every symbol MUST
 * therefore be a single code unit (i.e. in the Basic Multilingual Plane,
 * U+0000..U+FFFF). An astral emoji such as "\u{1F300}" (🌀) is TWO code units
 * and would silently corrupt every sequence it appeared in.
 *
 * `Ʌ` is U+0245 LATIN CAPITAL LETTER TURNED V — not a Greek lambda, not an
 * ASCII "A". Keep these files UTF-8. `assertGlyphSymbolsAreSafe()` below is
 * covered by a unit test so an unsafe symbol fails CI instead of the game.
 */

/** @typedef {"horizontal"|"vertical"|"chevronDown"|"chevronUp"|"bolt"|"spiral"} GlyphId */

/**
 * @type {Readonly<Record<GlyphId, {id: GlyphId, symbol: string, name: string, rarity: "common"|"rare"}>>}
 */
export const GLYPHS = Object.freeze({
  horizontal: { id: "horizontal", symbol: "_", name: "Trait horizontal", rarity: "common" },
  vertical: { id: "vertical", symbol: "|", name: "Trait vertical", rarity: "common" },
  chevronDown: { id: "chevronDown", symbol: "V", name: "Chevron bas", rarity: "common" },
  chevronUp: { id: "chevronUp", symbol: "Ʌ", name: "Chevron haut", rarity: "common" },
  bolt: { id: "bolt", symbol: "↯", name: "Éclair", rarity: "rare" },
  spiral: { id: "spiral", symbol: "@", name: "Spirale", rarity: "rare" },
});

/** Every glyph, as an array. */
export const ALL_GLYPHS = Object.freeze(Object.values(GLYPHS));

/** Symbols carried by ordinary grey enemies. */
export const COMMON_SYMBOLS = Object.freeze(
  ALL_GLYPHS.filter((glyph) => glyph.rarity === "common").map((glyph) => glyph.symbol),
);

/** Symbols reserved for rare enemies. */
export const RARE_SYMBOLS = Object.freeze(
  ALL_GLYPHS.filter((glyph) => glyph.rarity === "rare").map((glyph) => glyph.symbol),
);

const SYMBOL_BY_ID = Object.freeze(
  Object.fromEntries(ALL_GLYPHS.map((glyph) => [glyph.id, glyph.symbol])),
);

const GLYPH_BY_SYMBOL = Object.freeze(
  Object.fromEntries(ALL_GLYPHS.map((glyph) => [glyph.symbol, glyph])),
);

/**
 * The sequence symbol a recognised glyph consumes.
 * @param {GlyphId|null|undefined} glyphId
 * @returns {string|null}
 */
export function symbolFor(glyphId) {
  return SYMBOL_BY_ID[glyphId] ?? null;
}

/**
 * The glyph a sequence symbol belongs to.
 * @param {string} symbol
 * @returns {{id: GlyphId, symbol: string, name: string, rarity: string}|null}
 */
export function glyphForSymbol(symbol) {
  return GLYPH_BY_SYMBOL[symbol] ?? null;
}

/**
 * Throws if any declared symbol would break `sequence.slice(1)`.
 * Takes the list to check so the failure path itself is testable.
 * @param {readonly {id: string, symbol: string}[]} [glyphs]
 * @returns {true}
 */
export function assertGlyphSymbolsAreSafe(glyphs = ALL_GLYPHS) {
  for (const glyph of glyphs) {
    const codePoints = [...glyph.symbol].length;
    if (codePoints !== 1) {
      throw new Error(
        `Glyph "${glyph.id}" uses symbol ${JSON.stringify(glyph.symbol)} spanning ` +
          `${codePoints} code points. A symbol must be exactly one code point, ` +
          `or sequence slicing cannot tell where it ends.`,
      );
    }
  }
  return true;
}
