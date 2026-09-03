import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { glyphForSymbol } from "../src/config/glyphs.js";
import { TIME } from "../src/config/settings.js";
import { END_REASON, GAME_STATUS, Game } from "../src/game/game.js";
import { Spawner } from "../src/game/spawner.js";
import { createSeededRandom } from "../src/tools/random.js";

const FRAME = TIME.referenceFrameMs;
const BOUNDS = { width: 1200, height: 900 };

/** @returns {Game} */
function seededGame(seed = 42) {
  return new Game({ bounds: BOUNDS, rng: createSeededRandom(seed) });
}

/**
 * Casts whatever gesture the entity is currently waiting for.
 * @param {Game} game
 * @param {{nextSymbol: string|null}} target
 */
function castNextSymbolOf(game, target) {
  const glyph = glyphForSymbol(target.nextSymbol);
  assert.ok(glyph, `no glyph for symbol ${JSON.stringify(target.nextSymbol)}`);
  game.castGesture(glyph.id);
}

describe("Game lifecycle", () => {
  it("starts running with a boss, a player and no enemies", () => {
    const game = seededGame();
    assert.equal(game.status, GAME_STATUS.running);
    assert.ok(game.boss);
    assert.ok(game.player);
    assert.deepEqual(game.enemies, []);
    assert.equal(game.enemiesDefeated, 0);
  });

  it("is deterministic for a given seed", () => {
    // What makes a whole match testable at all.
    const a = seededGame(7);
    const b = seededGame(7);
    for (let frame = 0; frame < 600; frame += 1) {
      a.update(FRAME, { x: 1, y: 0 });
      b.update(FRAME, { x: 1, y: 0 });
    }
    assert.equal(a.enemies.length, b.enemies.length);
    assert.equal(a.boss.y.toFixed(6), b.boss.y.toFixed(6));
    assert.equal(a.player.x, b.player.x);
  });

  it("ignores updates and gestures once the game has ended", () => {
    const game = seededGame();
    game.status = GAME_STATUS.lost;
    const bossY = game.boss.y;

    game.update(FRAME, { x: 1, y: 1 });
    assert.equal(game.boss.y, bossY);
    assert.equal(game.castGesture("horizontal"), 0);
  });

  it("resets to a clean board", () => {
    const game = seededGame();
    for (let frame = 0; frame < 400; frame += 1) game.update(FRAME);
    game.enemiesDefeated = 12;
    game.status = GAME_STATUS.lost;

    game.reset();

    assert.equal(game.status, GAME_STATUS.running);
    assert.equal(game.enemiesDefeated, 0);
    assert.deepEqual(game.enemies, []);
    assert.equal(game.boss.lives, 3);
  });
});

describe("Game scoring and gestures", () => {
  it("scores an enemy only when its whole sequence is cleared", () => {
    const game = seededGame();
    game.enemies = [game.spawner.create()];
    const enemy = game.enemies[0];
    enemy.sequence = "_|";

    game.castGesture("horizontal");
    assert.equal(game.enemiesDefeated, 0, "still one symbol to go");
    assert.equal(game.enemies.length, 1);

    game.castGesture("vertical");
    assert.equal(game.enemiesDefeated, 1);
    assert.deepEqual(game.enemies, []);
  });

  it("counts a gesture that hits several enemies at once", () => {
    const game = seededGame();
    game.enemies = [game.spawner.create(), game.spawner.create()];
    for (const enemy of game.enemies) enemy.sequence = "V";

    assert.equal(game.castGesture("chevronDown"), 2);
    assert.equal(game.enemiesDefeated, 2);
  });

  it("advances the boss through its lives via gestures alone", () => {
    const game = seededGame();
    const startingLives = game.boss.lives;

    while (!game.boss.isDefeated()) castNextSymbolOf(game, game.boss);

    assert.equal(game.boss.lives, startingLives - 1);
    assert.equal(game.boss.isInvincible, true);
  });
});

describe("Game end conditions", () => {
  it("is won only after the boss finishes its last retreat", () => {
    const game = seededGame();

    for (let life = 0; life < 3; life += 1) {
      while (!game.boss.isDefeated()) castNextSymbolOf(game, game.boss);
      assert.equal(game.status, GAME_STATUS.running, "not won mid-fight");
      // Walk the boss back to the top to finish the retreat phase.
      while (game.boss.isInvincible) game.update(FRAME);
    }

    assert.equal(game.boss.lives, 0);
    assert.equal(game.status, GAME_STATUS.won);
  });

  it("is lost when an enemy crosses the bottom edge", () => {
    const game = seededGame();
    const escapee = game.spawner.create();
    escapee.y = BOUNDS.height + 1;
    game.enemies = [escapee];

    game.update(FRAME);
    assert.equal(game.status, GAME_STATUS.lost);
  });

  it("settles the loss once per frame, not once per escaping enemy", () => {
    // The old code checked the loss condition inside the per-entity draw loop,
    // so two enemies crossing on the same frame each fired a full game-over.
    const game = seededGame();
    game.enemies = [game.spawner.create(), game.spawner.create(), game.spawner.create()];
    for (const enemy of game.enemies) enemy.y = BOUNDS.height + 5;

    let transitions = 0;
    let previous = game.status;
    for (let frame = 0; frame < 5; frame += 1) {
      game.update(FRAME);
      if (game.status !== previous) transitions += 1;
      previous = game.status;
    }
    assert.equal(transitions, 1);
  });

  it("is lost when the boss reaches the bottom", () => {
    const game = seededGame();
    game.boss.y = BOUNDS.height + 1;
    game.update(FRAME);
    assert.equal(game.status, GAME_STATUS.lost);
    assert.equal(game.endedBecause, END_REASON.boss);
  });

  it("records which side crossed the line", () => {
    // The game-over screen needs this: the boss descends at 0.25px/frame and
    // crosses after about 60s, which is easy to miss while watching enemies.
    const byEnemy = seededGame();
    const escapee = byEnemy.spawner.create();
    escapee.y = BOUNDS.height + 1;
    byEnemy.enemies = [escapee];
    byEnemy.update(FRAME);
    assert.equal(byEnemy.endedBecause, END_REASON.enemy);

    const running = seededGame();
    assert.equal(running.endedBecause, null, "nothing recorded while running");
  });

  it("clears the end reason on reset", () => {
    const game = seededGame();
    game.boss.y = BOUNDS.height + 1;
    game.update(FRAME);
    assert.ok(game.endedBecause);
    game.reset();
    assert.equal(game.endedBecause, null);
  });
});

