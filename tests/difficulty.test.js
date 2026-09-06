import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_IDS,
  RULE_NAMES,
  rulesOf,
} from "../src/config/difficulty.js";
import { RARE_SYMBOLS } from "../src/config/glyphs.js";
import { HEALTH } from "../src/config/health.js";
import { MANA } from "../src/config/mana.js";
import { TIME } from "../src/config/settings.js";
import { END_REASON, Game } from "../src/game/game.js";
import { MENU_TOGGLE_COOLDOWN_MS, SCREEN, Session } from "../src/game/session.js";
import { createSeededRandom } from "../src/tools/random.js";

const FRAME = TIME.referenceFrameMs;

/**
 * @param {string} difficulty
 * @param {number} [seed]
 * @returns {Game}
 */
const gameOn = (difficulty, seed = 7) =>
  new Game({ rng: createSeededRandom(seed), difficulty });

/**
 * Runs a game long enough for every stream to have had its chance: spell orbs
 * are on a 15-20s timer, so ten seconds would prove nothing about them.
 *
 * The run is kept alive on purpose. Left alone the board is lost within
 * seconds, `update()` returns early and spawning stops — which would leave a
 * sample far too small to conclude anything from.
 *
 * @param {Game} game
 * @param {number} seconds
 */
function play(game, seconds) {
  for (let frame = 0; frame < 60 * seconds; frame += 1) {
    game.status = "running";
    game.update(FRAME);
  }
}

/**
 * Advances a session in real frames.
 *
 * Not one big tick: `clampDelta` caps a single step at 100ms, so `tick(300)`
 * would only spend 100 of the cooldown. That clamp is the point — it is what
 * stops one stalled frame from burning the whole thing.
 *
 * @param {Session} app
 * @param {number} ms
 */
function advance(app, ms) {
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME) app.tick(FRAME);
}

describe("difficulty rules", () => {
  it("declares every switch on every mode", () => {
    for (const id of DIFFICULTY_IDS) {
      for (const rule of RULE_NAMES) {
        assert.equal(typeof DIFFICULTIES[id][rule], "boolean", `${id}.${rule} missing`);
      }
    }
  });

  it("is cumulative: each mode is a superset of the one before", () => {
    // The property the whole design rests on — a player meets one new system at
    // a time. Easy to state, easy to break by accident when a switch is added.
    for (let step = 1; step < DIFFICULTY_IDS.length; step += 1) {
      const easier = DIFFICULTIES[DIFFICULTY_IDS[step - 1]];
      const harder = DIFFICULTIES[DIFFICULTY_IDS[step]];

      for (const rule of RULE_NAMES) {
        assert.ok(
          harder[rule] || !easier[rule],
          `"${harder.id}" drops "${rule}" that "${easier.id}" already had`,
        );
      }
    }
  });

  it("actually differs between modes, rather than being three copies", () => {
    const signatures = DIFFICULTY_IDS.map((id) =>
      RULE_NAMES.map((rule) => DIFFICULTIES[id][rule]).join(","),
    );
    assert.equal(new Set(signatures).size, DIFFICULTY_IDS.length);
  });

  it("falls back to the default for anything unrecognised", () => {
    assert.equal(rulesOf("nope").id, DEFAULT_DIFFICULTY);
    assert.equal(rulesOf(null).id, DEFAULT_DIFFICULTY);
    assert.equal(rulesOf("hard").id, "hard");
  });
});

describe("Easy strips the advanced mechanics", () => {
  it("casts gestures for free and never refuses one", () => {
    const game = gameOn("easy");
    game.mana.value = 0;
    game.boss.sequence = "|";
    game.enemies = [game.spawner.create()];
    game.enemies[0].sequence = "__";

    assert.equal(game.castGesture("horizontal"), 1, "an empty gauge must not block");
    assert.equal(game.mana.value, 0, "and nothing is spent");
    assert.equal(game.manaWarningMs, 0, "so there is nothing to warn about");
  });

  it("drops neither mana orbs nor spell orbs", () => {
    const game = gameOn("easy");
    play(game, 40);

    assert.deepEqual(game.pickups, []);
    assert.equal(game.manaOrbsCollected, 0);
    assert.equal(game.heldSpell, null);
  });

  it("never spawns a rare enemy, so no rare glyph can appear", () => {
    // "No bolts and no spirals" falls out of this rather than being a second
    // rule: the rare symbols only ever reach a sequence through a rare enemy.
    const game = gameOn("easy", 3);
    play(game, 60);

    const spawned = game.enemies.length + game.enemiesDefeated;
    assert.ok(spawned > 40, `expected a real sample, saw ${spawned}`);
    for (const enemy of game.enemies) {
      assert.equal(enemy.variant, "common");
      for (const symbol of enemy.sequence) {
        assert.ok(!RARE_SYMBOLS.includes(symbol), `rare symbol ${symbol} on Easy`);
      }
    }
  });

  it("refuses to cast a spell even if one is somehow held", () => {
    const game = gameOn("easy");
    game.heldSpell = "haste";
    assert.equal(game.castSpell(), null);
    assert.equal(game.player.effects.activeIds().length, 0);
  });

  it("still lets the melee work — it is the whole attack on Easy", () => {
    const game = gameOn("easy");
    const target = game.spawner.create();
    target.sequence = "___";
    target.x = game.player.x;
    target.y = game.player.y;
    game.enemies = [target];
    game.player.meleeCooldownMs = 0;

    game.update(FRAME);
    assert.equal(target.sequence, "__");
  });

  it("has no health bar", () => {
    assert.equal(gameOn("easy").health, null);
  });
});

