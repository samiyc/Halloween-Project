import { symbolFor } from "../config/glyphs.js";
import { HIT_FLASH, clampDelta } from "../config/settings.js";
import { mixHex } from "../tools/color.js";

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
    /** Milliseconds left on the hit flash; see `displayColor`. */
    this.hitFlashMs = 0;
  }

  get centerX() {
    return this.x + this.size / 2;
  }

  /**
   * The colour this entity settles back to. Subclasses override *this* rather
   * than `displayColor` to express a lasting state — a slowed enemy, say — so
   * the hit flash stays written once and applies to every kind of target.
   */
  get baseColor() {
    return this.color;
  }

  /**
   * The colour to draw with, flash included, so the renderer never has to know
   * about gameplay rules.
   *
   * The blend runs from the flash colour back to `baseColor` as the countdown
   * empties: pale on the frame of impact, then a short fade home. Confirmation
   * has to land on that frame, which an eased attack would blur.
   */
  get displayColor() {
    if (this.hitFlashMs <= 0) return this.baseColor;
    return mixHex(this.baseColor, HIT_FLASH.color, this.hitFlashMs / HIT_FLASH.durationMs);
  }

  /**
   * Burns down the hit flash. Subclasses call it from their own `update()`.
   * @param {number} deltaMs
   */
  tickHitFlash(deltaMs) {
    this.hitFlashMs = Math.max(0, this.hitFlashMs - clampDelta(deltaMs));
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
   *
   * Both damage sources — the gesture through `decrementSequence()` and the
   * melee through `stripSymbol()` — funnel through here, which is why the hit
   * flash is armed at this single point rather than at each call site.
   *
   * @returns {string|null} the symbol removed, or null on an empty sequence
   */
  dropFirstSymbol() {
    const symbol = this.nextSymbol;
    if (symbol === null) return null;
    this.sequence = this.sequence.slice(symbol.length);
    this.hitFlashMs = HIT_FLASH.durationMs;
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
