import { clampDelta } from "../config/settings.js";
import { LASER, PATTERNS, TURRET, patternsForPhase } from "../config/turret.js";
import { angleTo, normalizeAngle, pointOnRay, turnToward } from "../tools/aim.js";
import { systemRandom, weightedPick } from "../tools/random.js";
import { Projectile } from "./projectile.js";

/** @type {const} */
export const TURRET_PHASE = Object.freeze({
  idle: "idle",
  firing: "firing",
  charge: "charge",
  beam: "beam",
});

const DEGREES = Math.PI / 180;

/**
 * The boss turret: a barrel that tracks the player and picks an attack.
 *
 *   idle --(cooldown spent)--> firing : shots on a cadence --> idle
 *                          \-> charge : the tell --> beam --> idle
 *
 * Which attacks it can pick comes from the boss's phase, not from the turret:
 * `patternsForPhase()` in the config owns that table.
 *
 * Aiming and firing are separate, and both stop while the boss is invincible.
 * A frozen barrel on a greyed dome is the tell that the boss is between lives —
 * an earlier version kept turning through the retreat, which read as a threat
 * that could not actually fire.
 *
 * It knows nothing about the boss beyond a centre, a size and a phase handed to
 * it each frame. `Game` owns it rather than `Boss` for the same reason enemies
 * no longer reach into the boss: the turret needs the player, and the boss must
 * not learn about the player to give it one.
 */
export class Turret {
  /**
   * @param {object} [options]
   * @param {import("../tools/random.js").Rng} [options.rng]
   * @param {typeof TURRET} [options.traits]
   * @param {(phase: number) => readonly {id: string, weight: number}[]} [options.patternsFor]
   *   Injected like the generator, so a test can force one attack.
   */
  constructor({ rng = systemRandom, traits = TURRET, patternsFor = patternsForPhase } = {}) {
    this.rng = rng;
    this.traits = traits;
    this.patternsFor = patternsFor;
    /** Radians. Starts pointing down the board, where the player is. */
    this.angle = Math.PI / 2;
    this.phase = TURRET_PHASE.idle;
    this.phaseMs = traits.cooldownMs;
    /** The attack in progress, or null between them. */
    this.pattern = null;
    this.shotsLeft = 0;
    this.shotTimerMs = 0;
    /** -1 or 1 while the barrel spins blind; 0 while it tracks the player. */
    this.sweepSign = 0;
    this.sweepRate = 0;
    /** True while the boss is invincible: barrel frozen, dome greyed. */
    this.isDisarmed = false;
    /** @type {{x: number, y: number, angle: number, width: number}|null} */
    this.beam = null;
  }

  /** The dashed tell, before the beam itself. */
  get isCharging() {
    return this.phase === TURRET_PHASE.charge;
  }

  /**
   * Degrees per second right now.
   *
   * Three sources, in order: a sweep's own derived rate, then the pattern's
   * override (the laser crawls at 15), then the tracking speed.
   */
  get rotationDegPerSecond() {
    if (this.sweepSign !== 0) return this.sweepRate;
    return this.pattern?.rotationDegPerSecond ?? this.traits.rotationDegPerSecond;
  }

  /**
   * Advances one frame.
   *
   * @param {number} deltaMs
   * @param {object} context
   * @param {{x: number, y: number, size: number}} context.origin  Boss centre and side.
   * @param {{x: number, y: number}} context.target                Player centre.
   * @param {boolean} [context.canFire]  False while the boss is invincible.
   * @param {number} [context.phase]     1, 2 or 3 — which table to pick from.
   * @returns {Projectile[]} whatever was fired this frame; `beam` is on `this`
   */
  update(deltaMs, { origin, target, canFire = true, phase = 1 }) {
    this.isDisarmed = !canFire;
    if (!canFire) {
      this.standDown();
      return [];
    }

    this.aim(deltaMs, origin, target);
    this.phaseMs -= clampDelta(deltaMs);
    const shots = this.fireDueShots(deltaMs, origin);
    if (this.isPhaseOver()) this.enterNextPhase(phase);

    this.beam = this.phase === TURRET_PHASE.beam ? this.beamFrom(origin) : null;
    return shots;
  }

  /**
   * Turns the barrel: either tracking the player, or sweeping blind.
   *
   * A sweeping pattern ignores the target entirely — that is the whole point of
   * the spiral. Everything else turns towards the player, capped.
   *
   * @param {number} deltaMs
   * @param {{x: number, y: number}} origin
   * @param {{x: number, y: number}} target
   */
  aim(deltaMs, origin, target) {
    const seconds = clampDelta(deltaMs) / 1000;
    const step = this.rotationDegPerSecond * DEGREES * seconds;

    if (this.sweepSign !== 0) {
      this.angle = normalizeAngle(this.angle + this.sweepSign * step);
      return;
    }
    this.angle = turnToward(this.angle, angleTo(origin, target), step);
  }

