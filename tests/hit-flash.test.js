import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ENEMY, HIT_FLASH, PLAYER, RARE_ENEMY, TIME } from "../src/config/settings.js";
import { FROST_ENEMY_COLOR } from "../src/config/spells.js";
import { Boss } from "../src/entities/boss.js";
import { Enemy } from "../src/entities/enemy.js";
import { Entity } from "../src/entities/entity.js";
import { resolveGesture, resolveMelee } from "../src/game/combat.js";
import { Player } from "../src/entities/player.js";
import { mixHex } from "../src/tools/color.js";
import { createSeededRandom } from "../src/tools/random.js";

const FRAME = TIME.referenceFrameMs;

/**
 * Reads back a colour whatever notation it came in, so a test can compare a
 * blend against the `#rrggbb` constant it was derived from.
 *
 * @param {string} color `#rrggbb` or `rgb(r, g, b)`
 * @returns {{r: number, g: number, b: number}}
 */
function channelsOf(color) {
  if (color.startsWith("#")) {
    const digits = color.slice(1);
    const full = digits.length === 3 ? digits.replace(/./g, (d) => d + d) : digits;
    const value = Number.parseInt(full, 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
  }
  const [r, g, b] = color.match(/\d+/g).map(Number);
  return { r, g, b };
}

/** @param {string} color */
const brightness = (color) => {
  const { r, g, b } = channelsOf(color);
  return r + g + b;
};

/**
 * Runs the flash down in real frames.
 *
 * Not one big tick: `clampDelta` caps a step at `maxFrameMs`, which happens to
 * be the whole flash duration — a single call would say nothing about the fade.
 *
 * @param {{update: (deltaMs: number) => void}} entity
 * @param {number} ms
 */
function advance(entity, ms) {
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME) entity.update(FRAME);
}

describe("mixHex", () => {
  it("returns each end untouched", () => {
    assert.equal(mixHex("#AAAAAA", "#FFFFFF", 0), "#AAAAAA");
    assert.equal(mixHex("#AAAAAA", "#FFFFFF", 1), "#FFFFFF");
  });

  it("lands halfway in the middle", () => {
    assert.deepEqual(channelsOf(mixHex("#000000", "#FFFFFF", 0.5)), { r: 128, g: 128, b: 128 });
  });

  it("clamps rather than extrapolating", () => {
    // The flash divides by a duration; a stale countdown must not invent a
    // colour brighter than the flash itself.
    assert.equal(mixHex("#000000", "#FFFFFF", 5), "#FFFFFF");
    assert.equal(mixHex("#000000", "#FFFFFF", -3), "#000000");
  });
});

describe("hit flash", () => {
  it("is armed by losing a symbol, whatever removed it", () => {
    const gestured = new Entity({ x: 0, y: 0, size: 40, sequence: "__" });
    gestured.color = ENEMY.color;
    gestured.decrementSequence("horizontal");
    assert.equal(gestured.hitFlashMs, HIT_FLASH.durationMs);

    const meleed = new Entity({ x: 0, y: 0, size: 40, sequence: "__" });
    meleed.color = ENEMY.color;
    meleed.stripSymbol();
    assert.equal(meleed.hitFlashMs, HIT_FLASH.durationMs, "the melee confirms too");
  });

  it("stays dark for a gesture that missed", () => {
    // The point of the effect is telling a hit from a miss, so a wrong glyph —
    // which is already a no-op — must not light anything up.
    const entity = new Entity({ x: 0, y: 0, size: 40, sequence: "__" });
    entity.color = ENEMY.color;

    assert.equal(entity.decrementSequence("vertical"), false);
    assert.equal(entity.hitFlashMs, 0);
    assert.equal(entity.displayColor, ENEMY.color);
  });

  it("does not fire on an empty sequence", () => {
    const entity = new Entity({ x: 0, y: 0, size: 40, sequence: "" });
    assert.equal(entity.stripSymbol(), null);
    assert.equal(entity.hitFlashMs, 0);
  });

  it("goes pale on impact and fades back, rather than easing both ways", () => {
    const entity = new Entity({ x: 0, y: 0, size: 40, sequence: "___" });
    entity.color = ENEMY.color;
    entity.stripSymbol();

    const onImpact = entity.displayColor;
    assert.equal(onImpact, HIT_FLASH.color, "full flash on the frame of the hit");

    entity.tickHitFlash(HIT_FLASH.durationMs / 2);
    const midway = entity.displayColor;
    assert.ok(
      brightness(ENEMY.color) < brightness(midway) && brightness(midway) < brightness(onImpact),
      "halfway through, it sits between the flash and the base colour",
    );
  });

  it("returns to exactly the original colour, leaving nothing behind", () => {
    const entity = new Entity({ x: 0, y: 0, size: 40, sequence: "___" });
    entity.color = ENEMY.color;
    entity.stripSymbol();

    entity.tickHitFlash(HIT_FLASH.durationMs);
    assert.equal(entity.hitFlashMs, 0);
    assert.equal(entity.displayColor, ENEMY.color, "not merely close — the same value");
  });

  it("never runs negative on a stalled frame", () => {
    const entity = new Entity({ x: 0, y: 0, size: 40, sequence: "___" });
    entity.color = ENEMY.color;
    entity.stripSymbol();
    entity.tickHitFlash(60_000);

    assert.equal(entity.hitFlashMs, 0);
  });

  it("brightens every enemy type, which is why the flash is pale", () => {
    // Grey, purple and orange have nothing in common except being darker than
    // the flash. A saturated confirmation colour would read on one and vanish
    // on another.
    for (const color of [ENEMY.color, RARE_ENEMY.color]) {
      assert.ok(
        brightness(HIT_FLASH.color) > brightness(color),
        `${color} would not brighten`,
      );
    }
  });

  it("is short enough to stack up under the melee cadence", () => {
    assert.ok(HIT_FLASH.durationMs < 200, "a long flash would blur consecutive hits");
  });
});

