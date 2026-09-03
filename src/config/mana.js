import { GLYPHS } from "./glyphs.js";

/**
 * The mana economy.
 *
 * See docs/mana-and-spells.md for the reasoning. The one number worth
 * restating here: an orb is worth 5, not 1. At 1 the passive trickle
 * (2 pts/s) would out-earn collecting every orb on screen (1.35 pts/s), so
 * standing still would beat perfect play and the orbs would be decorative. At 5
 * the ratio inverts — collection is worth 3.4x the trickle — while a cast still
 * costs exactly 2 orbs.
 */
export const MANA = Object.freeze({
  max: 100,
  /** The gauge starts empty: the first cast has to be earned. */
  start: 0,
  /** 1 point every 0.5s. A floor against deadlock, not an income. */
  regenPerSecond: 2,
  /** What one blue orb is worth. */
  orbValue: 5,
  /**
   * Cost of a common glyph: _ | V Ʌ
   *
   * 8, not the 10 that "a cast costs 2 orbs" would give. Measured, not guessed:
   * a bot doing nothing but collecting reaches 57% of the orbs, which caps
   * income at ~5.9 pts/s, while merely keeping pace with the enemy spawn needs
   * 9-18 pts/s. At 10 the run was winnable 4 times out of 10; at 8, 8 times.
   *
   * Cost is by far the stronger lever — dropping it 20% did more than raising
   * the orb drop rate by 33%, because extra orbs you cannot reach are worth
   * nothing. Tune here first, and see docs/mana-and-spells.md for the table.
   */
  costCommon: 8,
  /** Cost of a rare glyph: ⚡ @ — triple, which is what makes melee worthwhile. */
  costRare: 24,
});

/**
 * What casting a glyph costs, read from the glyph registry's own rarity so the
 * two never drift apart.
 *
 * @param {import("./glyphs.js").GlyphId|null} glyphId
 * @param {typeof MANA} [rates]
 * @returns {number} 0 for an unrecognised glyph, which is therefore free
 */
export function castCost(glyphId, rates = MANA) {
  const glyph = GLYPHS[glyphId];
  if (!glyph) return 0;
  return glyph.rarity === "rare" ? rates.costRare : rates.costCommon;
}
