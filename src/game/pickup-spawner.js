import { MANA_ORB, SPELL_ORB } from "../config/pickups.js";
import { clampDelta, toFrames } from "../config/settings.js";
import { Pickup } from "../entities/pickup.js";
import { systemRandom } from "../tools/random.js";

/**
 * Drops the blue mana orbs and the yellow spell orbs.
 *
 * Two different rhythms on purpose. Mana orbs roll per frame like enemies do,
 * so they arrive as a steady stream. Spell orbs run off a countdown, because
 * "one every 15 to 20 seconds" is a promise about spacing that a per-frame
 * probability cannot make — it would happily drop two in a row.
 */
export class PickupSpawner {
  /**
   * @param {object} [options]
   * @param {{width: number, height: number}} [options.bounds]
   * @param {import("../tools/random.js").Rng} [options.rng]
   */
  /**
   * @param {object} [options]
   * @param {{width: number, height: number}} [options.bounds]
   * @param {import("../tools/random.js").Rng} [options.rng]
   * @param {{mana?: boolean, spells?: boolean}} [options.drops] Which streams
   *   run at all. Easy has neither: no economy, so nothing to collect.
   */
  constructor({
    bounds = { width: 0, height: 0 },
    rng = systemRandom,
    drops = { mana: true, spells: true },
  } = {}) {
    this.bounds = bounds;
    this.rng = rng;
    this.drops = drops;
    this.spellCountdownMs = this.nextSpellDelay();
  }

  /** @returns {number} */
  nextSpellDelay() {
    return this.rng.range(SPELL_ORB.everyMsMin, SPELL_ORB.everyMsMax);
  }

  /**
   * @param {number} deltaMs
   * @returns {Pickup[]} zero, one or two new pickups
   */
  tick(deltaMs) {
    const dropped = [];

    if (this.drops.mana && this.rng.chance(MANA_ORB.chancePerFrame * toFrames(deltaMs))) {
      dropped.push(this.create(MANA_ORB));
    }

    // The countdown runs either way, so a disabled stream still consumes the
    // same random draws — two runs on one seed stay comparable across modes.
    this.spellCountdownMs -= clampDelta(deltaMs);
    if (this.spellCountdownMs <= 0) {
      this.spellCountdownMs = this.nextSpellDelay();
      if (this.drops.spells) dropped.push(this.create(SPELL_ORB));
    }

    return dropped;
  }

  /**
   * @param {{kind: string, radius: number, color: string, speed: number}} traits
   * @returns {Pickup}
   */
  create(traits) {
    return new Pickup({
      kind: traits.kind,
      x: this.rng.range(traits.radius, Math.max(traits.radius, this.bounds.width - traits.radius)),
      y: -traits.radius,
      traits,
    });
  }
}