describe("the player blinks too", () => {
  it("goes pale when something lands on it, and fades back to green", () => {
    // `Player` does not extend `Entity` — it carries no glyph sequence — so
    // the flash reaches it through `tools/hit-flash.js` rather than by
    // inheritance. Same white: in this game white means "that took a hit".
    const player = new Player({ x: 100, y: 100 });
    assert.equal(player.displayColor, PLAYER.color);

    player.takeHit();
    assert.equal(player.displayColor, HIT_FLASH.color);

    for (let elapsed = 0; elapsed < HIT_FLASH.durationMs; elapsed += FRAME) {
      player.update(FRAME, { x: 0, y: 0 }, { width: 1300, height: 1200 });
    }
    assert.equal(player.hitFlashMs, 0);
    assert.equal(player.displayColor, PLAYER.color);
  });

  it("re-arms on the next hit, since there are no invulnerability frames", () => {
    const player = new Player({ x: 100, y: 100 });
    player.takeHit();
    player.update(FRAME, { x: 0, y: 0 }, { width: 1300, height: 1200 });
    const faded = player.hitFlashMs;

    player.takeHit();
    assert.ok(player.hitFlashMs > faded, "a second shot must show as a second hit");
  });
});

describe("hit flash on the real entities", () => {
  /** @param {"common"|"rare"} variant */
  const enemyOf = (variant) => {
    const enemy = new Enemy({ fieldWidth: 1300, rng: createSeededRandom(4), variant });
    enemy.sequence = "___";
    return enemy;
  };

  it("fades out through update(), like every other timer", () => {
    const enemy = enemyOf("common");
    enemy.stripSymbol();

    advance(enemy, HIT_FLASH.durationMs);
    assert.equal(enemy.hitFlashMs, 0);
    assert.equal(enemy.displayColor, ENEMY.color);
  });

  it("covers grey and rare enemies alike", () => {
    for (const variant of /** @type {const} */ (["common", "rare"])) {
      const enemy = enemyOf(variant);
      const resting = enemy.displayColor;
      enemy.stripSymbol();

      assert.notEqual(enemy.displayColor, resting, `${variant} shows nothing`);
      assert.ok(brightness(enemy.displayColor) > brightness(resting));
    }
  });

  it("fades back to the frost tint on a frozen enemy, not to grey", () => {
    // Why Enemy overrides `baseColor` and not `displayColor`: the two states
    // have to compose, or hitting a frozen enemy would thaw it visually.
    const enemy = enemyOf("common");
    enemy.applySlow(5000);
    enemy.stripSymbol();

    assert.notEqual(enemy.displayColor, FROST_ENEMY_COLOR, "it still flashes while frozen");
    advance(enemy, HIT_FLASH.durationMs);
    assert.equal(enemy.displayColor, FROST_ENEMY_COLOR);
  });

  it("confirms a boss hit, and stays quiet while it is invincible", () => {
    const boss = new Boss({ fieldWidth: 1300, rng: createSeededRandom(9) });
    boss.stripSymbol();
    assert.equal(boss.hitFlashMs, HIT_FLASH.durationMs);

    advance(boss, HIT_FLASH.durationMs);
    boss.sequence = "";
    boss.resolveClearedSequence();

    assert.equal(boss.stripSymbol(), null, "a retreating boss takes no hit…");
    assert.equal(boss.hitFlashMs, 0, "…so nothing confirms one");
  });

  it("reaches every target of one gesture, not just the first", () => {
    const enemies = [enemyOf("common"), enemyOf("common")];
    const boss = new Boss({ fieldWidth: 1300, rng: createSeededRandom(9) });
    boss.sequence = "___";

    resolveGesture("horizontal", { enemies, boss });
    for (const entity of [...enemies, boss]) {
      assert.equal(entity.hitFlashMs, HIT_FLASH.durationMs);
    }
  });

  it("reaches every target inside the melee circle", () => {
    const player = new Player({ x: 600, y: 600 });
    player.meleeCooldownMs = 0;
    const enemies = [enemyOf("common"), enemyOf("common")];
    for (const enemy of enemies) {
      enemy.x = player.x;
      enemy.y = player.y;
    }

    assert.ok(resolveMelee(player, { enemies }));
    for (const enemy of enemies) {
      assert.equal(enemy.hitFlashMs, HIT_FLASH.durationMs);
    }
  });
});
