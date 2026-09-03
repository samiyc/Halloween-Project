import { PLAYER, clampDelta, toFrames } from "../config/settings.js";

/**
 * The green square. Moved with ZQSD (and the arrow keys), it is the positional
 * half of the game's two-handed focus: the mouse casts glyph gestures anywhere
 * on screen with no range limit, while the player must physically close the
 * distance for its melee auto-attack to reach.
 *
 * The melee fires on a timer with no click and no key press — see
 * `game/combat.js` for the targeting.
 */
export class Player {
  /**
   * @param {object} [options]
   * @param {number} [options.x]
   * @param {number} [options.y]
   * @param {typeof PLAYER} [options.traits]
   */
  constructor({ x = 0, y = 0, traits = PLAYER } = {}) {
    this.traits = traits;
    this.size = traits.size;
    this.color = traits.color;
    this.x = x;
    this.y = y;
    /** Milliseconds until the next auto-attack. */
    this.meleeCooldownMs = traits.meleeCooldownMs;
  }

  get centerX() {
    return this.x + this.size / 2;
  }

  get centerY() {
    return this.y + this.size / 2;
  }

  get meleeRange() {
    return this.traits.meleeRange;
  }

  /** 0 when ready to strike, 1 right after striking. */
  get meleeChargeRatio() {
    return this.meleeCooldownMs / this.traits.meleeCooldownMs;
  }

  /**
   * @param {number} deltaMs
   * @param {{x: number, y: number}} direction  Each component in [-1, 1].
   * @param {{width: number, height: number}} bounds
   */
  update(deltaMs, direction, bounds) {
    const frames = toFrames(deltaMs);
    // Clamped like the movement above: an unclamped delta after a tab switch
    // would recharge the melee instantly instead of after the real 1.5s.
    this.meleeCooldownMs = Math.max(0, this.meleeCooldownMs - clampDelta(deltaMs));
    this.move(direction, frames, bounds);
  }

  /**
   * Diagonal input is normalised, otherwise moving on two axes at once would be
   * ~1.41x faster than moving on one.
   * @param {{x: number, y: number}} direction
   * @param {number} frames
   * @param {{width: number, height: number}} bounds
   */
  move(direction, frames, bounds) {
    const magnitude = Math.hypot(direction.x, direction.y);
    if (magnitude === 0) return;

    const step = (this.traits.speed * frames) / magnitude;
    this.x = clamp(this.x + direction.x * step, 0, bounds.width - this.size);
    this.y = clamp(this.y + direction.y * step, 0, bounds.height - this.size);
  }

  isMeleeReady() {
    return this.meleeCooldownMs <= 0;
  }

  startMeleeCooldown() {
    this.meleeCooldownMs = this.traits.meleeCooldownMs;
  }

  /**
   * @param {{centerX: number, centerY: number}} target
   * @returns {number}
   */
  distanceTo(target) {
    return Math.hypot(target.centerX - this.centerX, target.centerY - this.centerY);
  }
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
