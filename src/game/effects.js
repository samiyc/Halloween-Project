import { clampDelta } from "../config/settings.js";

/**
 * Timed effects, keyed by id, each holding its remaining milliseconds.
 *
 * Used for the player's buffs. Re-activating a live effect refreshes it to the
 * full duration rather than stacking, which keeps "how long is left" a single
 * readable number.
 */
export class EffectTracker {
  constructor() {
    /** @type {Map<string, number>} */
    this.remaining = new Map();
  }

  /**
   * @param {string} id
   * @param {number} durationMs
   */
  activate(id, durationMs) {
    if (durationMs <= 0) return;
    this.remaining.set(id, durationMs);
  }

  /**
   * @param {number} deltaMs
   */
  tick(deltaMs) {
    const step = clampDelta(deltaMs);
    for (const [id, left] of this.remaining) {
      const next = left - step;
      if (next <= 0) {
        this.remaining.delete(id);
      } else {
        this.remaining.set(id, next);
      }
    }
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  isActive(id) {
    return this.remaining.has(id);
  }

  /**
   * @param {string} id
   * @returns {number}
   */
  remainingMs(id) {
    return this.remaining.get(id) ?? 0;
  }

  /** @returns {string[]} */
  activeIds() {
    return [...this.remaining.keys()];
  }
}
