import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DIFFICULTY_IDS } from "../src/config/difficulty.js";
import { FIELD, THREAT, TIME } from "../src/config/settings.js";
import { Enemy } from "../src/entities/enemy.js";
import { Game } from "../src/game/game.js";
import { lowestThreat, threatLevelOf, threatMarkers } from "../src/game/threat.js";
import { THREAT_COLORS } from "../src/render/palette.js";
import { createSeededRandom } from "../src/tools/random.js";

const HEIGHT = 1200;

/**
 * The shape the marker actually reads: a top edge and a centre.
 * @param {number} y
 * @param {number} [centerX]
 */
function threatAt(y, centerX = 100) {
  return { y, centerX };
}

describe("lowestThreat", () => {
  it("has nothing to point at on an empty board", () => {
    assert.equal(lowestThreat([], HEIGHT), null);
  });

  it("picks the greatest y, not the first entry", () => {
    const found = lowestThreat(
      [threatAt(400, 10), threatAt(900, 20), threatAt(200, 30)],
      HEIGHT,
    );
    assert.equal(found.x, 20);
  });

  it("aligns on the centre of the entity, not its left edge", () => {
    const enemy = new Enemy({ fieldWidth: 1000, rng: createSeededRandom(7) });
    enemy.y = 500;

    assert.equal(lowestThreat([enemy], HEIGHT).x, enemy.x + enemy.size / 2);
  });

  it("measures progress on the top edge, like hasEscaped", () => {
    const enemy = new Enemy({ fieldWidth: 1000, rng: createSeededRandom(7) });
    enemy.y = HEIGHT / 2;

    // Not (y + size) / height: a 40px enemy and a 160px boss must reach a given
    // level at the same distance from the line they are both judged against.
    assert.equal(lowestThreat([enemy], HEIGHT).ratio, 0.5);
    assert.equal(enemy.hasEscaped(HEIGHT), false);
  });

  it("caps the ratio at 1 for something already over the line", () => {
    const found = lowestThreat([threatAt(HEIGHT * 3)], HEIGHT);
    assert.equal(found.ratio, 1);
    assert.equal(found.level, "danger");
  });

  it("carries the level of the entity it points at", () => {
    assert.equal(lowestThreat([threatAt(HEIGHT * 0.2)], HEIGHT).level, "calm");
    assert.equal(lowestThreat([threatAt(HEIGHT * 0.9)], HEIGHT).level, "danger");
  });
});

describe("threatLevelOf", () => {
  it("stays calm below the warning threshold", () => {
    assert.equal(threatLevelOf(0), "calm");
    assert.equal(threatLevelOf(THREAT.warnRatio - 0.01), "calm");
  });

  it("warns from the threshold itself, inclusive", () => {
    assert.equal(threatLevelOf(THREAT.warnRatio), "warn");
    assert.equal(threatLevelOf(THREAT.dangerRatio - 0.01), "warn");
  });

  it("turns to danger from its own threshold, inclusive", () => {
    assert.equal(threatLevelOf(THREAT.dangerRatio), "danger");
    assert.equal(threatLevelOf(1), "danger");
  });

  it("keeps the two thresholds ordered and inside the field", () => {
    assert.ok(THREAT.warnRatio < THREAT.dangerRatio);
    assert.ok(THREAT.dangerRatio < 1);
  });

  it("matches the agreed thresholds", () => {
    // Pinned like the canvas dimensions in layout.test.js: these are a design
    // decision — amber with two fifths of the board still to go, red with one.
    assert.deepEqual(
      { warn: THREAT.warnRatio, danger: THREAT.dangerRatio },
      { warn: 0.6, danger: 0.8 },
    );
  });

  it("has a colour for every level it can return", () => {
    const levels = [0, THREAT.warnRatio, THREAT.dangerRatio].map(threatLevelOf);
    for (const level of levels) {
      assert.ok(THREAT_COLORS[level], `no colour for ${level}`);
    }
    assert.equal(new Set(Object.values(THREAT_COLORS)).size, 3, "three distinct colours");
  });
});

describe("threatMarkers", () => {
  it("has nothing to draw on an empty board", () => {
    assert.deepEqual(threatMarkers([], HEIGHT), []);
  });

  it("falls back to one quiet marker while nothing is urgent", () => {
    const markers = threatMarkers(
      [threatAt(100, 10), threatAt(HEIGHT * 0.5, 20), threatAt(300, 30)],
      HEIGHT,
    );

    assert.equal(markers.length, 1, "one reminder, not one per enemy");
    assert.equal(markers[0].level, "calm");
    assert.equal(markers[0].x, 20, "on the lowest of them");
  });

  it("announces every threat past the warning threshold", () => {
    const markers = threatMarkers(
      [threatAt(HEIGHT * 0.65, 10), threatAt(HEIGHT * 0.7, 20), threatAt(HEIGHT * 0.9, 30)],
      HEIGHT,
    );

    assert.deepEqual(
      markers.map((marker) => marker.x),
      [10, 20, 30],
      "two enemies a few pixels apart must not share one marker",
    );
    assert.deepEqual(
      markers.map((marker) => marker.level),
      ["warn", "warn", "danger"],
      "each carries its own urgency",
    );
  });

  it("leaves the quiet ones unmarked once anything is urgent", () => {
    const markers = threatMarkers(
      [threatAt(200, 10), threatAt(HEIGHT * 0.75, 20), threatAt(HEIGHT * 0.5, 30)],
      HEIGHT,
    );

    assert.deepEqual(
      markers.map((marker) => marker.x),
      [20],
      "no grey marker is added on top of a real warning",
    );
  });

  it("gives the boss a marker of its own, alongside the enemies", () => {
    const game = new Game({ rng: createSeededRandom(42) });
    game.boss.y = game.bounds.height * 0.9;
    game.enemies.length = 0;
    const enemy = new Enemy({ fieldWidth: 1000, rng: createSeededRandom(7) });
    enemy.y = game.bounds.height * 0.7;
    game.enemies.push(enemy);

    const markers = threatMarkers(game.threats, game.bounds.height);
    assert.equal(markers.length, 2);
    assert.deepEqual(
      markers.map((marker) => marker.level).sort(),
      ["danger", "warn"],
    );
  });
});

describe("Game.threats", () => {
  it("counts the boss as well as the enemies", () => {
    const game = new Game({ rng: createSeededRandom(42) });
    game.boss.y = 800;

    assert.ok(game.threats.includes(game.boss));
    assert.equal(lowestThreat(game.threats, game.bounds.height).x, game.boss.centerX);
  });

  it("follows the lowest thing on a board that is actually running", () => {
    const game = new Game({ rng: createSeededRandom(42) });
    for (let frame = 0; frame < 600; frame += 1) {
      game.update(TIME.referenceFrameMs);
    }

    const marker = lowestThreat(game.threats, game.bounds.height);
    const lowest = Math.max(...game.threats.map((threat) => threat.y));
    assert.ok(game.enemies.length > 0, "the seeded run must have spawned something");
    assert.equal(marker.ratio, lowest / FIELD.height);
  });

  it("exists on every difficulty — the marker is never gated", () => {
    for (const id of DIFFICULTY_IDS) {
      const game = new Game({ rng: createSeededRandom(3), difficulty: id });
      assert.ok(lowestThreat(game.threats, game.bounds.height), `nothing to point at on ${id}`);
    }
  });
});
