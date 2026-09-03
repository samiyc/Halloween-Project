import { CANVAS } from "../config/settings.js";
import { Boss } from "../entities/boss.js";
import { Player } from "../entities/player.js";
import { systemRandom } from "../tools/random.js";
import { resolveGesture, resolveMelee } from "./combat.js";
import { Spawner } from "./spawner.js";

export const GAME_STATUS = Object.freeze({
  running: "running",
  won: "won",
  lost: "lost",
});

/** Why the run ended, so the game-over screen can say so. */
export const END_REASON = Object.freeze({
  boss: "boss",
  enemy: "enemy",
});

/**
 * The orchestrator: owns the board, advances it, and decides when the game
 * ends. It has no canvas, no `ctx` and no event listeners — `src/main.js` wires
 * those to it. That is what lets a whole match be played out inside a unit
 * test with a seeded generator.
 */
export class Game {
  /**
   * @param {object} [options]
   * @param {{width: number, height: number}} [options.bounds]
   * @param {import("../tools/random.js").Rng} [options.rng]
   */
  constructor({ bounds = { width: CANVAS.width, height: CANVAS.height }, rng = systemRandom } = {}) {
    this.bounds = bounds;
    this.rng = rng;
    this.reset();
  }

  reset() {
    /** @type {import("../entities/enemy.js").Enemy[]} */
    this.enemies = [];
    this.boss = new Boss({ fieldWidth: this.bounds.width, rng: this.rng });
    this.player = new Player({
      x: this.bounds.width / 2,
      y: this.bounds.height * 0.8,
    });
    this.spawner = new Spawner({ bounds: this.bounds, rng: this.rng });
    this.status = GAME_STATUS.running;
    this.endedBecause = null;
    this.enemiesDefeated = 0;
    /** Set on the frame a melee lands, so the renderer can flash the hit. */
    this.lastMeleeTarget = null;
  }

  get isRunning() {
    return this.status === GAME_STATUS.running;
  }

  /**
   * Advances one frame.
   * @param {number} deltaMs
   * @param {{x: number, y: number}} moveDirection
   */
  update(deltaMs, moveDirection = { x: 0, y: 0 }) {
    if (!this.isRunning) return;

    this.lastMeleeTarget = null;
    this.player.update(deltaMs, moveDirection, this.bounds);
    this.advanceBoard(deltaMs);
    this.runMelee();

    const spawned = this.spawner.tick(deltaMs);
    if (spawned) this.enemies.push(spawned);

    this.settleEndConditions();
  }

  /** @param {number} deltaMs */
  advanceBoard(deltaMs) {
    // Enemies reverse and fly back up once the boss has no lives left. The
    // direction is computed here and passed down as a flag, rather than each
    // enemy reaching into the boss object as it used to.
    const reversed = this.boss.lives < 1;

    this.boss.update(deltaMs);
    for (const enemy of this.enemies) {
      enemy.update(deltaMs, { reversed });
    }
    // Reversed enemies used to climb off-screen and stay in the array forever.
    this.enemies = this.enemies.filter((enemy) => enemy.y > -enemy.size * 2);
  }

  runMelee() {
    const hit = resolveMelee(this.player, { enemies: this.enemies, boss: this.boss });
    if (!hit) return;

    this.lastMeleeTarget = hit.target;
    if (hit.defeated && hit.target !== this.boss) {
      this.removeDefeatedEnemies();
    }
    this.boss.resolveClearedSequence();
  }

  /**
   * Applies a recognised gesture to the board.
   * @param {import("../config/glyphs.js").GlyphId|null} glyphId
   * @returns {number} how many entities lost a symbol
   */
  castGesture(glyphId) {
    if (!this.isRunning || glyphId === null) return 0;

    const { hits } = resolveGesture(glyphId, {
      enemies: this.enemies,
      boss: this.boss,
    });
    this.removeDefeatedEnemies();
    this.boss.resolveClearedSequence();
    return hits;
  }

  removeDefeatedEnemies() {
    const survivors = [];
    for (const enemy of this.enemies) {
      if (enemy.isDefeated()) {
        this.enemiesDefeated += 1;
      } else {
        survivors.push(enemy);
      }
    }
    this.enemies = survivors;
  }

  /**
   * Win and loss are settled once, at the end of a frame. The original code
   * tested the loss condition inside the per-entity draw loop, so two enemies
   * crossing the bottom edge on the same frame each triggered a full game-over
   * sequence, stacking timers and restart listeners.
   */
  settleEndConditions() {
    if (this.boss.isDefeatedForGood()) {
      this.status = GAME_STATUS.won;
      return;
    }
    // The reason is recorded because losing to the boss is easy to miss: it
    // descends at 0.25px/frame and crosses the line after about 60 seconds
    // while attention is on the enemies.
    if (this.boss.hasEscaped(this.bounds.height)) {
      this.endedBecause = END_REASON.boss;
      this.status = GAME_STATUS.lost;
      return;
    }
    if (this.enemies.some((enemy) => enemy.hasEscaped(this.bounds.height))) {
      this.endedBecause = END_REASON.enemy;
      this.status = GAME_STATUS.lost;
    }
  }
}