  /**
   * Holds fire, freezes the barrel, and forgets whatever was in progress.
   *
   * Re-arming the full cooldown is intentional: the boss coming back from a
   * retreat gives one clear beat before it starts shooting again.
   */
  standDown() {
    this.beam = null;
    this.shotsLeft = 0;
    this.sweepSign = 0;
    this.pattern = null;
    this.enter(TURRET_PHASE.idle, this.traits.cooldownMs);
  }

  /**
   * The shots whose moment arrived this frame.
   *
   * A loop rather than one shot per frame: at 100 ms apart a stalled frame can
   * cover several, and dropping them would silently thin out a spiral.
   *
   * @param {number} deltaMs
   * @param {{x: number, y: number, size: number}} origin
   * @returns {Projectile[]}
   */
  fireDueShots(deltaMs, origin) {
    if (this.phase !== TURRET_PHASE.firing) return [];

    const shots = [];
    this.shotTimerMs -= clampDelta(deltaMs);
    while (this.shotsLeft > 0 && this.shotTimerMs <= 0) {
      shots.push(this.shoot(origin));
      this.shotsLeft -= 1;
      this.shotTimerMs += this.pattern.shotIntervalMs;
    }
    return shots;
  }

  /**
   * One shot, leaving the muzzle along the current angle.
   *
   * Fired at wherever the barrel points *now*, not at a stored aim: the barrel
   * keeps tracking through a burst, so a moving player makes the three shots
   * fan out on their own. The spread is the tracking, not a parameter.
   *
   * @param {{x: number, y: number, size: number}} origin
   * @returns {Projectile}
   */
  shoot(origin) {
    const muzzle = this.muzzle(origin);
    return new Projectile({
      x: muzzle.x,
      y: muzzle.y,
      angle: this.angle,
      traits: this.pattern.shot,
    });
  }

  /**
   * The end of the barrel, so nothing is born under the dome.
   * @param {{x: number, y: number, size: number}} origin
   * @returns {{x: number, y: number}}
   */
  muzzle(origin) {
    const reach = origin.size * this.traits.cannonRatio;
    return pointOnRay({ x: origin.x, y: origin.y, angle: this.angle }, reach);
  }

  /**
   * @param {{x: number, y: number, size: number}} origin
   * @returns {{x: number, y: number, angle: number, width: number}}
   */
  beamFrom(origin) {
    return { ...this.muzzle(origin), angle: this.angle, width: LASER.beamWidth };
  }

  /**
   * A counted burst ends when its last shot has left; the rest end on a clock.
   *
   * Counting shots rather than running a `shots x interval` timer alongside
   * them is not a detail: the two drifted by one frame and the third shot of
   * every volley was swallowed by the phase change.
   *
   * @returns {boolean}
   */
  isPhaseOver() {
    if (this.phase === TURRET_PHASE.firing && this.pattern.shots !== undefined) {
      return this.shotsLeft === 0;
    }
    return this.phaseMs <= 0;
  }

  /** @param {string} phase */
  enter(phase, durationMs) {
    this.phase = phase;
    this.phaseMs = durationMs;
  }

  /** @param {number} bossPhase */
  enterNextPhase(bossPhase) {
    if (this.phase === TURRET_PHASE.idle) return this.startPattern(bossPhase);
    if (this.phase === TURRET_PHASE.charge) {
      return this.enter(TURRET_PHASE.beam, LASER.durationMs);
    }
    return this.rest();
  }

  /** Back to idle, for the cooldown the pattern that just ended asks for. */
  rest() {
    const cooldownMs = this.pattern?.cooldownMs ?? this.traits.cooldownMs;
    this.sweepSign = 0;
    this.pattern = null;
    return this.enter(TURRET_PHASE.idle, cooldownMs);
  }

  /**
   * Rolls the next attack from the phase's table and sets it up.
   * @param {number} bossPhase
   */
  startPattern(bossPhase) {
    this.pattern = PATTERNS[weightedPick(this.rng, this.patternsFor(bossPhase))];
    this.sweepSign = 0;

    if (this.pattern === PATTERNS.laser) return this.enter(TURRET_PHASE.charge, LASER.chargeMs);
    if (this.pattern.sweepDegrees !== undefined) return this.startSweep();

    this.shotsLeft = this.pattern.shots;
    this.shotTimerMs = 0;
    // No deadline: a counted burst is over when its shots are, see `isPhaseOver()`.
    return this.enter(TURRET_PHASE.firing, Number.POSITIVE_INFINITY);
  }

  /**
   * A spiral: the barrel spins blind and fires on a cadence for a fixed time.
   *
   * The direction is rolled, so the arm cannot be learned once and dodged the
   * same way every run. The rate is derived from the sweep and the duration
   * rather than written twice — 405° over 2.5 s is 162°/s, and stating both
   * would let them drift apart.
   */
  startSweep() {
    const { sweepDegrees, durationMs } = this.pattern;
    this.sweepSign = this.rng.chance(0.5) ? 1 : -1;
    this.sweepRate = (sweepDegrees / durationMs) * 1000;
    // Unbounded: the clock ends this one, not a shot budget.
    this.shotsLeft = Number.POSITIVE_INFINITY;
    this.shotTimerMs = 0;
    return this.enter(TURRET_PHASE.firing, durationMs);
  }
}
