/**
 * The player's health, on Hard only.
 *
 * Deliberately the same shape and numbers as `MANA`: the spec asks for a bar
 * "symmetric to the mana bar, same dimensions and values", so both feed the
 * same `Gauge` class and the same drawing code.
 *
 * It starts full and **nothing damages it yet**. The boss attack patterns that
 * would are still to be designed, so Hard currently plays exactly like Normal
 * with an extra bar on screen. That is intentional for this step.
 */
export const HEALTH = Object.freeze({
  max: 150,
  start: 150,
  /** No passive healing: whatever ends up costing health should cost it. */
  regenPerSecond: 0,
});
