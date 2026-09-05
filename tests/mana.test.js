import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GLYPHS } from "../src/config/glyphs.js";
import { MANA, castCost } from "../src/config/mana.js";
import { MANA_ORB, SPELL_ORB } from "../src/config/pickups.js";
import { ENEMY, SPAWN, TIME } from "../src/config/settings.js";
import { ManaPool } from "../src/game/mana.js";

const FRAME = TIME.referenceFrameMs;

describe("castCost", () => {
  it("charges triple for the rare glyphs", () => {
    assert.equal(castCost("horizontal"), MANA.costCommon);
    assert.equal(castCost("chevronUp"), MANA.costCommon);
    assert.equal(castCost("bolt"), MANA.costRare);
    assert.equal(castCost("spiral"), MANA.costRare);
    assert.equal(MANA.costRare, MANA.costCommon * 3);
  });

  it("reads rarity from the glyph registry rather than a second list", () => {
    // If someone adds a rare glyph, its cost must follow automatically.
    for (const glyph of Object.values(GLYPHS)) {
      const expected = glyph.rarity === "rare" ? MANA.costRare : MANA.costCommon;
      assert.equal(castCost(glyph.id), expected, `wrong cost for ${glyph.id}`);
    }
  });

  it("costs nothing for an unrecognised stroke", () => {
    // An unrecognised stroke casts nothing, so charging for it would punish an
    // accidental flick of the mouse.
    assert.equal(castCost(null), 0);
    assert.equal(castCost("bogus"), 0);
  });

  it("keeps a common gesture within reach of two orbs", () => {
    // The design intent was "a cast costs 2 orbs". Simulation showed that
    // exact ratio is not sustainable — supply peaks near 5.9 pts/s against a
    // 9-18 pts/s demand — so a cast is 1.6 orbs. The band below is what makes
    // the game winnable while keeping a cast feel like a couple of pickups.
    const orbsPerCast = MANA.costCommon / MANA.orbValue;
    assert.ok(orbsPerCast >= 1.2 && orbsPerCast <= 2, `${orbsPerCast} orbs per cast`);
  });

  it("keeps a rare glyph at exactly triple a common one", () => {
    assert.equal(MANA.costRare, MANA.costCommon * 3);
  });
});

describe("ManaPool", () => {
  it("starts at the configured value, not a hard-coded one", () => {
    // This test used to assert 0 because the design said "starts empty".
    // Raising MANA.start to 20 broke it, which is the wrong kind of failure:
    // it was pinning a tunable instead of an invariant. It now reads the
    // config, and only asserts what must hold whatever the value is.
    const pool = new ManaPool();
    assert.equal(pool.value, MANA.start);
    assert.ok(MANA.start < MANA.max, "a full starting gauge would defeat the point");
    assert.ok(
      MANA.start < MANA.costRare,
      "the opening reserve must not already pay for a rare glyph",
    );
  });

  it("spends all or nothing", () => {
    const pool = new ManaPool();
    pool.value = 0;
    pool.gain(15);

    assert.equal(pool.spend(20), false, "cannot part-pay");
    assert.equal(pool.value, 15, "a refused cast must not nibble the gauge");

    assert.equal(pool.spend(10), true);
    assert.equal(pool.value, 5);
  });

  it("never exceeds its maximum", () => {
    const pool = new ManaPool();
    pool.gain(1000);
    assert.equal(pool.value, MANA.max);
    assert.equal(pool.ratio, 1);
  });

  it("ignores non-positive gains", () => {
    const pool = new ManaPool();
    pool.value = 0;
    pool.gain(10);
    pool.gain(-5);
    pool.gain(0);
    assert.equal(pool.value, 10);
  });

  it("regenerates at the configured rate", () => {
    const pool = new ManaPool();
    pool.value = 0;
    // One second of 60Hz frames.
    for (let frame = 0; frame < 60; frame += 1) pool.regenerate(FRAME);
    assert.ok(Math.abs(pool.value - MANA.regenPerSecond) < 0.05);
  });

  it("does not refill from one long stalled frame", () => {
    // The bug already made once on the melee cooldown: an unclamped delta after
    // a tab switch hands you seconds of regeneration in a single step.
    const pool = new ManaPool();
    pool.value = 0;
    pool.regenerate(60_000);
    const maxPossible = (MANA.regenPerSecond * TIME.maxFrameMs) / 1000;
    assert.ok(pool.value <= maxPossible + 1e-9, `regenerated ${pool.value}`);
  });
});

describe("the economy holds together", () => {
  // These are the numbers documented in docs/mana-and-spells.md. If a tunable
  // moves, this test says so instead of the doc quietly going stale.
  const fps = 1000 / FRAME;
  const orbRate = MANA_ORB.chancePerFrame * fps;
  const avgEnemySpeed =
    ENEMY.baseSpeed +
    ENEMY.speedSpread / 2 -
    ((ENEMY.minSequence + ENEMY.maxSequence) / 2) * ENEMY.speedPerSymbol;

  it("drops orbs at 1.5x the enemy rate and speed", () => {
    assert.ok(Math.abs(MANA_ORB.chancePerFrame - SPAWN.chancePerFrame * 1.5) < 1e-9);
    assert.ok(Math.abs(MANA_ORB.speed - avgEnemySpeed * 1.5) < 0.01);
  });

  it("makes collecting worth clearly more than standing still", () => {
    // The whole reason an orb is worth 5 and not 1. At 1 the passive trickle
    // would out-earn collecting every orb on screen, and the orbs would be
    // decorative.
    const collectIncome = orbRate * MANA.orbValue;
    assert.ok(
      collectIncome > MANA.regenPerSecond * 3,
      `collection ${collectIncome.toFixed(2)}/s vs trickle ${MANA.regenPerSecond}/s`,
    );
  });

  it("leaves the passive trickle able to fund a cast, slowly", () => {
    // It is the anti-deadlock floor, so it must eventually pay for something,
    // without ever competing with going out and collecting.
    const secondsPerCast = MANA.costCommon / MANA.regenPerSecond;
    assert.ok(secondsPerCast >= 3 && secondsPerCast <= 8, `${secondsPerCast}s per cast`);
  });

  it("keeps a full gauge to a readable number of casts", () => {
    // Also a pinned tunable once: the bound was 15 and MANA.max going to 150
    // broke it. What actually matters is that the gauge empties within a fight
    // rather than banking a whole run, so the band is deliberately wide.
    const castsBanked = MANA.max / MANA.costCommon;
    assert.ok(
      castsBanked >= 8 && castsBanked <= 25,
      `${castsBanked} casts banked stops reading as a gauge`,
    );
  });

  it("makes the spell orb slower than a mana orb so it stays reachable", () => {
    assert.ok(SPELL_ORB.speed < MANA_ORB.speed);
    assert.ok(SPELL_ORB.everyMsMin < SPELL_ORB.everyMsMax);
  });
});
