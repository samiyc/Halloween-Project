import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MANA } from "../src/config/mana.js";
import { PLAYER, TIME } from "../src/config/settings.js";
import {
  BUFF_HALOS,
  FROST_ENEMY_COLOR,
  SPELLS,
  SPELL_COLORS,
  SPELL_IDS,
  spellColorOf,
  spellRangeOf,
} from "../src/config/spells.js";
import { Enemy } from "../src/entities/enemy.js";
import { Player } from "../src/entities/player.js";
import { EffectTracker } from "../src/game/effects.js";
import { Game } from "../src/game/game.js";
import { applyFrost, applySpell } from "../src/game/spellbook.js";
import { createSeededRandom } from "../src/tools/random.js";

const FRAME = TIME.referenceFrameMs;
const BOUNDS = { width: 1200, height: 900 };
const BOX = { width: 5000, height: 5000 };

/** @returns {Game} */
const seededGame = (seed = 42) =>
  new Game({ bounds: BOUNDS, rng: createSeededRandom(seed) });

describe("EffectTracker", () => {
  it("expires an effect after its duration", () => {
    const effects = new EffectTracker();
    effects.activate("frenzy", 100);

    assert.equal(effects.isActive("frenzy"), true);
    effects.tick(99);
    assert.equal(effects.isActive("frenzy"), true);
    effects.tick(2);
    assert.equal(effects.isActive("frenzy"), false);
  });

  it("refreshes rather than stacks", () => {
    const effects = new EffectTracker();
    effects.activate("haste", 100);
    effects.tick(60);
    effects.activate("haste", 100);
    assert.equal(effects.remainingMs("haste"), 100);
  });

  it("clamps a stalled frame instead of expiring everything at once", () => {
    const effects = new EffectTracker();
    effects.activate("haste", 8000);
    effects.tick(60_000);
    assert.equal(effects.isActive("haste"), true, "one long frame must not eat 8s");
    assert.equal(effects.remainingMs("haste"), 8000 - TIME.maxFrameMs);
  });

  it("ignores a zero or negative duration", () => {
    const effects = new EffectTracker();
    effects.activate("potion", 0);
    assert.deepEqual(effects.activeIds(), []);
  });

  it("tracks several effects at once", () => {
    const effects = new EffectTracker();
    effects.activate("frenzy", 100);
    effects.activate("haste", 200);
    effects.tick(150);
    assert.deepEqual(effects.activeIds(), ["haste"]);
  });
});

describe("player buffs", () => {
  it("speeds up movement under Célérité", () => {
    const player = new Player({ x: 0, y: 0 });
    assert.equal(player.effectiveSpeed, PLAYER.speed);

    player.effects.activate(SPELLS.haste.id, SPELLS.haste.durationMs);
    assert.equal(player.effectiveSpeed, PLAYER.speed * SPELLS.haste.moveSpeedMultiplier);

    const plain = new Player({ x: 0, y: 0 });
    plain.update(FRAME, { x: 1, y: 0 }, BOX);
    player.update(FRAME, { x: 1, y: 0 }, BOX);
    assert.ok(player.x > plain.x, "the buff must actually move the player further");
  });

  it("shortens the melee cooldown under Frénésie", () => {
    const player = new Player({ x: 0, y: 0 });
    player.effects.activate(SPELLS.frenzy.id, SPELLS.frenzy.durationMs);

    assert.equal(
      player.effectiveMeleeCooldownMs,
      PLAYER.meleeCooldownMs / SPELLS.frenzy.attackSpeedMultiplier,
    );

    player.startMeleeCooldown();
    assert.equal(player.meleeCooldownMs, 1000, "1500ms becomes 1000ms");
  });

  it("keeps the cooldown ratio inside 0..1 when Frénésie lands mid-cooldown", () => {
    // The trap: with a fixed denominator, shortening the cooldown while one is
    // running makes the HUD bar overflow its track.
    const player = new Player({ x: 0, y: 0 });
    player.startMeleeCooldown();
    player.effects.activate(SPELLS.frenzy.id, SPELLS.frenzy.durationMs);

    assert.ok(player.meleeChargeRatio <= 1, `ratio was ${player.meleeChargeRatio}`);
    assert.ok(player.meleeChargeRatio >= 0);
  });

  it("lets both buffs run at once", () => {
    const player = new Player({ x: 0, y: 0 });
    player.effects.activate(SPELLS.frenzy.id, 8000);
    player.effects.activate(SPELLS.haste.id, 8000);
    assert.equal(player.effectiveSpeed, PLAYER.speed * 1.5);
    assert.equal(player.effectiveMeleeCooldownMs, PLAYER.meleeCooldownMs / 1.5);
  });

  it("ticks its own effects down as it updates", () => {
    const player = new Player({ x: 0, y: 0 });
    player.effects.activate(SPELLS.haste.id, 100);
    player.update(FRAME, { x: 0, y: 0 }, BOX);
    assert.ok(player.effects.remainingMs(SPELLS.haste.id) < 100);
  });
});

