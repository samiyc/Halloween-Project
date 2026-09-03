import { SPAWN, toFrames } from "../config/settings.js";
import { Enemy } from "../entities/enemy.js";
import { systemRandom } from "../tools/random.js";

/**
 * Decides when an enemy appears and which kind.
 *
 * The spawn roll is scaled by the frame delta so the rate stays at
 * `chancePerFrame` per 60 Hz frame no matter the monitor. The old code rolled
 * once per animation frame, which meant a 144 Hz display spawned 2.4x as many
 * enemies as a 60 Hz one.
 */
export class Spawner {
  /**
   * @param {object} [options]
   * @param {{width: number, height: number}} [options.bounds]
   * @param {import("../tools/random.js").Rng} [options.rng]
   * @param {typeof SPAWN} [options.rates]
   */
  constructor({ bounds = { width: 0, height: 0 }, rng = systemRandom, rates = SPAWN } = {}) {
    this.bounds = bounds;
    this.rng = rng;
    this.rates = rates;
  }

  /**
   * @param {number} deltaMs
   * @returns {Enemy|null}
   */
  tick(deltaMs) {
    const chance = this.rates.chancePerFrame * toFrames(deltaMs);
    return this.rng.chance(chance) ? this.create() : null;
  }

  /** @returns {Enemy} */
  create() {
    const variant = this.rng.chance(this.rates.rareShare) ? "rare" : "common";
    return new Enemy({ fieldWidth: this.bounds.width, rng: this.rng, variant });
  }
}