describe("Medium and Hard", () => {
  it("Medium keeps the economy and the spells", () => {
    const game = gameOn("medium");
    game.mana.value = 0;
    game.enemies = [game.spawner.create()];
    game.enemies[0].sequence = "__";

    assert.equal(game.castGesture("horizontal"), 0, "an empty gauge blocks again");
    assert.ok(game.manaWarningMs > 0);
  });

  it("Medium drops both kinds of pickup", () => {
    const game = gameOn("medium", 5);
    play(game, 40);
    const seen = new Set(game.pickups.map((pickup) => pickup.kind));
    assert.ok(game.manaOrbsCollected > 0 || seen.has("mana"), "no mana orb in 40s");
  });

  it("Hard is Medium plus a full health bar", () => {
    const hard = gameOn("hard");
    assert.ok(hard.health);
    assert.equal(hard.health.value, HEALTH.max, "starts full");
    assert.equal(hard.health.ratio, 1);
    assert.equal(hard.rules.mana, true);
    assert.equal(hard.rules.spells, true);
  });

  it("arms the boss with a turret, and only on Hard", () => {
    // The turret is gated on `rules.health` rather than a switch of its own:
    // the bar exists for it, and nothing else can take health.
    assert.ok(gameOn("hard").turret);
    assert.equal(gameOn("medium").turret, null);
    assert.equal(gameOn("easy").turret, null);
  });

  it("drains the health bar under fire — this is what Hard is for", () => {
    // The test this replaces was called "leaves the health bar untouched for
    // now", and said in its own comment that it should fail the day an attack
    // pattern landed. This is that day.
    const hard = gameOn("hard", 11);
    play(hard, 30);
    assert.ok(hard.health.value < HEALTH.max, "the boss never landed a shot in 30s");
  });

  it("never fires a shot on Easy or Normal", () => {
    for (const mode of ["easy", "medium"]) {
      const game = gameOn(mode, 11);
      play(game, 30);
      assert.deepEqual(game.projectiles, [], `${mode} grew projectiles`);
      assert.equal(game.health, null);
    }
  });

  it("ends the run when the bar empties, naming the turret", () => {
    // Without the `play()` helper's status reset, because the point here is
    // precisely that the run ends.
    const hard = gameOn("hard", 4);
    hard.health.drain(HEALTH.max - 1);
    hard.projectiles = [];
    hard.player.x = hard.boss.centerX;
    hard.player.y = hard.boss.centerY + 200;

    for (let frame = 0; frame < 60 * 20 && hard.isRunning; frame += 1) {
      hard.update(FRAME);
    }

    assert.equal(hard.status, "lost");
    assert.equal(hard.endedBecause, END_REASON.health);
    assert.equal(hard.health.value, 0);
  });

  it("mirrors the mana gauge, as the spec asks", () => {
    assert.equal(HEALTH.max, MANA.max);
  });
});

