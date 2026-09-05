import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CANVAS, FIELD, PLAYER, SIDEBAR } from "../src/config/settings.js";
import { PointerTracker } from "../src/engine/pointer.js";
import { Game } from "../src/game/game.js";
import { createSeededRandom } from "../src/tools/random.js";

/**
 * A stand-in for the canvas element, enough for `toCanvasPoint`.
 * @param {{scale?: number, left?: number, top?: number}} [options]
 */
function fakeCanvas({ scale = 1, left = 0, top = 0 } = {}) {
  return {
    width: CANVAS.width,
    height: CANVAS.height,
    getBoundingClientRect: () => ({
      left,
      top,
      width: CANVAS.width * scale,
      height: CANVAS.height * scale,
    }),
    addEventListener() {},
    removeEventListener() {},
  };
}

describe("canvas layout", () => {
  it("splits the canvas into a board between two equal sidebars", () => {
    assert.equal(SIDEBAR.width * 2 + FIELD.width, CANVAS.width, "the three must tile the canvas");
    assert.equal(FIELD.height, CANVAS.height);
    assert.equal(FIELD.x, SIDEBAR.width);
    assert.equal(FIELD.y, 0);
  });

  it("matches the agreed dimensions", () => {
    assert.deepEqual({ w: CANVAS.width, h: CANVAS.height }, { w: 1900, h: 1200 });
    assert.deepEqual({ w: FIELD.width, h: FIELD.height }, { w: 1300, h: 1200 });
    assert.equal(SIDEBAR.width, 300);
  });

  it("centres the board, so the game-over overlay can use the canvas centre", () => {
    assert.equal(FIELD.x + FIELD.width / 2, CANVAS.width / 2);
  });
});

describe("PointerTracker coordinates", () => {
  /** @returns {PointerTracker} */
  const tracker = (canvas) => new PointerTracker(canvas, { onStrokeComplete() {} });

  it("returns field coordinates, not canvas coordinates", () => {
    // The whole point: the left edge of the board is x = 0 for the game, even
    // though it sits 300px into the canvas.
    const pointer = tracker(fakeCanvas());
    const atFieldOrigin = pointer.toCanvasPoint({ clientX: FIELD.x, clientY: 0 });

    assert.equal(atFieldOrigin.x, 0);
    assert.equal(atFieldOrigin.y, 0);
  });

  it("maps the far corner of the board to its far corner in field space", () => {
    const pointer = tracker(fakeCanvas());
    const corner = pointer.toCanvasPoint({
      clientX: FIELD.x + FIELD.width,
      clientY: FIELD.height,
    });

    assert.equal(corner.x, FIELD.width);
    assert.equal(corner.y, FIELD.height);
  });

  it("still undoes the CSS scale before the offset", () => {
    // Order matters. Subtracting the offset first would scale it too, putting
    // every gesture progressively further off as the window shrinks.
    const scale = 0.5;
    const pointer = tracker(fakeCanvas({ scale }));
    const point = pointer.toCanvasPoint({ clientX: FIELD.x * scale, clientY: 0 });

    assert.equal(point.x, 0, "the board origin must stay the origin at any zoom");
  });

  it("accounts for the canvas not sitting at the viewport origin", () => {
    const pointer = tracker(fakeCanvas({ left: 40, top: 25 }));
    const point = pointer.toCanvasPoint({ clientX: 40 + FIELD.x + 100, clientY: 25 + 60 });

    assert.equal(point.x, 100);
    assert.equal(point.y, 60);
  });

  it("gives negative x over the left sidebar", () => {
    // Gestures have no range limit and may be drawn anywhere; the renderer
    // clips the trail rather than the input rejecting it.
    const pointer = tracker(fakeCanvas());
    assert.ok(pointer.toCanvasPoint({ clientX: 10, clientY: 10 }).x < 0);
  });
});

describe("player placement", () => {
  it("starts in the middle of the board", () => {
    // It used to start at 80% height, which meant walking up through an empty
    // board at the beginning of every run.
    const game = new Game({ rng: createSeededRandom(1) });

    assert.equal(game.player.centerX, FIELD.width / 2);
    assert.equal(game.player.centerY, FIELD.height / 2);
  });

  it("defaults its bounds to the board, not the whole canvas", () => {
    // Using CANVAS here would spawn enemies underneath the sidebars.
    const game = new Game({ rng: createSeededRandom(2) });

    assert.equal(game.bounds.width, FIELD.width);
    assert.equal(game.bounds.height, FIELD.height);
  });

  it("keeps the player inside the board", () => {
    const game = new Game({ rng: createSeededRandom(3) });
    for (let frame = 0; frame < 2000; frame += 1) {
      game.update(16.67, { x: 1, y: 1 });
    }
    assert.ok(game.player.x + PLAYER.size <= FIELD.width);
    assert.ok(game.player.y + PLAYER.size <= FIELD.height);
  });
});

describe("pickups reach the board edges", () => {
  it("collects an orb hugging the right edge of the board", () => {
    // A regression guard for the offset: if field and canvas coordinates were
    // ever mixed, the right-hand 300px of the board would stop working.
    const game = new Game({ rng: createSeededRandom(4) });
    const orb = game.pickupSpawner.create({
      kind: "mana",
      radius: 6,
      color: "#000",
      speed: 0,
    });
    orb.x = FIELD.width - orb.radius;
    orb.y = 400;

    game.player.x = FIELD.width - PLAYER.size;
    game.player.y = 400 - PLAYER.size / 2;
    game.pickups = [orb];
    const before = game.mana.value;

    game.update(16.67);

    assert.equal(game.manaOrbsCollected, 1, "an orb at the right edge must be reachable");
    assert.ok(game.mana.value > before);
  });
});