describe("enemy slow", () => {
  /** @returns {Enemy} */
  const anEnemy = (seed = 1) =>
    new Enemy({ fieldWidth: BOUNDS.width, rng: createSeededRandom(seed) });

  it("halves speed and retints while frozen", () => {
    const enemy = anEnemy();
    const normal = enemy.effectiveSpeed;

    enemy.applySlow(SPELLS.frost.durationMs);
    assert.equal(enemy.effectiveSpeed, normal * SPELLS.frost.slowFactor);
    assert.notEqual(enemy.displayColor, enemy.color, "a frozen enemy must look frozen");
  });

  it("actually falls slower", () => {
    const fast = anEnemy(4);
    const slow = anEnemy(4);
    slow.applySlow(SPELLS.frost.durationMs);

    for (let frame = 0; frame < 30; frame += 1) {
      fast.update(FRAME);
      slow.update(FRAME);
    }
    assert.ok(slow.y < fast.y);
  });

  it("recovers its speed and colour when the slow expires", () => {
    const enemy = anEnemy(6);
    enemy.applySlow(100);
    for (let frame = 0; frame < 10; frame += 1) enemy.update(FRAME);

    assert.equal(enemy.slowRemainingMs, 0);
    assert.equal(enemy.effectiveSpeed, enemy.speed);
    assert.equal(enemy.displayColor, enemy.color);
  });

  it("refreshes rather than stacks", () => {
    const enemy = anEnemy(8);
    enemy.applySlow(1000);
    enemy.applySlow(500);
    assert.equal(enemy.slowRemainingMs, 1000, "the shorter cast must not shorten it");
  });

  it("clamps a stalled frame", () => {
    const enemy = anEnemy(9);
    enemy.applySlow(8000);
    enemy.update(60_000);
    assert.equal(enemy.slowRemainingMs, 8000 - TIME.maxFrameMs);
  });
});

describe("spellbook", () => {
  it("declares a handler for every spell in the registry", () => {
    // The guard against a spell that exists in config but does nothing.
    const game = seededGame();
    for (const id of SPELL_IDS) {
      assert.equal(applySpell(id, game), true, `no handler for "${id}"`);
    }
  });

  it("gives every timed buff a halo colour", () => {
    for (const spell of Object.values(SPELLS)) {
      if (spell.durationMs === 0 || spell.id === SPELLS.frost.id) continue;
      assert.ok(BUFF_HALOS[spell.id], `"${spell.id}" lasts 8s but has no visible signal`);
    }
  });

  it("refuses an unknown spell instead of throwing", () => {
    assert.equal(applySpell("nope", seededGame()), false);
  });

  it("Grande potion tops the gauge up without overflowing it", () => {
    const game = seededGame();
    game.mana.value = 0;
    applySpell("potion", game);
    assert.equal(game.mana.value, SPELLS.potion.manaGain);

    game.mana.value = MANA.max;
    applySpell("potion", game);
    assert.equal(game.mana.value, MANA.max);
  });

  it("Givre catches enemies in range and spares the rest", () => {
    const game = seededGame();
    const near = game.spawner.create();
    const far = game.spawner.create();
    near.x = game.player.x;
    near.y = game.player.y;
    far.x = game.player.x;
    far.y = game.player.y - SPELLS.frost.radius - 100;
    game.enemies = [near, far];

    assert.equal(applyFrost(game), 1);
    assert.ok(near.slowRemainingMs > 0);
    assert.equal(far.slowRemainingMs, 0);
  });

  it("Givre leaves the boss alone", () => {
    // The boss has its own invincibility phase and a tuned descent; a pickup
    // must not quietly rewrite the pacing of the fight.
    const game = seededGame();
    game.boss.x = game.player.x;
    game.boss.y = game.player.y;
    applyFrost(game);
    assert.equal(game.boss.slowRemainingMs, undefined);
  });
});

/**
 * Hue of a `#rrggbb` colour, in degrees.
 * @param {string} hex
 * @returns {number}
 */
