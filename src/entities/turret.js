import { clampDelta } from "../config/settings.js";
import { LASER, PROJECTILE, TURRET, VOLLEY } from "../config/turret.js";
import { angleTo, pointOnRay, turnToward } from "../tools/aim.js";
import { systemRandom, weightedPick } from "../tools/random.js";
import { Projectile } from "./projectile.js";

/** @type {const} */
export const TURRET_PHASE = Object.freeze({
  idle: "idle",
  volley: "volley",
  charge: "charge",
  beam: "beam",
});

const DEGREES = Math.PI / 180;

/**
 * The boss turret: a barrel that tracks the player and picks an attack.
 *
 *   idle --(cooldown spent)--> volley : 3 shots, 250 ms apart --> idle
 *                          \-> charge : 500 ms tell --> beam : 2 s --> idle
 *
 * Aiming and firing are deliberately separate. The barrel turns on **every**
 * frame, including while the boss retreats; only the trigger is gated. A barrel
 * that froze mid-retreat would snap back the instant the boss returned, and the
 * player would have no way to read where the next shot is going.
 *
 * It knows nothing about the boss beyond a centre and a size handed to it each
 * frame. `Game` owns it rather than `Boss` for the same reason enemies no
 * longer reach into the boss: the turret needs the player, and the boss must
 * not learn about the player to give it one.
 */
export class Turret {
  /**
   * @param {object} [options]
   * @param {import("../tools/random.js").Rng} [options.rng]
   * @param {typeof TURRET} [options.traits]
   */
  constructor({ rng = systemRandom, traits = TURRET } = {}) {
    this.rng = rng;
    this.traits = traits;
    /** Radians. Starts pointing down the board, where the player is. */
    this.angle = Math.PI / 2;
    this.phase = TURRET_PHASE.idle;
    this.phaseMs = traits.cooldownMs;
    this.shotsLeft = 0;
    this.shotTimerMs = 0;
    /** @type {{x: number, y: number, angle: number, width: number}|null} */
    this.beam = null;
  }

  /** The dashed tell, before the beam itself. */
  get isCharging() {
    return this.phase === TURRET_PHASE.charge;
  }

  /**
   * Advances one frame.
   *
   * @param {number} deltaMs
   * @param {object} context
   * @param {{x: number, y: number, size: number}} context.origin  Boss centre and side.
   * @param {{x: number, y: number}} context.target                Player centre.
   * @param {boolean} [context.canFire]  False while the boss is invincible.
   * @returns {Projectile[]} whatever was fired this frame; `beam` is on `this`
   */
  update(deltaMs, { origin, target, canFire = true }) {
    this.aim(deltaMs, origin, target);
    if (!canFire) {
      this.standDown();
      return [];
    }

    this.phaseMs -= clampDelta(deltaMs);
    const shots = this.fireDueShots(deltaMs, origin);
    if (this.isPhaseOver()) this.enterNextPhase();

    this.beam = this.phase === TURRET_PHASE.beam ? this.beamFrom(origin) : null;
    return shots;
  }

  /**
   * Turns towards the player, by at most one frame's worth of rotation.
   * @param {number} deltaMs
   * @param {{x: number, y: number}} origin
   * @param {{x: number, y: number}} target
   */
  aim(deltaMs, origin, target) {
    const seconds = clampDelta(deltaMs) / 1000;
    const maxStep = this.traits.rotationDegPerSecond * DEGREES * seconds;
    this.angle = turnToward(this.angle, angleTo(origin, target), maxStep);
  }

  /**
   * Holds fire and forgets whatever was in progress.
   *
   * Re-arming the full cooldown is intentional: the boss coming back from a
   * retreat gives one clear beat before it starts shooting again.
   */
  standDown() {
    this.beam = null;
    this.shotsLeft = 0;
    this.enter(TURRET_PHASE.idle, this.traits.cooldownMs);
  }

  /**
   * The shots whose moment arrived this frame.
   *
   * A loop rather than one shot per frame: at 250 ms apart a stalled frame can
   * cover two, and dropping one would silently shorten the burst.
   *
   * @param {number} deltaMs
   * @param {{x: number, y: number, size: number}} origin
   * @returns {Projectile[]}
   */
  fireDueShots(deltaMs, origin) {
    if (this.phase !== TURRET_PHASE.volley) return [];

    const shots = [];
    this.shotTimerMs -= clampDelta(deltaMs);
    while (this.shotsLeft > 0 && this.shotTimerMs <= 0) {
      shots.push(this.shoot(origin));
      this.shotsLeft -= 1;
      this.shotTimerMs += VOLLEY.shotIntervalMs;
    }
    return shots;
  }

  /**
   * One shot, leaving the muzzle along the current angle.
   *
   * Fired at wherever the barrel points *now*, not at a stored aim: the barrel
   * keeps tracking through the burst, so a moving player makes the three shots
   * fan out on their own. The spread is the tracking, not a parameter.
   *
   * @param {{x: number, y: number, size: number}} origin
   * @returns {Projectile}
   */
  shoot(origin) {
    const muzzle = this.muzzle(origin);
    return new Projectile({ x: muzzle.x, y: muzzle.y, angle: this.angle, traits: PROJECTILE });
  }

  /**
   * The end of the barrel, so nothing is born inside the boss square.
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
   * A burst ends when its last shot has left; everything else ends on a clock.
   *
   * Counting shots rather than running a `shots x interval` timer alongside
   * them is not a detail: the two drifted by one frame and the third shot of
   * every volley was swallowed by the phase change.
   *
   * @returns {boolean}
   */
  isPhaseOver() {
    if (this.phase === TURRET_PHASE.volley) return this.shotsLeft === 0;
    return this.phaseMs <= 0;
  }

  /** @param {string} phase */
  enter(phase, durationMs) {
    this.phase = phase;
    this.phaseMs = durationMs;
  }

  enterNextPhase() {
    if (this.phase === TURRET_PHASE.idle) return this.startPattern();
    if (this.phase === TURRET_PHASE.charge) {
      return this.enter(TURRET_PHASE.beam, LASER.durationMs);
    }
    return this.enter(TURRET_PHASE.idle, this.traits.cooldownMs);
  }

  /** Weighted, so the laser stays the exception rather than the routine. */
  startPattern() {
    if (weightedPick(this.rng, this.traits.patterns) === "laser") {
      return this.enter(TURRET_PHASE.charge, LASER.chargeMs);
    }
    this.shotsLeft = VOLLEY.shots;
    this.shotTimerMs = 0;
    // No deadline: the burst is over when the shots are, see `isPhaseOver()`.
    return this.enter(TURRET_PHASE.volley, Number.POSITIVE_INFINITY);
  }
}
