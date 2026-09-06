import { HIT_FLASH, PLAYER, clampDelta, toFrames } from "../config/settings.js";
import { SPELLS } from "../config/spells.js";
import { EffectTracker } from "../game/effects.js";
import { flashOver, tickFlash } from "../tools/hit-flash.js";

/**
 * The green square. Moved with ZQSD (and the arrow keys), it is the positional
 * half of the game's two-handed focus: the mouse casts glyph gestures anywhere
 * on screen with no range limit, while the player must physically close the
 * distance for its melee auto-attack to reach — and, more importantly, must
 * roam to collect the mana those gestures spend.
 *
 * Movement speed and melee cadence are read through `effectiveSpeed` and
 * `effectiveMeleeCooldownMs` rather than straight off `traits`, because the
 * Célérité and Frénésie buffs modulate them.
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
    this.effects = new EffectTracker();
    /** Milliseconds left on the damage blink; see `displayColor`. */
    this.hitFlashMs = 0;
    /** Milliseconds until the next auto-attack. */
    this.meleeCooldownMs = traits.meleeCooldownMs;
    /**
     * The duration the current cooldown started from. Kept separately so that
     * activating Frénésie mid-cooldown cannot push `meleeChargeRatio` above 1.
     */
    this.meleeCooldownTotalMs = traits.meleeCooldownMs;
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

  /**
   * Green normally, washed pale for a moment after taking a hit.
   *
   * The same white as an enemy losing a symbol, on purpose: in this game white
   * means "that just took damage", whichever side it belongs to. A red blink
   * would read as a different event.
   */
  get displayColor() {
    return flashOver(this.color, this.hitFlashMs);
  }

  /** Called when something lands on the player. There are no i-frames. */
  takeHit() {
    this.hitFlashMs = HIT_FLASH.durationMs;
  }

  /** Pixels per 60 Hz frame, after buffs. */
  get effectiveSpeed() {
    const boost = this.effects.isActive(SPELLS.haste.id)
      ? SPELLS.haste.moveSpeedMultiplier
      : 1;
    return this.traits.speed * boost;
  }

  /** Milliseconds between auto-attacks, after buffs. */
  get effectiveMeleeCooldownMs() {
    const boost = this.effects.isActive(SPELLS.frenzy.id)
      ? SPELLS.frenzy.attackSpeedMultiplier
      : 1;
    return this.traits.meleeCooldownMs / boost;
  }

  /** 0 when ready to strike, 1 right after striking. */
  get meleeChargeRatio() {
    if (this.meleeCooldownTotalMs <= 0) return 0;
    return this.meleeCooldownMs / this.meleeCooldownTotalMs;
  }

  /**
   * @param {number} deltaMs
   * @param {{x: number, y: number}} direction  Each component in [-1, 1].
   * @param {{width: number, height: number}} bounds
   */
  update(deltaMs, direction, bounds) {
    const frames = toFrames(deltaMs);
    this.effects.tick(deltaMs);
    this.hitFlashMs = tickFlash(this.hitFlashMs, deltaMs);
    // Clamped like the movement below: an unclamped delta after a tab switch
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

    const step = (this.effectiveSpeed * frames) / magnitude;
    this.x = clamp(this.x + direction.x * step, 0, bounds.width - this.size);
    this.y = clamp(this.y + direction.y * step, 0, bounds.height - this.size);
  }

  isMeleeReady() {
    return this.meleeCooldownMs <= 0;
  }

  startMeleeCooldown() {
    this.meleeCooldownTotalMs = this.effectiveMeleeCooldownMs;
    this.meleeCooldownMs = this.meleeCooldownTotalMs;
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
