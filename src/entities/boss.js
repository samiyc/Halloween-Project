import { COMMON_SYMBOLS } from "../config/glyphs.js";
import { BOSS, clampDelta, toFrames } from "../config/settings.js";
import { randomSequence, systemRandom } from "../tools/random.js";
import { Entity } from "./entity.js";

/** @type {const} */
export const BOSS_PHASE = Object.freeze({
  /** Parked above the board, waiting out `arrivalDelayMs`, then sliding in. */
  waiting: "waiting",
  descending: "descending",
  retreating: "retreating",
});

/**
 * How many symbols the boss carries at a given number of lives left.
 *
 * It **grows** as lives are spent: 10 at full lives, 13, then 16. Written once
 * because the constructor and `retreat()` both need it, and written from the
 * lives *spent* (`BOSS.lives - lives`) rather than the lives left — the first
 * version multiplied by the lives remaining, so the boss got *shorter* every
 * time it came back and the last phase was the quickest of the three.
 *
 * @param {number} lives
 * @returns {number}
 */
export function sequenceLengthFor(lives) {
  return BOSS.sequenceBase + (BOSS.lives - lives) * BOSS.sequencePerLife;
}

/**
 * The boss is a phase machine, not a bigger enemy.
 *
 *   waiting    -- delay spent, slides in --> descending
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
   * @param {number} [options.arrivalDelayMs] Story levels hold it back so the
   *   opening minute belongs to the ordinary enemies. 0 everywhere else, so the
   *   three training modes are untouched.
   */
  constructor({ fieldWidth = 0, rng = systemRandom, arrivalDelayMs = 0 } = {}) {
    const lives = BOSS.lives;
    super({
      // Kept between 30% and 70% of the field so it never hugs an edge.
      x: rng.range(0.3, 0.7) * fieldWidth,
      // Parked out of sight while it waits; it slides down into the board when
      // its delay runs out.
      y: arrivalDelayMs > 0 ? -BOSS.size : 0,
      size: BOSS.size,
      sequence: randomSequence(rng, sequenceLengthFor(lives), COMMON_SYMBOLS),
    });

    this.rng = rng;
    this.lives = lives;
    this.speed = BOSS.speed;
    this.arrivalMs = arrivalDelayMs;
    this.phase = arrivalDelayMs > 0 ? BOSS_PHASE.waiting : BOSS_PHASE.descending;
    this.color = BOSS.baseColor;
  }

  /** Not on the board yet: nothing should aim at it, or point a marker at it. */
  get isWaiting() {
    return this.phase === BOSS_PHASE.waiting;
  }

  /**
   * Untouchable, and — through `Game` — with its turret held.
   *
   * The arrival reuses this rather than adding a rule of its own: a boss that
   * has not landed cannot be hit by a gesture, cannot be struck by the melee,
   * cannot lose a life, and does not fire. All of it falls out of this getter.
   */
  get isInvincible() {
    return this.phase === BOSS_PHASE.retreating || this.isWaiting;
  }

  /**
   * Which phase of the fight this is: 1 at full lives, then 2, then 3.
   *
   * Counted up from the lives left rather than stored, so it cannot fall out of
   * step with them. The turret reads it to know which attacks it may pick;
   * `Boss` itself does nothing with it, and in particular knows nothing about
   * the turret.
   */
  get phaseNumber() {
    return BOSS.lives - this.lives + 1;
  }

  /** @param {number} deltaMs */
  update(deltaMs) {
    this.tickHitFlash(deltaMs);
    const frames = toFrames(deltaMs);
    if (this.isWaiting) {
      this.arrive(deltaMs, frames);
    } else if (this.isInvincible) {
      this.retreat(frames);
    } else {
      this.y += this.speed * frames;
    }
  }

  /**
   * Counts down the delay, then walks the boss into the board.
   *
   * The entrance borrows `retreatSpeed`, the speed the boss already uses to
   * travel off the board: descending at its own 0.25 px/frame would take ten
   * seconds to clear its own height, and popping into place would read as a
   * glitch. It becomes vulnerable exactly when it lands.
   *
   * @param {number} deltaMs
   * @param {number} frames
   */
  arrive(deltaMs, frames) {
    this.arrivalMs -= clampDelta(deltaMs);
    if (this.arrivalMs > 0) return;

    this.y += BOSS.retreatSpeed * frames;
    if (this.y < 0) return;
    this.y = 0;
    this.phase = BOSS_PHASE.descending;
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
      sequenceLengthFor(this.lives),
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
