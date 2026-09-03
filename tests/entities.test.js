import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { COMMON_SYMBOLS, RARE_SYMBOLS } from "../src/config/glyphs.js";
import { BOSS, PLAYER, TIME } from "../src/config/settings.js";
import { BOSS_PHASE, Boss } from "../src/entities/boss.js";
import { Enemy } from "../src/entities/enemy.js";
import { Entity } from "../src/entities/entity.js";
import { Player } from "../src/entities/player.js";
import { createSeededRandom } from "../src/tools/random.js";

const FRAME = TIME.referenceFrameMs;

describe("Entity sequence matching", () => {
  it("consumes a symbol only when the glyph matches its head", () => {
    const entity = new Entity({ x: 0, y: 0, size: 25, sequence: "_|V" });

    assert.equal(entity.decrementSequence("vertical"), false, "wrong glyph must not consume");
    assert.equal(entity.sequence, "_|V", "a mismatch is a no-op, with no penalty");

    assert.equal(entity.decrementSequence("horizontal"), true);
    assert.equal(entity.sequence, "|V");
  });

  it("matches the rare glyphs through the same single code path", () => {
    // Before the registry existed this mapping was duplicated in Enemy and in
    // Boss; adding bolt and spiral only works now because it lives in one place.
    const entity = new Entity({ x: 0, y: 0, size: 25, sequence: "⚡@" });
    assert.equal(entity.decrementSequence("bolt"), true);
    assert.equal(entity.decrementSequence("spiral"), true);
    assert.equal(entity.isDefeated(), true);
  });

  it("ignores unknown and null glyph ids", () => {
    const entity = new Entity({ x: 0, y: 0, size: 25, sequence: "_" });
    assert.equal(entity.decrementSequence(null), false);
    assert.equal(entity.decrementSequence("bogus"), false);
    assert.equal(entity.sequence, "_");
  });

  it("strips a head symbol regardless of glyph, for the melee", () => {
    const entity = new Entity({ x: 0, y: 0, size: 25, sequence: "@_" });
    assert.equal(entity.stripSymbol(), "@");
    assert.equal(entity.sequence, "_");
    entity.stripSymbol();
    assert.equal(entity.stripSymbol(), null, "an empty sequence strips nothing");
  });

  it("reports its centre for range checks", () => {
    const entity = new Entity({ x: 100, y: 200, size: 30, sequence: "_" });
    assert.equal(entity.centerX, 115);
    assert.equal(entity.centerY, 215);
  });
});

describe("Enemy", () => {
  it("spawns inside the field with a common sequence", () => {
    const enemy = new Enemy({ fieldWidth: 1200, rng: createSeededRandom(1) });
    assert.ok(enemy.x >= 0 && enemy.x <= 1200 - enemy.size);
    assert.equal(enemy.y, 0);
    for (const symbol of enemy.sequence) {
      assert.ok(COMMON_SYMBOLS.includes(symbol), `unexpected symbol ${symbol}`);
    }
  });

  it("gives rare variants at least one rare symbol", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const enemy = new Enemy({
        fieldWidth: 1200,
        rng: createSeededRandom(seed),
        variant: "rare",
      });
      const rareCount = [...enemy.sequence].filter((s) => RARE_SYMBOLS.includes(s)).length;
      assert.ok(rareCount >= 1, `seed ${seed} produced no rare symbol`);
      assert.ok(enemy.size > new Enemy({ rng: createSeededRandom(seed) }).size);
    }
  });

  it("moves at the same speed regardless of frame rate", () => {
    // The old code added `speed` once per animation frame, so a 144 Hz screen
    // ran the game 2.4x faster. Two frames of 8.33ms must now equal one of
    // 16.67ms.
    const at60 = new Enemy({ fieldWidth: 800, rng: createSeededRandom(9) });
    const at120 = new Enemy({ fieldWidth: 800, rng: createSeededRandom(9) });

    at60.update(FRAME);
    at120.update(FRAME / 2);
    at120.update(FRAME / 2);

    assert.ok(Math.abs(at60.y - at120.y) < 1e-9);
  });

  it("reverses upward when told the boss is out of lives", () => {
    const enemy = new Enemy({ fieldWidth: 800, rng: createSeededRandom(3) });
    enemy.update(FRAME, { reversed: false });
    const descended = enemy.y;
    enemy.update(FRAME, { reversed: true });
    assert.ok(enemy.y < descended);
  });

  it("survives being updated with no context at all", () => {
    // The previous signature was update(boss) and dereferenced boss.lives, so
    // a missing boss threw. The flag form cannot.
    const enemy = new Enemy({ fieldWidth: 800, rng: createSeededRandom(4) });
    assert.doesNotThrow(() => enemy.update(FRAME));
  });

  it("clamps a huge delta so a backgrounded tab does not teleport it", () => {
    const enemy = new Enemy({ fieldWidth: 800, rng: createSeededRandom(5) });
    enemy.update(60_000);
    assert.ok(enemy.y < enemy.speed * (TIME.maxFrameMs / FRAME) + 1);
  });
});