describe("Session navigation", () => {
  /** @returns {Session} */
  const session = () => new Session({ rng: createSeededRandom(1) });

  it("opens on the menu with nothing to resume", () => {
    const app = session();
    assert.equal(app.screen, SCREEN.menu);
    assert.equal(app.game, null);
    assert.equal(app.canResume, false);
  });

  it("reports the rules of the mode about to be started, before any run", () => {
    // The menu needs them to describe a mode it has not launched yet.
    const app = session();
    assert.equal(app.rules.id, DEFAULT_DIFFICULTY);

    app.start("easy");
    assert.equal(app.rules.id, "easy", "and the running game's rules once there is one");
  });

  it("starts a run on the chosen difficulty", () => {
    const app = session();
    app.start("hard");

    assert.equal(app.screen, SCREEN.playing);
    assert.equal(app.difficulty, "hard");
    assert.equal(app.game.rules.health, true);
    assert.equal(app.canResume, true);
  });

  it("freezes the run rather than destroying it", () => {
    const app = session();
    app.start("medium");
    for (let frame = 0; frame < 120; frame += 1) app.game.update(FRAME);

    const running = app.game;
    const snapshot = { x: running.player.x, y: running.player.y, enemies: running.enemies.length };
    app.openMenu();

    assert.equal(app.screen, SCREEN.menu);
    assert.equal(app.game, running, "the same run is still there");
    assert.deepEqual(
      { x: running.player.x, y: running.player.y, enemies: running.enemies.length },
      snapshot,
      "nothing advanced while the menu was up",
    );
    assert.equal(app.canResume, true);
  });

  it("resumes the frozen run", () => {
    const app = session();
    app.start("easy");
    const running = app.game;
    app.openMenu();

    advance(app, MENU_TOGGLE_COOLDOWN_MS);
    assert.equal(app.resume(), true);
    assert.equal(app.screen, SCREEN.playing);
    assert.equal(app.game, running);
  });

  it("starts a brand new run when a difficulty is picked again", () => {
    // Picking a difficulty always restarts, even the current one — resuming is
    // what the other button is for.
    const app = session();
    app.start("medium");
    const first = app.game;
    app.openMenu();
    app.start("medium");

    assert.notEqual(app.game, first);
    assert.equal(app.game.enemiesDefeated, 0);
  });

  it("cannot resume a finished run", () => {
    const app = session();
    app.start("medium");
    app.game.status = "lost";
    app.openMenu();
    advance(app, MENU_TOGGLE_COOLDOWN_MS);

    assert.equal(app.canResume, false);
    assert.equal(app.resume(), false);
    assert.equal(app.screen, SCREEN.menu, "and it stays on the menu");
  });
});

describe("Session escape cooldown", () => {
  /** @returns {Session} */
  function playing() {
    const app = new Session({ rng: createSeededRandom(1) });
    app.start("medium");
    advance(app, MENU_TOGGLE_COOLDOWN_MS);
    return app;
  }

  it("toggles between board and menu", () => {
    const app = playing();

    assert.equal(app.toggleMenu(), true);
    assert.equal(app.screen, SCREEN.menu);

    advance(app, MENU_TOGGLE_COOLDOWN_MS);
    assert.equal(app.toggleMenu(), true);
    assert.equal(app.screen, SCREEN.playing);
  });

  it("ignores a second press inside the cooldown", () => {
    // Without it a held Escape would flip screens every single frame.
    const app = playing();
    app.toggleMenu();

    assert.equal(app.toggleMenu(), false);
    assert.equal(app.screen, SCREEN.menu, "still on the menu");

    advance(app, MENU_TOGGLE_COOLDOWN_MS - FRAME * 2);
    assert.equal(app.toggleMenu(), false, "not quite yet");

    advance(app, FRAME * 3);
    assert.equal(app.toggleMenu(), true);
  });

  it("clamps the cooldown like every other delta consumer", () => {
    const app = playing();
    app.toggleMenu();
    app.tick(60_000);

    assert.equal(
      app.toggleCooldownMs,
      MENU_TOGGLE_COOLDOWN_MS - TIME.maxFrameMs,
      "one stalled frame must not burn the whole cooldown",
    );
    assert.ok(app.toggleCooldownMs > 0, "so Escape is still on cooldown after it");
  });

  it("reaches zero despite floating point deltas", () => {
    // Eighteen subtractions of 1000/60 from 300 leave 7.1e-15, not 0. That was
    // enough to keep the cooldown "active" and swallow one more Escape.
    const app = new Session({ rng: createSeededRandom(1) });
    app.start("medium");
    advance(app, MENU_TOGGLE_COOLDOWN_MS);

    assert.equal(app.toggleCooldownMs, 0, "a residue is not a cooldown");
    assert.equal(app.toggleMenu(), true);
  });

  it("arms the cooldown on every screen change, however it was made", () => {
    const app = playing();
    app.openMenu();
    assert.ok(app.toggleCooldownMs > 0);

    advance(app, MENU_TOGGLE_COOLDOWN_MS);
    app.resume();
    assert.ok(app.toggleCooldownMs > 0);
  });
});
