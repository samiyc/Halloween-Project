/**
 * The two things that fall besides enemies.
 *
 * Speeds are in pixels per 60 Hz frame, like every other speed in the project,
 * and rates are per 60 Hz frame like `SPAWN.chancePerFrame`.
 */

/** @typedef {"mana"|"spell"} PickupKind */

export const PICKUP_KIND = Object.freeze({
  mana: "mana",
  spell: "spell",
});

export const MANA_ORB = Object.freeze({
  kind: PICKUP_KIND.mana,
  /** Half a grey cube (40px) across, so 10px of radius. */
  radius: 10,
  color: "#4FA8FF",
  /**
   * 1.5x the average enemy speed (0.7) and 1.5x their spawn rate (0.015).
   * Fast and plentiful on purpose: the player is meant to be constantly moving.
   */
  speed: 1.05,
  chancePerFrame: 0.0225,
});

export const SPELL_ORB = Object.freeze({
  kind: PICKUP_KIND.spell,
  radius: 14,
  color: "#FFD447",
  /**
   * Slower than a mana orb. It is rare and it matters, so it has to be
   * reachable from wherever the player happens to be standing.
   */
  speed: 0.7,
  /** One drop every 15 to 20 seconds. */
  everyMsMin: 15_000,
  everyMsMax: 20_000,
});

/**
 * How close a pickup's centre must be to the player's centre to be taken.
 * Generous by design — chasing a 20px dot with pixel precision is not the
 * skill this system is testing.
 */
export const PICKUP_MAGNET_PADDING = 10;
