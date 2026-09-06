import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DIFFICULTY_IDS } from "../src/config/difficulty.js";
import { MANA_ORB, SPELL_ORB } from "../src/config/pickups.js";
import {
  BOSS,
  CANVAS,
  ENEMY,
  FIELD,
  PLAYER,
  RARE_ENEMY,
  SIDEBAR,
} from "../src/config/settings.js";
import { PointerTracker } from "../src/engine/pointer.js";
import {
  buttonAt,
  gameOverMenuButton,
  hits,
  menuButtons,
  pauseButton,
} from "../src/render/layout.js";
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

describe("world scale invariants", () => {
  it("keeps a mana orb exactly half a grey cube across", () => {
    // The rule the orb size was originally derived from. Scaling the world has
    // to preserve it, or the orbs stop reading as "small" next to an enemy.
    assert.equal(MANA_ORB.radius * 2, ENEMY.size / 2);
  });

  it("keeps the spell orb bigger than a mana orb but smaller than an enemy", () => {
    assert.ok(SPELL_ORB.radius > MANA_ORB.radius);
    assert.ok(SPELL_ORB.radius * 2 < ENEMY.size);
  });

  it("keeps the melee circle wider than the player but a fraction of the board", () => {
    assert.ok(PLAYER.meleeRange > PLAYER.size);
    assert.ok(PLAYER.meleeRange < FIELD.width / 8, "an area melee must stay local");
  });

  it("keeps rare enemies visibly larger than common ones", () => {
    assert.ok(RARE_ENEMY.size > ENEMY.size);
  });

  it("keeps the boss dwarfing an ordinary enemy", () => {
    assert.ok(BOSS.size > ENEMY.size * 3);
    // It shrinks once per life and must survive three of them.
    assert.ok(BOSS.size - 3 * BOSS.shrinkPerLife > ENEMY.size);
  });
});

describe("PointerTracker coordinates", () => {
  /** @returns {PointerTracker} */
  const tracker = (canvas) => new PointerTracker(canvas, { onStrokeComplete() {} });

  it("keeps canvas and field coordinates apart", () => {
    // They used to be one function. The HUD buttons live in canvas space and
    // entities in field space, so conflating them put a button rect 300px from
    // where it was drawn.
    const pointer = tracker(fakeCanvas());
    const event = { clientX: FIELD.x, clientY: 0 };

    assert.deepEqual(pointer.toCanvasPoint(event), { x: FIELD.x, y: 0 });
    assert.deepEqual(pointer.toFieldPoint(event), { x: 0, y: 0 });
  });

  it("puts the board origin at zero in field space", () => {
    const pointer = tracker(fakeCanvas());
    const atFieldOrigin = pointer.toFieldPoint({ clientX: FIELD.x, clientY: 0 });

    assert.equal(atFieldOrigin.x, 0);
    assert.equal(atFieldOrigin.y, 0);
  });

  it("maps the far corner of the board to its far corner in field space", () => {
    const pointer = tracker(fakeCanvas());
    const corner = pointer.toFieldPoint({
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
    const point = pointer.toFieldPoint({ clientX: FIELD.x * scale, clientY: 0 });

    assert.equal(point.x, 0, "the board origin must stay the origin at any zoom");
  });

  it("accounts for the canvas not sitting at the viewport origin", () => {
    const pointer = tracker(fakeCanvas({ left: 40, top: 25 }));
    const point = pointer.toFieldPoint({ clientX: 40 + FIELD.x + 100, clientY: 25 + 60 });

    assert.equal(point.x, 100);
    assert.equal(point.y, 60);
  });

  it("gives negative x over the left sidebar", () => {
    // Gestures have no range limit and may be drawn anywhere; the renderer
    // clips the trail rather than the input rejecting it.
    const pointer = tracker(fakeCanvas());
    assert.ok(pointer.toFieldPoint({ clientX: 10, clientY: 10 }).x < 0);
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

describe("button geometry", () => {
  const centre = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

  it("offers one button per difficulty, plus resume", () => {
    const buttons = menuButtons({ canResume: false });
    assert.deepEqual(
      buttons.map((button) => button.id),
      [...DIFFICULTY_IDS, "resume"],
    );
  });

  it("greys out resume until there is something to resume", () => {
    assert.equal(menuButtons({ canResume: false }).at(-1).enabled, false);
    assert.equal(menuButtons({ canResume: true }).at(-1).enabled, true);
  });

  it("keeps every menu button on the canvas and clear of the sidebars", () => {
    for (const button of menuButtons({ canResume: true })) {
      assert.ok(button.rect.x > SIDEBAR.width, `"${button.id}" overlaps the left strip`);
      assert.ok(
        button.rect.x + button.rect.width < CANVAS.width - SIDEBAR.width,
        `"${button.id}" overlaps the right strip`,
      );
      assert.ok(button.rect.y >= 0);
      assert.ok(button.rect.y + button.rect.height <= CANVAS.height);
    }
  });

  it("stacks the menu buttons without overlapping", () => {
    const buttons = menuButtons({ canResume: true });
    for (let index = 1; index < buttons.length; index += 1) {
      const above = buttons[index - 1].rect;
      assert.ok(
        buttons[index].rect.y > above.y + above.height,
        "two buttons would share a click",
      );
    }
  });

  it("finds the button under a point, and only an enabled one", () => {
    const disabled = menuButtons({ canResume: false });
    const resume = disabled.at(-1);

    assert.equal(buttonAt(disabled, centre(resume.rect)), null, "greyed is not clickable");
    assert.equal(buttonAt(menuButtons({ canResume: true }), centre(resume.rect)).id, "resume");
    assert.equal(buttonAt(disabled, { x: 0, y: 0 }), null);
  });

  it("puts the pause button at the top of the right sidebar", () => {
    const { rect } = pauseButton();
    assert.ok(rect.x >= CANVAS.width - SIDEBAR.width, "must be inside the right strip");
    assert.ok(rect.x + rect.width <= CANVAS.width);
    assert.ok(rect.y < 100, "at the top, above the glyph legend");
  });

  it("keeps the pause button clear of the play area", () => {
    // A press on it must not also start a gesture, which is only safe if it
    // never sits over the board.
    const { rect } = pauseButton();
    assert.ok(rect.x > FIELD.x + FIELD.width, "the pause button reaches into the board");
  });

  it("puts the game-over Menu button below the score", () => {
    const { rect } = gameOverMenuButton();
    assert.ok(rect.y > CANVAS.height / 2, "must not cover the headline");
    assert.equal(rect.x + rect.width / 2, CANVAS.width / 2, "centred");
  });

  it("tests edges as inside, so a button has no dead border", () => {
    const { rect } = pauseButton();
    assert.ok(hits(rect, { x: rect.x, y: rect.y }));
    assert.ok(hits(rect, { x: rect.x + rect.width, y: rect.y + rect.height }));
    assert.ok(!hits(rect, { x: rect.x - 1, y: rect.y }));
  });
});