describe("Boss phase machine", () => {
  /** @returns {Boss} */
  const freshBoss = () => new Boss({ fieldWidth: 1200, rng: createSeededRandom(11) });

  it("starts descending with a sequence sized from its lives", () => {
    const boss = freshBoss();
    assert.equal(boss.lives, BOSS.lives);
    assert.equal(boss.phase, BOSS_PHASE.descending);
    assert.equal(boss.sequence.length, BOSS.sequenceBase + BOSS.lives * BOSS.sequencePerLife);
  });

  it("spends a life and retreats when its sequence is cleared", () => {
    const boss = freshBoss();
    boss.sequence = "";
    assert.equal(boss.resolveClearedSequence(), true);
    assert.equal(boss.lives, BOSS.lives - 1);
    assert.equal(boss.isInvincible, true);
    assert.equal(boss.color, BOSS.invincibleColor);
  });

  it("does not spend a second life while already retreating", () => {
    const boss = freshBoss();
    boss.sequence = "";
    boss.resolveClearedSequence();
    assert.equal(boss.resolveClearedSequence(), false);
    assert.equal(boss.lives, BOSS.lives - 1);
  });

  it("comes back smaller, faster and longer after reaching the top", () => {
    const boss = freshBoss();
    const size = boss.size;
    const speed = boss.speed;

    boss.y = 300;
    boss.sequence = "";
    boss.resolveClearedSequence();
    while (boss.isInvincible) boss.update(FRAME);

    assert.equal(boss.phase, BOSS_PHASE.descending);
    assert.equal(boss.size, size - BOSS.shrinkPerLife);
    assert.equal(boss.speed, speed + BOSS.speedGainPerLife);
    assert.equal(
      boss.sequence.length,
      BOSS.sequenceBase + boss.lives * BOSS.sequencePerLife,
    );
    assert.equal(boss.color, BOSS.baseColor);
  });

  it("ignores its own speed while retreating", () => {
    const boss = freshBoss();
    boss.y = 500;
    boss.sequence = "";
    boss.resolveClearedSequence();
    boss.update(FRAME);
    assert.equal(boss.y, 500 - BOSS.retreatSpeed);
  });

  it("cannot be hit by the melee while invincible", () => {
    const boss = freshBoss();
    boss.y = 400;
    boss.sequence = "";
    boss.resolveClearedSequence();
    boss.sequence = "_|";
    assert.equal(boss.stripSymbol(), null);
    assert.equal(boss.sequence, "_|");
  });

  it("is only defeated for good once out of the retreat phase", () => {
    const boss = freshBoss();
    boss.lives = 1;
    boss.y = 200;
    boss.sequence = "";
    boss.resolveClearedSequence();

    assert.equal(boss.lives, 0);
    assert.equal(
      boss.isDefeatedForGood(),
      false,
      "must not count as dead while still retreating on screen",
    );

    while (boss.isInvincible) boss.update(FRAME);
    assert.equal(boss.isDefeatedForGood(), true);
  });
});

describe("Player", () => {
  it("moves with a direction vector and stays inside the field", () => {
    const bounds = { width: 400, height: 300 };
    const player = new Player({ x: 0, y: 0 });

    player.update(FRAME, { x: -1, y: -1 }, bounds);
    assert.equal(player.x, 0, "clamped at the left edge");
    assert.equal(player.y, 0, "clamped at the top edge");

    for (let frame = 0; frame < 500; frame += 1) {
      player.update(FRAME, { x: 1, y: 1 }, bounds);
    }
    assert.equal(player.x, bounds.width - player.size);
    assert.equal(player.y, bounds.height - player.size);
  });

  it("does not travel faster on the diagonal", () => {
    const bounds = { width: 5000, height: 5000 };
    const straight = new Player({ x: 0, y: 0 });
    const diagonal = new Player({ x: 0, y: 0 });

    straight.update(FRAME, { x: 1, y: 0 }, bounds);
    diagonal.update(FRAME, { x: 1, y: 1 }, bounds);

    const straightDistance = Math.hypot(straight.x, straight.y);
    const diagonalDistance = Math.hypot(diagonal.x, diagonal.y);
    assert.ok(Math.abs(straightDistance - diagonalDistance) < 1e-9);
  });

  it("recharges its melee over the configured cooldown", () => {
    const player = new Player({ x: 0, y: 0 });
    const bounds = { width: 100, height: 100 };
    assert.equal(player.isMeleeReady(), false, "starts on cooldown");

    // Stepped in real frames rather than one giant delta: the cooldown is
    // clamped per frame, so a single 1500ms update would no longer clear it.
    const framesNeeded = Math.ceil(PLAYER.meleeCooldownMs / FRAME);
    for (let frame = 0; frame < framesNeeded; frame += 1) {
      player.update(FRAME, { x: 0, y: 0 }, bounds);
    }
    assert.equal(player.isMeleeReady(), true);
    assert.equal(player.meleeChargeRatio, 0);

    player.startMeleeCooldown();
    assert.equal(player.isMeleeReady(), false);
    assert.equal(player.meleeChargeRatio, 1);
  });

  it("does not recharge the melee instantly after a long stall", () => {
    // A backgrounded tab or a paused debugger hands the loop a delta of
    // seconds. Movement was already clamped; the cooldown must be too, or a
    // single stalled frame refunds the whole 1.5s.
    const player = new Player({ x: 0, y: 0 });
    player.update(10_000, { x: 0, y: 0 }, { width: 100, height: 100 });

    assert.equal(player.isMeleeReady(), false, "10s in one frame must not refund the cooldown");
    assert.equal(player.meleeCooldownMs, PLAYER.meleeCooldownMs - TIME.maxFrameMs);
  });

  it("measures distance from centre to centre", () => {
    const player = new Player({ x: 0, y: 0 });
    const target = { centerX: player.centerX + 30, centerY: player.centerY + 40 };
    assert.equal(player.distanceTo(target), 50);
  });
});
