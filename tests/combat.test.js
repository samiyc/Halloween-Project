import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RARE_SYMBOLS } from "../src/config/glyphs.js";
import { PLAYER } from "../src/config/settings.js";
import { Boss } from "../src/entities/boss.js";
import { Enemy } from "../src/entities/enemy.js";
import { Player } from "../src/entities/player.js";
import { resolveGesture, resolveMelee } from "../src/game/combat.js";
import { createSeededRandom } from "../src/tools/random.js";

/** Built from the registry: the rare symbols are cosmetic and do get changed. */
const [RARE] = RARE_SYMBOLS;

/**
 * @param {string} sequence
 * @param {{x?: number, y?: number}} [position]
 * @returns {Enemy}
 */
function enemyWith(sequence, { x = 0, y = 0 } = {}) {
  const enemy = new Enemy({ fieldWidth: 100, rng: createSeededRandom(1) });
  enemy.sequence = sequence;
  enemy.x = x;
  enemy.y = y;
  return enemy;
}

describe("resolveGesture", () => {
  it("hits every entity waiting on that symbol at once", () => {
    // A gesture has no range limit and is board-wide, but only touches what is
    // waiting on that symbol. The melee is the counterpart: a small circle, but
    // it ignores which symbol is next.
    const enemies = [enemyWith("_V"), enemyWith("_"), enemyWith("|_")];
    const result = resolveGesture("horizontal", { enemies });

    assert.equal(result.hits, 2);
    assert.equal(enemies[0].sequence, "V");
    assert.equal(enemies[1].sequence, "");
    assert.equal(enemies[2].sequence, "|_", "not its turn");
    assert.deepEqual(result.defeated, [enemies[1]]);
  });

  it("hits the boss alongside the enemies", () => {
    const boss = new Boss({ fieldWidth: 800, rng: createSeededRandom(2) });
    boss.sequence = "|_";
    const enemies = [enemyWith("|")];

    const result = resolveGesture("vertical", { enemies, boss });
    assert.equal(result.bossHit, true);
    assert.equal(boss.sequence, "_");
    assert.equal(result.hits, 2);
  });

  it("cannot touch the boss while it retreats", () => {
    const boss = new Boss({ fieldWidth: 800, rng: createSeededRandom(3) });
    boss.y = 300;
    boss.sequence = "";
    boss.resolveClearedSequence();
    boss.sequence = "_";

    const result = resolveGesture("horizontal", { enemies: [], boss });
    assert.equal(result.bossHit, false);
    assert.equal(boss.sequence, "_");
  });

  it("does nothing for an unrecognised gesture", () => {
    const enemies = [enemyWith("_")];
    const result = resolveGesture(null, { enemies });
    assert.equal(result.hits, 0);
    assert.equal(enemies[0].sequence, "_");
  });

  it("works with no boss on the board", () => {
    const result = resolveGesture("horizontal", { enemies: [enemyWith("_")] });
    assert.equal(result.bossHit, false);
    assert.equal(result.hits, 1);
  });
});

describe("resolveMelee", () => {
  /** @returns {Player} */
  function readyPlayer(x = 200, y = 200) {
    const player = new Player({ x, y });
    player.meleeCooldownMs = 0;
    return player;
  }

  it("strips one symbol from everything in reach, whatever the symbol", () => {
    const player = readyPlayer();
    // A rare symbol no gesture in this test could match, to prove the melee
    // bypasses glyph matching entirely.
    const near = enemyWith(RARE + "_", { x: player.x + 10, y: player.y + 10 });
    const far = enemyWith("_", { x: player.x + 600, y: player.y });

    const swing = resolveMelee(player, { enemies: [near, far] });

    assert.ok(swing);
    assert.equal(swing.hits.length, 1);
    assert.equal(swing.hits[0].target, near);
    assert.equal(swing.hits[0].symbol, RARE);
    assert.equal(near.sequence, "_");
    assert.equal(far.sequence, "_", "out of range is untouched");
  });

  it("hits every target in the circle, not just the nearest", () => {
    // The point of the change: walking into a group is now worth more than
    // duelling one enemy.
    const player = readyPlayer();
    const group = [0, 20, -20, 35].map((offset) =>
      enemyWith("__", { x: player.x + offset, y: player.y }),
    );

    const swing = resolveMelee(player, { enemies: group });

    assert.equal(swing.hits.length, group.length);
    for (const enemy of group) {
      assert.equal(enemy.sequence, "_", "each one loses exactly one symbol");
    }
  });

  it("returns null while on cooldown even with a target in reach", () => {
    const player = new Player({ x: 200, y: 200 });
    const near = enemyWith("_", { x: 205, y: 200 });
    assert.equal(resolveMelee(player, { enemies: [near] }), null);
    assert.equal(near.sequence, "_");
  });

  it("charges the cooldown once for the whole swing", () => {
    const player = readyPlayer();
    const group = [0, 15, -15].map((offset) =>
      enemyWith("__", { x: player.x + offset, y: player.y }),
    );

    resolveMelee(player, { enemies: group });
    assert.equal(player.isMeleeReady(), false);
    assert.equal(resolveMelee(player, { enemies: group }), null, "no free second swing");
  });

  it("does not consume the cooldown when nothing is in reach", () => {
    const player = readyPlayer();
    const far = enemyWith("_", { x: player.x + 800, y: player.y });

    assert.equal(resolveMelee(player, { enemies: [far] }), null);
    assert.equal(player.isMeleeReady(), true, "cooldown must not be wasted on a miss");
  });

  it("respects the configured range at the boundary", () => {
    const player = readyPlayer();
    const justOutside = enemyWith("_");
    justOutside.x = player.centerX + PLAYER.meleeRange + 5 - justOutside.size / 2;
    justOutside.y = player.centerY - justOutside.size / 2;

    assert.equal(resolveMelee(player, { enemies: [justOutside] }), null);

    justOutside.x = player.centerX + PLAYER.meleeRange - 5 - justOutside.size / 2;
    assert.ok(resolveMelee(player, { enemies: [justOutside] }));
  });

  it("reports every kill so the caller can score them", () => {
    const player = readyPlayer();
    const dying = [0, 12].map((offset) =>
      enemyWith("_", { x: player.x + offset, y: player.y }),
    );
    const survivor = enemyWith("__", { x: player.x - 12, y: player.y });

    const swing = resolveMelee(player, { enemies: [...dying, survivor] });

    assert.equal(swing.hits.length, 3);
    assert.deepEqual(swing.defeated, dying);
  });

  it("can reach the boss, but not while it retreats", () => {
    const player = readyPlayer();
    const boss = new Boss({ fieldWidth: 800, rng: createSeededRandom(4) });
    boss.x = player.x - 20;
    boss.y = player.y - 20;
    boss.sequence = "_|";

    assert.ok(resolveMelee(player, { enemies: [], boss }));
    assert.equal(boss.sequence, "|");

    player.meleeCooldownMs = 0;
    boss.sequence = "";
    boss.resolveClearedSequence();
    boss.sequence = "_|";
    assert.equal(resolveMelee(player, { enemies: [], boss }), null);
    assert.equal(player.isMeleeReady(), true, "a swing that connects with nothing is free");
  });

  it("skips an already cleared enemy", () => {
    const player = readyPlayer();
    const cleared = enemyWith("", { x: player.x + 5, y: player.y });
    assert.equal(resolveMelee(player, { enemies: [cleared] }), null);
  });
});
