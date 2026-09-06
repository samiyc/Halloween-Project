/**
 * The boss turret: a circle centred on the boss with a barrel that tracks the
 * player, and the two attack patterns it fires.
 *
 * Hard only — this is what the health bar was always for.
 *
 * Sizes are fractions of `boss.size` rather than pixels, so the turret shrinks
 * with the boss across its three lives (160 → 136 → 112) instead of swallowing
 * it by the last one. Speeds are pixels per 60 Hz frame like everything else;
 * durations are milliseconds.
 */

/** @typedef {"volley"|"laser"} AttackPatternId */

export const TURRET = Object.freeze({
  /** Radius of the dome, as a fraction of the boss square. */
  circleRatio: 0.3,
  /**
   * Barrel length from the boss centre outward.
   *
   * Longer than `circleRatio` so the barrel clearly emerges from under the
   * dome — that overhang is what makes the aim readable at a glance, and it is
   * also where shots are born, rather than at the centre.
   */
  cannonRatio: 0.55,
  cannonWidthRatio: 0.14,
  /**
   * A quarter turn per second.
   *
   * The single most important number here: this is what makes the turret
   * escapable. Uncapped tracking would put every shot on target regardless of
   * how the player moved, and the whole pattern would collapse into "take the
   * damage". Tune this first.
   */
  rotationDegPerSecond: 90,
  /** Between two patterns, whichever just finished. */
  cooldownMs: 2500,
  /**
   * Relative weights, not probabilities. The laser is deliberately one attack
   * in five: it denies ground for two seconds, which would be exhausting as the
   * default and is memorable as the exception.
   */
  patterns: Object.freeze([
    Object.freeze({ id: "volley", weight: 4 }),
    Object.freeze({ id: "laser", weight: 1 }),
  ]),
});

export const PROJECTILE = Object.freeze({
  /** Exactly a mana orb, so the two read as the same size class. */
  radius: 10,
  /**
   * 360 px/s: about 1.5 s to cross half the board. Fast enough to punish
   * standing still, slow enough that a shot fired at where you *were* misses.
   */
  speed: 6,
  /** 10 of 150: a full burst that connects costs a fifth of the bar. */
  damage: 10,
  color: "#FF9A3C",
});

export const VOLLEY = Object.freeze({
  shots: 3,
  /** Three shots at 0, 250 and 500 ms — the burst lasts half a second. */
  shotIntervalMs: 250,
});

export const LASER = Object.freeze({
  /**
   * A thin dashed line, no damage, before the beam lands.
   *
   * Without it the beam appears already on top of the player and takes health
   * before there is anything to react to, which makes the slow barrel pointless.
   * Set to 0 to remove the tell.
   */
  chargeMs: 500,
  durationMs: 2000,
  /** 5/s: two full seconds in the beam costs 10, exactly one projectile. */
  dps: 5,
  /**
   * The width of the mana gauge (`GAUGE.thickness`), written out because
   * `config/` must not import from `render/`. A test pins the two together.
   */
  beamWidth: 18,
  color: "#FF4D6D",
});
