import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MANA_ORB, PICKUP_KIND, SPELL_ORB } from "../src/config/pickups.js";
import { TIME } from "../src/config/settings.js";
import { Pickup } from "../src/entities/pickup.js";
import { Player } from "../src/entities/player.js";
import { collectPickups, isTouching } from "../src/game/collection.js";
import { PickupSpawner } from "../src/game/pickup-spawner.js";
import { createSeededRandom } from "../src/tools/random.js";

const FRAME = TIME.referenceFrameMs;
const BOUNDS = { width: 1200, height: 900 };

/**
 * @param {object} [options]
 * @returns {Pickup}
 */
function orb({ kind = PICKUP_KIND.mana, x = 0, y = 0, traits = MANA_ORB } = {}) {
  return new Pickup({ kind, x, y, traits });
}

describe("Pickup", () => {
  it("falls at a frame-rate independent speed", () => {
    const at60 = orb();
    const at120 = orb();

    at60.update(FRAME);
    at120.update(FRAME / 2);
    at120.update(FRAME / 2);

    assert.ok(Math.abs(at60.y - at120.y) < 1e-9);
  });

  it("clamps a huge delta like every other moving thing", () => {
    const pickup = orb();
    pickup.update(60_000);
    assert.ok(pickup.y <= pickup.speed * (TIME.maxFrameMs / FRAME) + 1e-9);
  });

  it("counts as escaped only once fully past the bottom", () => {
    const pickup = orb({ y: BOUNDS.height });
    assert.equal(pickup.hasEscaped(BOUNDS.height), false, "still half on screen");
    pickup.y = BOUNDS.height + pickup.radius + 1;
    assert.equal(pickup.hasEscaped(BOUNDS.height), true);
  });

  it("reports its centre, since it is a circle", () => {
    const pickup = orb({ x: 40, y: 60 });
    assert.equal(pickup.centerX, 40);
    assert.equal(pickup.centerY, 60);
  });
});

describe("collectPickups", () => {
  /** @returns {Player} */
  const playerAt = (x, y) => new Player({ x, y });

  it("takes mana orbs the player touches and leaves the rest", () => {
    const player = playerAt(300, 300);
    const near = orb({ x: player.centerX, y: player.centerY });
    const far = orb({ x: player.centerX + 400, y: player.centerY });

    const result = collectPickups(player, [near, far], {
      fieldHeight: BOUNDS.height,
      canTakeSpell: true,
    });

    assert.equal(result.manaOrbs, 1);
    assert.deepEqual(result.remaining, [far]);
  });

  it("drops escaped orbs without crediting them", () => {
    const player = playerAt(0, 0);
    const gone = orb({ x: 600, y: BOUNDS.height + 50 });

    const result = collectPickups(player, [gone], {
      fieldHeight: BOUNDS.height,
      canTakeSpell: true,
    });

    assert.equal(result.manaOrbs, 0);
    assert.deepEqual(result.remaining, [], "a missed orb is gone, not banked");
  });

  it("takes a spell orb when the slot is free", () => {
    const player = playerAt(300, 300);
    const spellOrb = orb({
      kind: PICKUP_KIND.spell,
      x: player.centerX,
      y: player.centerY,
      traits: SPELL_ORB,
    });

    const result = collectPickups(player, [spellOrb], {
      fieldHeight: BOUNDS.height,
      canTakeSpell: true,
    });

    assert.equal(result.tookSpell, true);
    assert.deepEqual(result.remaining, []);
  });

  it("leaves a spell orb falling when a spell is already held", () => {
    // The design decision: rather than overwrite a spell being saved for the
    // right moment, the orb keeps falling and creates pressure to spend.
    const player = playerAt(300, 300);
    const spellOrb = orb({
      kind: PICKUP_KIND.spell,
      x: player.centerX,
      y: player.centerY,
      traits: SPELL_ORB,
    });

    const result = collectPickups(player, [spellOrb], {
      fieldHeight: BOUNDS.height,
      canTakeSpell: false,
    });

    assert.equal(result.tookSpell, false);
    assert.deepEqual(result.remaining, [spellOrb], "must keep falling, not vanish");
  });

  it("takes only one spell orb even when two overlap the player", () => {
    const player = playerAt(300, 300);
    const make = () =>
      orb({
        kind: PICKUP_KIND.spell,
        x: player.centerX,
        y: player.centerY,
        traits: SPELL_ORB,
      });
    const first = make();
    const second = make();

    const result = collectPickups(player, [first, second], {
      fieldHeight: BOUNDS.height,
      canTakeSpell: true,
    });

    assert.equal(result.tookSpell, true);
    assert.equal(result.remaining.length, 1, "the second must not be silently eaten");
  });

  it("collects several mana orbs in one frame", () => {
    const player = playerAt(300, 300);
    const orbs = [0, 4, -4].map((offset) =>
      orb({ x: player.centerX + offset, y: player.centerY }),
    );

    const result = collectPickups(player, orbs, {
      fieldHeight: BOUNDS.height,
      canTakeSpell: true,
    });

    assert.equal(result.manaOrbs, 3);
    assert.deepEqual(result.remaining, []);
  });
});