describe("Game housekeeping", () => {
  it("drops reversed enemies once they climb off the top", () => {
    // Enemies fly upward when the boss runs out of lives; before, they stayed
    // in the array forever and were still updated every frame.
    //
    // Note the setup has to go through the real path: dropping `lives` to 0
    // directly would make `isDefeatedForGood()` true and win the game on the
    // very next frame. The window in which enemies actually reverse is the
    // boss's final retreat, while it is still invincible.
    const game = seededGame();
    game.boss.lives = 1;
    game.boss.y = 500;
    game.boss.sequence = "";
    game.boss.resolveClearedSequence();

    assert.equal(game.boss.lives, 0);
    assert.equal(game.boss.isInvincible, true);

    const climber = game.spawner.create();
    climber.y = 10;
    climber.speed = 8;
    game.enemies = [climber];

    for (let frame = 0; frame < 60; frame += 1) game.update(FRAME);

    assert.equal(game.status, GAME_STATUS.running, "boss is still retreating");
    assert.ok(
      !game.enemies.includes(climber),
      "the reversed enemy should have been pruned off the top",
    );
  });

  it("lands a melee on an enemy the player walks into", () => {
    const game = seededGame();
    const target = game.spawner.create();
    target.sequence = "@@";
    target.x = game.player.x;
    target.y = game.player.y;
    game.enemies = [target];
    game.player.meleeCooldownMs = 0;

    game.update(FRAME, { x: 0, y: 0 });

    assert.equal(target.sequence, "@");
    assert.equal(game.lastMeleeTarget, target);
    assert.equal(game.player.isMeleeReady(), false);
  });

  it("clears the melee marker on the following frame", () => {
    const game = seededGame();
    const target = game.spawner.create();
    target.sequence = "__";
    target.x = game.player.x;
    target.y = game.player.y;
    game.enemies = [target];
    game.player.meleeCooldownMs = 0;

    game.update(FRAME);
    assert.ok(game.lastMeleeTarget);
    game.update(FRAME);
    assert.equal(game.lastMeleeTarget, null);
  });

  it("scores a melee kill", () => {
    const game = seededGame();
    const target = game.spawner.create();
    target.sequence = "@";
    target.x = game.player.x;
    target.y = game.player.y;
    game.enemies = [target];
    game.player.meleeCooldownMs = 0;

    game.update(FRAME);
    assert.equal(game.enemiesDefeated, 1);
    // Not `deepEqual(enemies, [])`: the spawner may legitimately add a new
    // enemy on the same frame, so assert on the target instead.
    assert.ok(!game.enemies.includes(target));
  });
});

describe("Spawner", () => {
  it("keeps the spawn rate frame-rate independent", () => {
    // 60 single frames and 120 half-frames cover the same amount of game time
    // and must produce a comparable number of enemies.
    const countOver = (frames, deltaMs) => {
      const spawner = new Spawner({
        bounds: BOUNDS,
        rng: createSeededRandom(5),
      });
      let spawned = 0;
      for (let frame = 0; frame < frames; frame += 1) {
        if (spawner.tick(deltaMs)) spawned += 1;
      }
      return spawned;
    };

    const at60 = countOver(3600, FRAME);
    const at144 = countOver(8640, FRAME * (60 / 144));
    assert.ok(
      Math.abs(at60 - at144) / at60 < 0.2,
      `expected comparable spawn counts, got ${at60} vs ${at144}`,
    );
  });

  it("produces both variants over many rolls", () => {
    const spawner = new Spawner({ bounds: BOUNDS, rng: createSeededRandom(8) });
    const variants = new Set();
    for (let roll = 0; roll < 300; roll += 1) {
      variants.add(spawner.create().variant);
    }
    assert.deepEqual([...variants].sort(), ["common", "rare"]);
  });

  it("spawns inside the field bounds", () => {
    const spawner = new Spawner({ bounds: BOUNDS, rng: createSeededRandom(6) });
    for (let roll = 0; roll < 200; roll += 1) {
      const enemy = spawner.create();
      assert.ok(enemy.x >= 0);
      assert.ok(enemy.x + enemy.size <= BOUNDS.width);
    }
  });
});
