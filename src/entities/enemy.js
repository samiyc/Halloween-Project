import { COMMON_SYMBOLS, RARE_SYMBOLS } from "../config/glyphs.js";
import { FROST_ENEMY_COLOR, SPELLS } from "../config/spells.js";
import { ENEMY, RARE_ENEMY, clampDelta, toFrames } from "../config/settings.js";
import { randomSequence, shuffled, systemRandom } from "../tools/random.js";
import { Entity } from "./entity.js";

/**
 * A falling square. Longer sequences move slower, so a tough enemy also gives
 * you more time — that trade is what `speedPerSymbol` expresses.
 */
export class Enemy extends Entity {
  /**
   * @param {object} [options]
   * @param {number} [options.fieldWidth]
   * @param {import("../tools/random.js").Rng} [options.rng]
   * @param {"common"|"rare"} [options.variant]
   */
  constructor({ fieldWidth = 0, rng = systemRandom, variant = "common" } = {}) {
    const traits = variant === "rare" ? RARE_ENEMY : ENEMY;
    const sequence =
      variant === "rare" ? buildRareSequence(rng) : buildCommonSequence(rng);

    super({
      x: rng.range(0, Math.max(0, fieldWidth - traits.size)),
      y: 0,
      size: traits.size,
      sequence,
    });

    this.variant = variant;
    this.color = traits.color;
    /** Milliseconds of Givre left on this enemy. */
    this.slowRemainingMs = 0;
    this.speed =
      traits.baseSpeed +
      rng.range(0, traits.speedSpread) -
      sequence.length * traits.speedPerSymbol;
  }

  /** Tinted while the Givre holds it, so the effect is readable at a glance. */
  get displayColor() {
    return this.slowRemainingMs > 0 ? FROST_ENEMY_COLOR : this.color;
  }

  /** Speed after the Givre, in pixels per 60 Hz frame. */
  get effectiveSpeed() {
    return this.slowRemainingMs > 0 ? this.speed * SPELLS.frost.slowFactor : this.speed;
  }

  /**
   * Refreshes rather than stacks, so several casts cannot freeze an enemy for
   * a compounding duration.
   * @param {number} durationMs
   */
  applySlow(durationMs) {
    this.slowRemainingMs = Math.max(this.slowRemainingMs, durationMs);
  }

  /**
   * @param {number} deltaMs
   * @param {{ reversed?: boolean }} [context] `reversed` sends enemies back up,
   *   which is what happens once the boss runs out of lives. The old signature
   *   took the boss object and read `boss.lives`, which threw the moment the
   *   boss was absent; a plain flag removes that coupling.
   */
  update(deltaMs, { reversed = false } = {}) {
    this.slowRemainingMs = Math.max(0, this.slowRemainingMs - clampDelta(deltaMs));
    const step = this.effectiveSpeed * toFrames(deltaMs);
    this.y += reversed ? -step : step;
  }

  /**
   * @param {number} fieldHeight
   * @returns {boolean}
   */
  hasEscaped(fieldHeight) {
    return this.y > fieldHeight;
  }
}

/**
 * @param {import("../tools/random.js").Rng} rng
 * @returns {string}
 */
function buildCommonSequence(rng) {
  const length = rng.int(ENEMY.minSequence, ENEMY.maxSequence);
  return randomSequence(rng, length, COMMON_SYMBOLS);
}

/**
 * A rare enemy is a common one with one or two rare symbols shuffled in, so it
 * still needs ordinary gestures as well as the exotic ones.
 * @param {import("../tools/random.js").Rng} rng
 * @returns {string}
 */
function buildRareSequence(rng) {
  const length = rng.int(RARE_ENEMY.minSequence, RARE_ENEMY.maxSequence);
  const rareCount = Math.min(
    length,
    rng.int(RARE_ENEMY.minRareSymbols, RARE_ENEMY.maxRareSymbols),
  );

  const symbols = [];
  for (let index = 0; index < rareCount; index += 1) {
    symbols.push(rng.pick(RARE_SYMBOLS));
  }
  for (let index = rareCount; index < length; index += 1) {
    symbols.push(rng.pick(COMMON_SYMBOLS));
  }
  return shuffled(rng, symbols).join("");
}