function hueOf(hex) {
  const value = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const span = max - Math.min(r, g, b);
  if (span === 0) return 0;

  let sector = (g - b) / span;
  if (max === g) sector = (b - r) / span + 2;
  if (max === b) sector = (r - g) / span + 4;
  return ((sector * 60) % 360 + 360) % 360;
}

/**
 * Shortest distance between two hues, in degrees.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function hueGap(a, b) {
  const raw = Math.abs(a - b);
  return Math.min(raw, 360 - raw);
}

describe("spell colours", () => {
  it("gives every spell a colour", () => {
    for (const id of SPELL_IDS) {
      assert.match(spellColorOf(id) ?? "", /^#[0-9A-Fa-f]{6}$/, `no colour for "${id}"`);
    }
    assert.equal(spellColorOf(null), null, "an empty slot has no colour of its own");
    assert.equal(spellColorOf("nope"), null);
  });

  it("keeps the hues far enough apart to tell at a glance", () => {
    // The point of the whole thing: identifying the held spell without reading
    // it. The first attempt reused the frost tint, the Célérité halo and the
    // mana blue, which sat within 20 degrees of each other — three cyans.
    const entries = SPELL_IDS.map((id) => [id, hueOf(SPELL_COLORS[id])]);

    for (const [idA, hueA] of entries) {
      for (const [idB, hueB] of entries) {
        if (idA >= idB) continue;
        const gap = hueGap(hueA, hueB);
        assert.ok(gap >= 45, `"${idA}" and "${idB}" are only ${Math.round(gap)} degrees apart`);
      }
    }
  });

  it("matches each halo to the colour shown in the slot", () => {
    // Otherwise the ring you get after casting contradicts what you just saw.
    for (const [id, halo] of Object.entries(BUFF_HALOS)) {
      assert.equal(halo, spellColorOf(id), `the "${id}" halo drifted from its slot colour`);
    }
  });

  it("tints frozen enemies with the Givre colour itself", () => {
    assert.equal(FROST_ENEMY_COLOR, SPELL_COLORS.frost);
  });
});

describe("spellRangeOf", () => {
  it("gives Givre its radius and nothing else a range", () => {
    assert.equal(spellRangeOf(SPELLS.frost.id), SPELLS.frost.radius);
    assert.equal(spellRangeOf(SPELLS.frenzy.id), null);
    assert.equal(spellRangeOf(SPELLS.haste.id), null);
    assert.equal(spellRangeOf(SPELLS.potion.id), null);
  });

  it("returns null for an empty slot, so nothing is previewed", () => {
    assert.equal(spellRangeOf(null), null);
    assert.equal(spellRangeOf("nope"), null);
  });

  it("keeps every spell area scaled with the world", () => {
    // The guard for a real miss: the world was scaled x1.6 and this radius was
    // left behind, quietly dropping Givre from ~4x the melee reach to 2.7x.
    // Anything covering an area must stay a zone tool, not a second melee.
    for (const spell of Object.values(SPELLS)) {
      if (spell.radius === undefined) continue;
      assert.ok(
        spell.radius > PLAYER.meleeRange * 3,
        `"${spell.id}" covers ${spell.radius}px against a ${PLAYER.meleeRange}px melee`,
      );
    }
  });
});

describe("Game spell slot", () => {
  it("casts nothing when the slot is empty", () => {
    const game = seededGame();
    assert.equal(game.heldSpell, null);
    assert.equal(game.castSpell(), null);
  });

  it("empties the slot when cast, so one orb grants exactly one cast", () => {
    const game = seededGame();
    game.heldSpell = "haste";

    assert.equal(game.castSpell(), "haste");
    assert.equal(game.heldSpell, null);
    assert.equal(game.castSpell(), null, "no free second use");
    assert.equal(game.player.effects.isActive("haste"), true);
  });

  it("costs no mana", () => {
    const game = seededGame();
    game.mana.value = 0;
    game.heldSpell = "frenzy";

    assert.equal(game.castSpell(), "frenzy");
    assert.equal(game.mana.value, 0, "an empty gauge must not block a spell");
  });

  it("refuses to cast once the game has ended", () => {
    const game = seededGame();
    game.heldSpell = "haste";
    game.status = "lost";
    assert.equal(game.castSpell(), null);
    assert.equal(game.heldSpell, "haste", "and must not consume the slot");
  });

  it("clears the slot on reset", () => {
    const game = seededGame();
    game.heldSpell = "potion";
    game.reset();
    assert.equal(game.heldSpell, null);
  });
});
