/**
 * The boss turret: a dome centred on the boss with a barrel that tracks the
 * player, and the attack patterns it fires.
 *
 * Hard only — this is what the health bar was always for.
 *
 * Sizes are fractions of `boss.size` rather than pixels, so the turret shrinks
 * with the boss across its three lives (160 → 136 → 112) instead of swallowing
 * it by the last one. Speeds are pixels per 60 Hz frame like everything else;
 * durations are milliseconds.
 */

/** @typedef {"volley"|"laser"|"spiral"|"heavy"} AttackPatternId */

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
   * A quarter turn per second, while tracking between attacks and through a
   * burst.
   *
   * The single most important number here: this is what makes the turret
   * escapable. Uncapped tracking would put every shot on target regardless of
   * how the player moved, and the whole pattern would collapse into "take the
   * damage". **A pattern may override it** — see `LASER`.
   */
  rotationDegPerSecond: 90,
  /** Between two patterns, unless the pattern that just ended names its own. */
  cooldownMs: 2500,
});

/**
 * The ordinary shot. Exactly a mana orb across, so the two read as the same
 * size class and the player already knows how big it is.
 */
export const PROJECTILE = Object.freeze({
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

/** Slower than an aimed shot: a spiral is a wall to walk out of, not a bullet. */
const SPIRAL_SHOT = Object.freeze({
  radius: 10,
  speed: 3,
  damage: 10,
  color: "#FFC15E",
});

/**
 * The one to avoid at all costs: five times the radius, a third of the bar.
 *
 * Slow on purpose. At 120 px/s it takes about five seconds to cross half the
 * board, so it is never a reflex test — it is a piece of ground you may not
 * stand on, drifting towards you.
 */
const HEAVY_SHOT = Object.freeze({
  radius: PROJECTILE.radius * 5,
  speed: 2,
  damage: 50,
  color: "#D2321E",
  /** A bright rim, because size alone reads as "close", not as "lethal". */
  ring: "#FFE066",
});

/** Three shots at 0, 250 and 500 ms — the burst lasts half a second. */
export const VOLLEY = Object.freeze({
  id: "volley",
  shots: 3,
  shotIntervalMs: 250,
  shot: PROJECTILE,
});

export const LASER = Object.freeze({
  id: "laser",
  /**
   * A thin dashed line, no damage, before the beam lands.
   *
   * Without it the beam appears already on top of the player and takes health
   * before there is anything to react to, which makes the slow barrel pointless.
   * Set to 0 to remove the tell.
   */
  chargeMs: 500,
  durationMs: 2000,
  /**
   * The beam sweeps at a sixth of the tracking speed.
   *
   * At the full 90°/s the beam simply stayed on the player: it does not have to
   * predict anything, it only has to keep pointing. Slowing the barrel is what
   * turns a beam into a thing you run out of, and it is why the beam can afford
   * to hurt twice as much as it used to.
   */
  rotationDegPerSecond: 15,
  /** 10/s: two full seconds in the beam costs 20, two projectiles. */
  dps: 10,
  /**
   * The width of the mana gauge (`GAUGE.thickness`), written out because
   * `config/` must not import from `render/`. A test pins the two together.
   */
  beamWidth: 18,
  color: "#FF4D6D",
});

/**
 * The spiral: the barrel stops tracking and sweeps, firing continuously.
 *
 * 405° rather than 360° so the arm does not close on its own start — the last
 * shots fall between the first ones instead of on top of them, which is what
 * leaves a walkable gap rather than a solid ring.
 */
export const SPIRAL = Object.freeze({
  id: "spiral",
  durationMs: 2500,
  shotIntervalMs: 100,
  sweepDegrees: 405,
  shot: SPIRAL_SHOT,
});

export const HEAVY = Object.freeze({
  id: "heavy",
  shots: 1,
  shotIntervalMs: 250,
  shot: HEAVY_SHOT,
  /** Short, as asked — but it is only one roll in five, so roughly every 12 s. */
  cooldownMs: 1500,
});

/** @type {Readonly<Record<AttackPatternId, object>>} */
export const PATTERNS = Object.freeze({
  volley: VOLLEY,
  laser: LASER,
  spiral: SPIRAL,
  heavy: HEAVY,
});

/**
 * Which attacks exist, per phase of the boss fight.
 *
 * Phase 1 is the boss at full lives, 2 after the first, 3 after the second.
 * Weights are relative, so a rare slot is one entry against the volley's share.
 *
 * The volley is in every phase and never changes: it is the baseline the other
 * patterns are read against. The laser is a phase-1 signature that the spiral
 * takes over from in phase 2, and it returns in phase 3 alongside everything
 * else — the last phase is the only one where all four can come.
 */
export const PHASE_PATTERNS = Object.freeze({
  1: Object.freeze([
    Object.freeze({ id: "volley", weight: 4 }),
    Object.freeze({ id: "laser", weight: 1 }),
  ]),
  2: Object.freeze([
    Object.freeze({ id: "volley", weight: 3 }),
    Object.freeze({ id: "spiral", weight: 1 }),
    Object.freeze({ id: "heavy", weight: 1 }),
  ]),
  3: Object.freeze([
    Object.freeze({ id: "volley", weight: 2 }),
    Object.freeze({ id: "spiral", weight: 1 }),
    Object.freeze({ id: "heavy", weight: 1 }),
    Object.freeze({ id: "laser", weight: 1 }),
  ]),
});

export const LAST_PHASE = 3;

/**
 * The pattern table for a phase, clamped.
 *
 * The boss spends a frame at zero lives before the run is won, which would
 * otherwise ask for a phase 4 that does not exist.
 *
 * @param {number} phase
 * @returns {readonly {id: AttackPatternId, weight: number}[]}
 */
export function patternsForPhase(phase) {
  const clamped = Math.min(Math.max(Math.round(phase) || 1, 1), LAST_PHASE);
  return PHASE_PATTERNS[clamped];
}