describe("isTouching", () => {
  it("is forgiving but bounded", () => {
    const player = new Player({ x: 300, y: 300 });
    const pickup = orb({ x: player.centerX, y: player.centerY });

    const reach = player.size / 2 + pickup.radius;
    pickup.x = player.centerX + reach;
    assert.equal(isTouching(player, pickup), true, "touching edges should count");

    pickup.x = player.centerX + reach + 40;
    assert.equal(isTouching(player, pickup), false, "but not from far away");
  });
});

describe("PickupSpawner", () => {
  /** @returns {PickupSpawner} */
  const spawner = (seed = 3) =>
    new PickupSpawner({ bounds: BOUNDS, rng: createSeededRandom(seed) });

  it("spawns mana orbs at a frame-rate independent rate", () => {
    const countOver = (frames, deltaMs) => {
      const s = spawner(11);
      let n = 0;
      for (let frame = 0; frame < frames; frame += 1) {
        n += s.tick(deltaMs).filter((p) => p.kind === PICKUP_KIND.mana).length;
      }
      return n;
    };

    const at60 = countOver(3600, FRAME);
    const at144 = countOver(8640, FRAME * (60 / 144));
    assert.ok(Math.abs(at60 - at144) / at60 < 0.2, `${at60} vs ${at144}`);
  });

  it("spaces spell orbs by the configured interval, never back to back", () => {
    const s = spawner(5);
    const gapsMs = [];
    let sinceLast = 0;

    for (let frame = 0; frame < 60 * 120; frame += 1) {
      sinceLast += FRAME;
      if (s.tick(FRAME).some((p) => p.kind === PICKUP_KIND.spell)) {
        gapsMs.push(sinceLast);
        sinceLast = 0;
      }
    }

    assert.ok(gapsMs.length >= 5, `expected several drops, got ${gapsMs.length}`);
    for (const gap of gapsMs) {
      assert.ok(
        gap >= SPELL_ORB.everyMsMin - FRAME && gap <= SPELL_ORB.everyMsMax + FRAME,
        `gap of ${gap}ms is outside the 15-20s window`,
      );
    }
  });

  it("spawns inside the field, fully on screen horizontally", () => {
    const s = spawner(7);
    for (let roll = 0; roll < 200; roll += 1) {
      const pickup = s.create(MANA_ORB);
      assert.ok(pickup.x - pickup.radius >= 0, `x=${pickup.x}`);
      assert.ok(pickup.x + pickup.radius <= BOUNDS.width, `x=${pickup.x}`);
    }
  });

  it("starts pickups above the top edge so they fall in", () => {
    const pickup = spawner().create(MANA_ORB);
    assert.ok(pickup.y <= 0);
  });
});
