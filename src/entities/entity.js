import { symbolFor } from "../config/glyphs.js";

/**
 * Base class for anything that carries a glyph sequence and can be worn down.
 *
 * Entities hold state and behaviour only — no `canvas`, no `ctx`, no `draw()`.
 * Rendering lives in `src/render/`. That split is the reason this logic can be
 * unit-tested under plain Node with no DOM.
 *
 * The glyph→symbol comparison that used to be duplicated across Enemy and Boss
 * now exists once, in `matches()`, delegating to the registry.
 */
export class Entity {
  /**
   * @param {object} options
   * @param {number} options.x    Left edge.
   * @param {number} options.y    Top edge.
   * @param {number} options.size Square side length.
   * @param {string} options.sequence
   */
  constructor({ x, y, size, sequence }) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.sequence = sequence;
  }

  get centerX() {
    return this.x + this.size / 2;
  }

  /**
   * The colour to draw with. Subclasses override it to express state — a
   * slowed enemy, for instance — so the renderer never has to know about
   * gameplay rules.
   */
  get displayColor() {
    return this.color;
  }

  get centerY() {
    return this.y + this.size / 2;
  }

  /**
   * The symbol this entity is currently waiting for, or null when cleared.
   *
   * Destructuring uses the string iterator, which walks **code points** rather
   * than UTF-16 code units. That is what lets an astral emoji like 🌀 (U+1F300,
   * two code units) be a symbol: `sequence[0]` would have returned half a
   * surrogate pair and corrupted the sequence.
   */
  get nextSymbol() {
    const [first] = this.sequence;
    return first ?? null;
  }

  /**
   * Removes the head symbol, whatever its length in code units.
   * @returns {string|null} the symbol removed, or null on an empty sequence
   */
  dropFirstSymbol() {
    const symbol = this.nextSymbol;
    if (symbol === null) return null;
    this.sequence = this.sequence.slice(symbol.length);
    return symbol;
  }

  /**
   * Does a recognised glyph satisfy the head of the sequence?
   * @param {import("../config/glyphs.js").GlyphId|null} glyphId
   * @returns {boolean}
   */
  matches(glyphId) {
    const symbol = symbolFor(glyphId);
    return symbol !== null && this.nextSymbol === symbol;
  }

  /**
   * Consumes one symbol if the glyph matches. A mismatch is a no-op — there is
   * no penalty for a wrong gesture, by design.
   * @param {import("../config/glyphs.js").GlyphId|null} glyphId
   * @returns {boolean} whether a symbol was consumed
   */
  decrementSequence(glyphId) {
    if (!this.matches(glyphId)) return false;
    this.dropFirstSymbol();
    return true;
  }

  /**
   * Removes the head symbol whatever it is. Used by the melee auto-attack,
   * which ignores glyphs entirely.
   * @returns {string|null} the symbol removed
   */
  stripSymbol() {
    return this.dropFirstSymbol();
  }

  isDefeated() {
    return this.sequence.length === 0;
  }
}
