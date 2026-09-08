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
  ring: "#FFD86E",
});

/**
 * Five shots 200 ms apart — the burst lasts 0.8 s and costs half the bar if
 * every one of them lands. It is the attack the other three are read against.
 */
export const VOLLEY = Object.freeze({
  id: "volley",
  shots: 5,
  shotIntervalMs: 200,
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
   * The beam sweeps at a ninth of the tracking speed.
   *
   * At the full 90°/s the beam simply stayed on the player: it does not have to
   * predict anything, it only has to keep pointing. Slowing the barrel is what
   * turns a beam into a thing you run out of, and it is why the beam can afford
   * to hurt three times what a projectile does.
   */
  rotationDegPerSecond: 10,
  /** 15/s: two full seconds in the beam costs 30, three projectiles. */
  dps: 15,
  /**
   * Wider than the mana gauge it was once pinned to (`GAUGE.thickness`, 18).
   *
   * The two were equal because the original sketch asked for it; the beam has
   * since become a threat setting of its own and was widened to read as one. A
   * test only keeps it from falling *below* the gauge, which is the width that
   * was proven legible on the board.
   */
  beamWidth: 22,
  color: "#FF4D6D",
});

/**
 * The spiral: the barrel stops tracking and sweeps, firing continuously.
 *
 * 380° rather than 360° so the arm does not close on its own start — the last
 * shots fall between the first ones instead of on top of them, which is what
 * leaves a walkable gap rather than a solid ring.
 *
 * 253°/s and a shot every 35 ms: about 43 projectiles thrown across the board
 * in a second and a half. It is the densest thing the boss does, and the reason
 * it belongs to the last phase.
 */
export const SPIRAL = Object.freeze({
  id: "spiral",
  durationMs: 1500,
  shotIntervalMs: 35,
  sweepDegrees: 380,
  shot: SPIRAL_SHOT,
});

/**
 * Three drifting discs, 800 ms apart: a barrage of ground you may not stand on,
 * rather than the single disc it started as.
 */
export const HEAVY = Object.freeze({
  id: "heavy",
  shots: 3,
  shotIntervalMs: 800,
  shot: HEAVY_SHOT,
  /** Its own, shorter than the shared 2500 — and in phase 2 it is one roll in two. */
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
 * The volley is the baseline, and the escalation is that the boss **stops
 * using it**: two rolls in three in phase 1, one in two in phase 2, and gone in
 * phase 3, which is nothing but the two rare attacks. An earlier version kept
 * it in all three phases as a constant to read the others against; playing it
 * showed the opposite is what makes the last life feel like one.
 */
export const PHASE_PATTERNS = Object.freeze({
  1: Object.freeze([
    Object.freeze({ id: "volley", weight: 2 }),
    Object.freeze({ id: "laser", weight: 1 }),
  ]),
  2: Object.freeze([
    Object.freeze({ id: "volley", weight: 1 }),
    Object.freeze({ id: "heavy", weight: 1 }),
  ]),
  3: Object.freeze([
    Object.freeze({ id: "spiral", weight: 1 }),
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
