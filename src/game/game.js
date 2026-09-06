import { DEFAULT_DIFFICULTY, rulesOf } from "../config/difficulty.js";
import { HEALTH } from "../config/health.js";
import { MANA, castCost } from "../config/mana.js";
import { FIELD, PLAYER, SPAWN, clampDelta } from "../config/settings.js";
import { SPELL_IDS } from "../config/spells.js";
import { Boss } from "../entities/boss.js";
import { Player } from "../entities/player.js";
import { Turret } from "../entities/turret.js";
import { systemRandom } from "../tools/random.js";
import { beamDamage, resolveProjectiles } from "./boss-attacks.js";
import { collectPickups } from "./collection.js";
import { resolveGesture, resolveMelee } from "./combat.js";
import { Gauge } from "./gauge.js";
import { PickupSpawner } from "./pickup-spawner.js";
import { Spawner } from "./spawner.js";
import { applySpell } from "./spellbook.js";

export const GAME_STATUS = Object.freeze({
  running: "running",
  won: "won",
  lost: "lost",
});

/** Why the run ended, so the game-over screen can say so. */
export const END_REASON = Object.freeze({
  boss: "boss",
  enemy: "enemy",
  health: "health",
});

/** How long the gauge flashes after a cast was refused for lack of mana. */
const MANA_WARNING_MS = 600;

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
   * @param {import("../config/difficulty.js").DifficultyId} [options.difficulty]
   */
  constructor({
    bounds = { width: FIELD.width, height: FIELD.height },
    rng = systemRandom,
    difficulty = DEFAULT_DIFFICULTY,
  } = {}) {
    this.bounds = bounds;
    this.rng = rng;
    /** Which mechanics exist at all in this run. See config/difficulty.js. */
    this.rules = rulesOf(difficulty);
    this.reset();
  }

  reset() {
    /** @type {import("../entities/enemy.js").Enemy[]} */
    this.enemies = [];
    /** @type {import("../entities/pickup.js").Pickup[]} */
    this.pickups = [];
    this.boss = new Boss({ fieldWidth: this.bounds.width, rng: this.rng });
    // Centred, not parked at the bottom. Starting low meant walking up through
    // an empty board every run before anything was in reach.
    this.player = new Player({
      x: (this.bounds.width - PLAYER.size) / 2,
      y: (this.bounds.height - PLAYER.size) / 2,
    });
    // Silencing rare enemies also silences the rare glyphs: no purple enemy
    // means no sequence ever contains a bolt or a spiral.
    this.spawner = new Spawner({
      bounds: this.bounds,
      rng: this.rng,
      rates: this.rules.rareEnemies ? SPAWN : { ...SPAWN, rareShare: 0 },
    });
    this.pickupSpawner = new PickupSpawner({
      bounds: this.bounds,
      rng: this.rng,
      drops: { mana: this.rules.mana, spells: this.rules.spells },
    });
    this.mana = new Gauge();
    /** Hard only, and the turret below is the only thing that empties it. */
    this.health = this.rules.health ? new Gauge(HEALTH) : null;
    // Gated on `health` rather than a switch of its own: the bar exists for the
    // turret and nothing else can take health, so a `bossAttacks` flag could
    // never hold a different value.
    this.turret = this.rules.health ? new Turret({ rng: this.rng }) : null;
    /** @type {import("../entities/projectile.js").Projectile[]} */
    this.projectiles = [];
    /** @type {import("../config/spells.js").SpellId|null} The single spell slot. */
    this.heldSpell = null;
    this.status = GAME_STATUS.running;
    this.endedBecause = null;
    this.enemiesDefeated = 0;
    this.manaOrbsCollected = 0;
    /** Counts down after a refused cast, so the HUD can flash the gauge. */
    this.manaWarningMs = 0;
    /** Everything the melee hit this frame, so the renderer can flash them. */
    this.lastMeleeTargets = [];
  }

  get isRunning() {
    return this.status === GAME_STATUS.running;
  }

  /**
   * Where the turret is mounted: the boss centre, and the side it scales from.
   *
   * Read by the turret each frame and by the renderer, so the two cannot end up
   * pivoting about different points.
   */
  get turretMount() {
    return { x: this.boss.centerX, y: this.boss.centerY, size: this.boss.size };
  }

  /**
   * Advances one frame.
   * @param {number} deltaMs
   * @param {{x: number, y: number}} moveDirection
   */
  update(deltaMs, moveDirection = { x: 0, y: 0 }) {
    if (!this.isRunning) return;

    this.lastMeleeTargets = [];
    this.manaWarningMs = Math.max(0, this.manaWarningMs - clampDelta(deltaMs));
    if (this.rules.mana) this.mana.regenerate(deltaMs);

    this.player.update(deltaMs, moveDirection, this.bounds);
    this.advanceBoard(deltaMs);
    this.advancePickups(deltaMs);
    this.advanceAttacks(deltaMs);
    this.runMelee();
    this.runSpawners(deltaMs);

    this.settleEndConditions();
  }

  /**
   * The turret: aim, fire, and collect what it costs the player.
   *
   * Runs after the board so the barrel aims at this frame's positions, and
   * before `settleEndConditions()` so an emptied bar ends the run on the same
   * frame it emptied.
   *
   * @param {number} deltaMs
   */
  advanceAttacks(deltaMs) {
    if (!this.turret) return;

    this.projectiles.push(
      ...this.turret.update(deltaMs, {
        origin: this.turretMount,
        target: { x: this.player.centerX, y: this.player.centerY },
        // A retreating boss is untouchable; letting it shoot as well would
        // stack both pressures at the one moment nothing can be done about it.
        // It also freezes the barrel and greys the dome — the tell that the
        // boss is between lives.
        canFire: !this.boss.isInvincible,
        phase: this.boss.phaseNumber,
      }),
    );

    const volley = resolveProjectiles(this.player, this.projectiles, {
      bounds: this.bounds,
      deltaMs,
    });
    this.projectiles = volley.remaining;
    // The blink confirms an impact, so only a shot arms it. The beam is already
    // drawn across the player; blinking every frame would just bleach the
    // square white and cost the green its meaning.
    if (volley.damage > 0) this.player.takeHit();
    this.health.drain(volley.damage + beamDamage(this.player, this.turret.beam, deltaMs));
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

  /** @param {number} deltaMs */
  advancePickups(deltaMs) {
    for (const pickup of this.pickups) {
      pickup.update(deltaMs);
    }
    const harvest = collectPickups(this.player, this.pickups, {
      fieldHeight: this.bounds.height,
      canTakeSpell: this.heldSpell === null,
    });

    this.pickups = harvest.remaining;
    this.manaOrbsCollected += harvest.manaOrbs;
    this.mana.gain(harvest.manaOrbs * MANA.orbValue);
    if (harvest.tookSpell) this.heldSpell = this.rng.pick(SPELL_IDS);
  }

  /** @param {number} deltaMs */
  runSpawners(deltaMs) {
    const spawned = this.spawner.tick(deltaMs);
    if (spawned) this.enemies.push(spawned);
    this.pickups.push(...this.pickupSpawner.tick(deltaMs));
  }

  runMelee() {
    const swing = resolveMelee(this.player, { enemies: this.enemies, boss: this.boss });
    if (!swing) return;

    this.lastMeleeTargets = swing.hits.map((hit) => hit.target);
    if (swing.defeated.some((target) => target !== this.boss)) {
      this.removeDefeatedEnemies();
    }
    this.boss.resolveClearedSequence();
  }

  /**
   * Applies a recognised gesture to the board, for a price.
   *
   * A recognised gesture is charged whether or not it hits anything: that is
   * what makes precision matter. An unrecognised stroke casts nothing, so it
   * costs nothing — punishing an accidental flick of the mouse would be unfair.
   *
   * @param {import("../config/glyphs.js").GlyphId|null} glyphId
   * @returns {number} how many entities lost a symbol
   */
  castGesture(glyphId) {
    if (!this.isRunning || glyphId === null) return 0;

    // Easy has no economy at all: gestures are free, so there is nothing to
    // refuse and nothing to flash.
    if (this.rules.mana && !this.mana.spend(castCost(glyphId))) {
      this.manaWarningMs = MANA_WARNING_MS;
      return 0;
    }

    const { hits } = resolveGesture(glyphId, {
      enemies: this.enemies,
      boss: this.boss,
    });
    this.removeDefeatedEnemies();
    this.boss.resolveClearedSequence();
    return hits;
  }

  /**
   * Spends whatever the last yellow orb granted. Free — no mana, no cooldown.
   * @returns {string|null} the spell that fired, or null if the slot was empty
   */
  castSpell() {
    if (!this.rules.spells || !this.isRunning || this.heldSpell === null) return null;

    const spellId = this.heldSpell;
    this.heldSpell = null;
    return applySpell(spellId, this) ? spellId : null;
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
    // Hard only, since only Hard has a bar to empty.
    if (this.health?.isEmpty) {
      this.endedBecause = END_REASON.health;
      this.status = GAME_STATUS.lost;
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
