import { HIT_FLASH, clampDelta } from "../config/settings.js";
import { mixHex } from "./color.js";

/**
 * The "something just took damage" flash, as two free functions.
 *
 * `Entity` and `Player` both need it and share no ancestor — the player carries
 * no glyph sequence, so making it an `Entity` would hand it members that mean
 * nothing. Rather than copy the countdown into both, the logic lives here and
 * each holds its own `hitFlashMs` field, the way every timer in this codebase
 * is held by whoever owns it.
 *
 * White means the same thing everywhere in this game: that square just took a
 * hit. Using a different colour for the player would say something else.
 */

/**
 * Burns down a flash countdown by one frame.
 *
 * Clamped like every other delta consumer: a backgrounded tab must not end a
 * flash it never drew.
 *
 * @param {number} remainingMs
 * @param {number} deltaMs
 * @returns {number} never negative
 */
export function tickFlash(remainingMs, deltaMs) {
  return Math.max(0, remainingMs - clampDelta(deltaMs));
}

/**
 * A colour with the flash blended over it.
 *
 * Full flash at the instant of impact, fading back as the countdown empties —
 * instant on the way in, gradual on the way out. An eased attack would blur
 * the very frame being confirmed.
 *
 * @param {string} baseColor  What it fades back to.
 * @param {number} remainingMs
 * @returns {string}
 */
export function flashOver(baseColor, remainingMs) {
  if (remainingMs <= 0) return baseColor;
  return mixHex(baseColor, HIT_FLASH.color, remainingMs / HIT_FLASH.durationMs);
}
