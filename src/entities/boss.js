import { COMMON_SYMBOLS } from "../config/glyphs.js";
import { BOSS, toFrames } from "../config/settings.js";
import { randomSequence, systemRandom } from "../tools/random.js";
import { Entity } from "./entity.js";

/** @type {const} */
export const BOSS_PHASE = Object.freeze({
  descending: "descending",
  retreating: "retreating",
});

/**
 * The boss is a phase machine, not a bigger enemy.
 *
 *   descending -- sequence cleared --> retreating (invincible, moves up)
 *   retreating -- reaches the top   --> descending (longer sequence, smaller, faster)
 *
 * Each cycle costs a life and makes the fight harder: the sequence grows by
 * `sequencePerLife`, the body shrinks by `shrinkPerLife`, and the descent
 * speeds up by `speedGainPerLife`. It is only truly defeated once it is out of
 * the retreat phase with no lives left — dying mid-retreat would let it vanish
 * while still on screen.
 */
export class Boss extends Entity {
  /**
   * @param {object} [options]
   * @param {number} [options.fieldWidth]
   * @param {import("../tools/random.js").Rng} [options.rng]
   */
  constructor({ fieldWidth = 0, rng = systemRandom } = {}) {
    const lives = BOSS.lives;
    super({
      // Kept between 30% and 70% of the field so it never hugs an edge.
      x: rng.range(0.3, 0.7) * fieldWidth,
      y: 0,
      size: BOSS.size,
      sequence: randomSequence(
        rng,
        BOSS.sequenceBase + lives * BOSS.sequencePerLife,
        COMMON_SYMBOLS,
      ),
    });

    this.rng = rng;
    this.lives = lives;
    this.speed = BOSS.speed;
    this.phase = BOSS_PHASE.descending;
    this.color = BOSS.baseColor;
  }

  get isInvincible() {
    return this.phase === BOSS_PHASE.retreating;
  }

  /** @param {number} deltaMs */
  update(deltaMs) {
    this.tickHitFlash(deltaMs);
    const frames = toFrames(deltaMs);
    if (this.isInvincible) {
      this.retreat(frames);
    } else {
      this.y += this.speed * frames;
    }
  }

  /** @param {number} frames */
  retreat(frames) {
    this.y -= BOSS.retreatSpeed * frames;
    if (this.y > 0) return;

    this.y = 0;
    this.phase = BOSS_PHASE.descending;
    this.color = BOSS.baseColor;
    this.size -= BOSS.shrinkPerLife;
    this.sequence = randomSequence(
      this.rng,
      BOSS.sequenceBase + this.lives * BOSS.sequencePerLife,
      COMMON_SYMBOLS,
    );
  }

  /**
   * Call after any hit. Spends a life and starts the retreat when the sequence
   * has just been cleared.
   * @returns {boolean} whether a life was spent this call
   */
  resolveClearedSequence() {
    if (this.isInvincible || !this.isDefeated()) return false;

    this.lives -= 1;
    this.phase = BOSS_PHASE.retreating;
    this.color = BOSS.invincibleColor;
    this.speed += BOSS.speedGainPerLife;
    return true;
  }

  /**
   * Invincibility also blocks the melee auto-attack, so this overrides the
   * base implementation rather than letting positioning bypass the phase.
   * @returns {string|null}
   */
  stripSymbol() {
    return this.isInvincible ? null : super.stripSymbol();
  }

  isDefeatedForGood() {
    return !this.isInvincible && this.lives < 1;
  }

  /**
   * @param {number} fieldHeight
   * @returns {boolean}
   */
  hasEscaped(fieldHeight) {
    return this.y > fieldHeight;
  }
}
