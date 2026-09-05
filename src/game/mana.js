import { MANA } from "../config/mana.js";
import { clampDelta } from "../config/settings.js";

/**
 * The mana gauge.
 *
 * Deliberately dumb: it holds a number, and refuses to go below zero or above
 * `max`. Deciding what a cast costs belongs to `castCost()`; deciding whether a
 * cast happens belongs to `Game`.
 */
export class ManaPool {
  /** @param {typeof MANA} [rates] */
  constructor(rates = MANA) {
    this.rates = rates;
    this.value = rates.start;
  }

  /** 0 to 1, for the gauge. */
  get ratio() {
    return this.rates.max === 0 ? 0 : this.value / this.rates.max;
  }

  /**
   * Passive trickle. Goes through `clampDelta` like everything else that
   * consumes a frame delta — otherwise a backgrounded tab would hand it several
   * seconds at once and refill the gauge for free.
   * @param {number} deltaMs
   */
  regenerate(deltaMs) {
    const seconds = clampDelta(deltaMs) / 1000;
    this.gain(this.rates.regenPerSecond * seconds);
  }

  /** @param {number} amount */
  gain(amount) {
    if (amount <= 0) return;
    this.value = Math.min(this.rates.max, this.value + amount);
  }

  /**
   * @param {number} cost
   * @returns {boolean}
   */
  canAfford(cost) {
    return this.value >= cost;
  }

  /**
   * Spends only if the whole cost is available — never partially.
   * @param {number} cost
   * @returns {boolean} whether the cost was paid
   */
  spend(cost) {
    if (!this.canAfford(cost)) return false;
    this.value -= cost;
    return true;
  }
}
