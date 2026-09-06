import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MANA_ORB } from "../src/config/pickups.js";
import { PLAYER, TIME } from "../src/config/settings.js";
import { LASER, PROJECTILE, TURRET, VOLLEY } from "../src/config/turret.js";
import { Player } from "../src/entities/player.js";
import { Projectile } from "../src/entities/projectile.js";
import { TURRET_PHASE, Turret } from "../src/entities/turret.js";
import { beamDamage, hitsPlayer, resolveProjectiles } from "../src/game/boss-attacks.js";
import { Gauge } from "../src/game/gauge.js";
import { angleDelta, distanceToRay, normalizeAngle, turnToward } from "../src/tools/aim.js";
import { createSeededRandom, weightedPick } from "../src/tools/random.js";

const FRAME = TIME.referenceFrameMs;
const MOUNT = Object.freeze({ x: 600, y: 200, size: 160 });
const BOUNDS = Object.freeze({ width: 1300, height: 1200 });

/** A turret that can only ever roll one pattern, so a test can name it. */
function turretOf(pattern, seed = 1) {
  return new Turret({
    rng: createSeededRandom(seed),
    traits: { ...TURRET, patterns: [{ id: pattern, weight: 1 }] },
  });
}

/**
 * Drives a turret in real frames and collects everything it fired.
 *
 * Frame by frame rather than one big tick: `clampDelta` caps a step at 100 ms,
 * so a single `update(2500)` would advance the cooldown by 100.
 *
 * @param {Turret} turret
 * @param {number} ms
 * @param {object} [context]
 * @returns {Projectile[]}
 */
function run(turret, ms, context = {}) {
  const shots = [];
  for (let elapsed = 0; elapsed < ms; elapsed += FRAME) {
    shots.push(...turret.update(FRAME, { origin: MOUNT, target: { x: 600, y: 900 }, ...context }));
  }
  return shots;
}

/** @returns {Player} */
const playerAt = (x, y) => new Player({ x: x - PLAYER.size / 2, y: y - PLAYER.size / 2 });

describe("aim geometry", () => {
  it("wraps angles into a half turn either way", () => {
    assert.ok(Math.abs(normalizeAngle(3 * Math.PI)) - Math.PI < 1e-9);
    assert.ok(Math.abs(normalizeAngle(-3 * Math.PI)) - Math.PI < 1e-9);
    assert.equal(normalizeAngle(0), 0);
  });

  it("takes the short way round, even across the half turn", () => {
    // The case that matters: a player crossing behind the turret. Measured
    // naively the barrel would swing almost all the way round to follow.
    const delta = angleDelta(Math.PI - 0.1, -Math.PI + 0.1);
    assert.ok(Math.abs(delta) < 0.3, `expected a short hop, got ${delta}`);
    assert.ok(delta > 0, "and in the direction that crosses the seam");
  });

  it("caps the step, which is what lets the player escape", () => {
    // Without the cap the barrel would simply be assigned the player's angle
    // every frame, and no amount of running could ever break the lock.
    const stepped = turnToward(0, Math.PI / 2, 0.1);
    assert.ok(Math.abs(stepped - 0.1) < 1e-9);
  });

  it("lands exactly on target once within reach, without overshooting", () => {
    assert.ok(Math.abs(turnToward(0, 0.05, 0.1) - 0.05) < 1e-9);
  });

  it("measures to a ray forward only, so behind the barrel is safe", () => {
    const ray = { x: 0, y: 0, angle: 0 };
    assert.equal(distanceToRay({ x: 100, y: 0 }, ray), 0, "straight down the beam");
    assert.equal(distanceToRay({ x: 100, y: 30 }, ray), 30, "beside it");
    assert.equal(distanceToRay({ x: -100, y: 0 }, ray), 100, "behind it is 100 away, not on it");
  });
});

describe("weightedPick", () => {
  it("respects the weights over a large sample", () => {
    const rng = createSeededRandom(9);
    const entries = TURRET.patterns;
    let lasers = 0;
    const draws = 5000;

    for (let index = 0; index < draws; index += 1) {
      if (weightedPick(rng, entries) === "laser") lasers += 1;
    }
    const share = lasers / draws;
    assert.ok(Math.abs(share - 0.2) < 0.03, `expected about 1 in 5, got ${share.toFixed(3)}`);
  });

  it("never returns nothing, even on degenerate weights", () => {
    const rng = createSeededRandom(3);
    assert.equal(weightedPick(rng, [{ id: "only", weight: 0 }]), "only");
  });
});

describe("Turret aiming", () => {
  it("turns towards the player without snapping onto them", () => {
    const turret = turretOf("volley");
    turret.angle = Math.PI / 2;
    const target = { x: MOUNT.x - 600, y: MOUNT.y };

    turret.update(FRAME, { origin: MOUNT, target, canFire: false });
    const afterOne = turret.angle;

    assert.notEqual(afterOne, Math.PI / 2, "it must move");
    assert.ok(Math.abs(angleDelta(afterOne, Math.PI)) > 1, "but nowhere near the target yet");
  });

  it("keeps aiming while it is forbidden to fire", () => {
    // The barrel tracking through the boss retreat is what makes its return
    // readable — a frozen barrel would snap round the instant firing resumed.
    const turret = turretOf("volley");
    turret.angle = 0;
    const before = turret.angle;

    run(turret, 200, { canFire: false, target: { x: MOUNT.x, y: MOUNT.y + 500 } });
    assert.notEqual(turret.angle, before);
  });

  it("converges on a still target given enough time", () => {
    const turret = turretOf("volley");
    turret.angle = 0;
    const target = { x: MOUNT.x, y: MOUNT.y + 500 };

    run(turret, 2000, { canFire: false, target });
    assert.ok(Math.abs(angleDelta(turret.angle, Math.PI / 2)) < 0.01);
  });

  it("clamps rotation on a stalled frame like every other delta consumer", () => {
    const slow = turretOf("volley");
    const stalled = turretOf("volley");
    slow.angle = stalled.angle = 0;
    const target = { x: MOUNT.x - 500, y: MOUNT.y };

    slow.update(TIME.maxFrameMs, { origin: MOUNT, target, canFire: false });
    stalled.update(60_000, { origin: MOUNT, target, canFire: false });
    assert.equal(stalled.angle, slow.angle, "a 60s frame must not spin the barrel round");
  });
});

describe("Turret volley", () => {
  it("waits out the cooldown before the first shot", () => {
    const turret = turretOf("volley");
    assert.equal(run(turret, TURRET.cooldownMs - 200).length, 0);
  });

  it("fires exactly three shots, then falls silent", () => {
    const turret = turretOf("volley");
    const burst = run(turret, TURRET.cooldownMs + 600);

    assert.equal(burst.length, VOLLEY.shots);
    assert.equal(run(turret, 1500).length, 0, "the cooldown must hold it");
  });

  it("comes back after the cooldown, and only then", () => {
    const turret = turretOf("volley");
    run(turret, TURRET.cooldownMs + 600);
    assert.equal(run(turret, TURRET.cooldownMs + 600).length, VOLLEY.shots);
  });

  it("fans the burst out when the player moves, without a spread setting", () => {
    // The three divergent shots come from the barrel still tracking during the
    // burst. There is no spread parameter, and there should not be one.
    const turret = turretOf("volley");
    let y = 900;
    const burst = [];
    for (let elapsed = 0; elapsed < TURRET.cooldownMs + 600; elapsed += FRAME) {
      y -= 6;
      burst.push(...turret.update(FRAME, { origin: MOUNT, target: { x: 100, y } }));
    }

    const angles = new Set(burst.map((shot) => shot.angle));
    assert.equal(burst.length, VOLLEY.shots);
    assert.equal(angles.size, VOLLEY.shots, "every shot should leave on its own angle");
  });

  it("fires from the muzzle, clear of the dome", () => {
    const turret = turretOf("volley");
    const [shot] = run(turret, TURRET.cooldownMs + 100);
    const reach = Math.hypot(shot.x - MOUNT.x, shot.y - MOUNT.y);

    assert.ok(reach > MOUNT.size * TURRET.circleRatio, "a shot must not be born under the dome");
  });

  it("holds its fire entirely while the boss is invincible", () => {
    const turret = turretOf("volley");
    assert.equal(run(turret, 10_000, { canFire: false }).length, 0);
  });

  it("gives one clear beat after the boss comes back", () => {
    const turret = turretOf("volley");
    run(turret, 10_000, { canFire: false });
    assert.equal(run(turret, TURRET.cooldownMs - 200).length, 0, "no instant volley on return");
    assert.ok(run(turret, 800).length > 0);
  });
});

describe("Turret laser", () => {
  it("shows the tell before the beam exists", () => {
    const turret = turretOf("laser");
    run(turret, TURRET.cooldownMs + 100);

    assert.equal(turret.isCharging, true);
    assert.equal(turret.beam, null, "the tell must not burn");
  });

  it("burns for its duration, then stops", () => {
    const turret = turretOf("laser");
    run(turret, TURRET.cooldownMs + LASER.chargeMs + 100);
    assert.ok(turret.beam, "the beam should be live");
    assert.equal(turret.isCharging, false);

    run(turret, LASER.durationMs);
    assert.equal(turret.beam, null);
  });

  it("keeps the beam on the barrel, so it sweeps", () => {
    const turret = turretOf("laser");
    run(turret, TURRET.cooldownMs + LASER.chargeMs + 100);
    const first = turret.beam.angle;

    run(turret, 400, { target: { x: 0, y: MOUNT.y } });
    assert.notEqual(turret.beam.angle, first, "a beam that did not follow would be a wall");
    assert.equal(turret.beam.angle, turret.angle);
  });

  it("goes out the moment the boss turns invincible", () => {
    const turret = turretOf("laser");
    run(turret, TURRET.cooldownMs + LASER.chargeMs + 100);
    assert.ok(turret.beam);

    turret.update(FRAME, { origin: MOUNT, target: { x: 0, y: 0 }, canFire: false });
    assert.equal(turret.beam, null);
    assert.equal(turret.phase, TURRET_PHASE.idle);
  });
});

describe("Projectile", () => {
  it("is exactly a mana orb across", () => {
    assert.equal(PROJECTILE.radius, MANA_ORB.radius);
  });

  it("travels along its angle, frame-rate independent", () => {
    const slow = new Projectile({ x: 0, y: 0, angle: 0 });
    const fast = new Projectile({ x: 0, y: 0, angle: 0 });

    slow.update(FRAME * 2);
    fast.update(FRAME);
    fast.update(FRAME);
    assert.ok(Math.abs(slow.x - fast.x) < 1e-9);
  });

  it("clamps a stalled frame instead of teleporting", () => {
    const shot = new Projectile({ x: 0, y: 0, angle: 0 });
    shot.update(60_000);
    assert.ok(shot.x <= PROJECTILE.speed * (TIME.maxFrameMs / FRAME) + 1e-9);
  });

  it("leaves by any of the four edges, not just the bottom", () => {
    // An orb only ever falls, so `Pickup` watches one edge. A shot aimed
    // sideways or upward would otherwise sit in the array forever.
    const corners = [
      { x: -20, y: 600 },
      { x: 600, y: -20 },
      { x: BOUNDS.width + 20, y: 600 },
      { x: 600, y: BOUNDS.height + 20 },
    ];
    for (const { x, y } of corners) {
      const shot = new Projectile({ x, y, angle: 0 });
      assert.equal(shot.hasEscaped(BOUNDS), true, `${x},${y} should be gone`);
    }
    assert.equal(new Projectile({ x: 600, y: 600, angle: 0 }).hasEscaped(BOUNDS), false);
  });
});

describe("projectiles against the player", () => {
  it("takes health and removes the shot that landed", () => {
    const player = playerAt(600, 600);
    const hit = new Projectile({ x: 600, y: 600, angle: 0 });
    const miss = new Projectile({ x: 100, y: 100, angle: 0 });

    const result = resolveProjectiles(player, [hit, miss], { bounds: BOUNDS, deltaMs: 0 });
    assert.equal(result.damage, PROJECTILE.damage);
    assert.deepEqual(result.remaining, [miss]);
  });

  it("charges for every shot of a burst that connects", () => {
    // No invulnerability window: standing still through all three is meant to
    // cost all three.
    const player = playerAt(600, 600);
    const burst = [0, 1, 2].map(() => new Projectile({ x: 600, y: 600, angle: 0 }));

    const result = resolveProjectiles(player, burst, { bounds: BOUNDS, deltaMs: 0 });
    assert.equal(result.damage, PROJECTILE.damage * 3);
    assert.deepEqual(result.remaining, []);
  });

  it("drops what left the board without charging for it", () => {
    const player = playerAt(600, 600);
    const gone = new Projectile({ x: -60, y: 600, angle: Math.PI });

    const result = resolveProjectiles(player, [gone], { bounds: BOUNDS, deltaMs: FRAME });
    assert.deepEqual(result.remaining, []);
    assert.equal(result.damage, 0);
  });

  it("does not borrow the pickup magnet, which would land early hits", () => {
    // `isTouching()` adds 10 forgiving pixels to help you catch an orb. The
    // same favour on an incoming shot lands hits before anything touches.
    const player = playerAt(600, 600);
    const reach = PLAYER.size / 2 + PROJECTILE.radius;
    const justOutside = new Projectile({ x: 600 + reach + 4, y: 600, angle: 0 });

    assert.equal(hitsPlayer(player, justOutside), false);
    assert.equal(hitsPlayer(player, new Projectile({ x: 600 + reach - 1, y: 600, angle: 0 })), true);
  });
});

describe("the beam against the player", () => {
  const beam = Object.freeze({ x: 600, y: 200, angle: Math.PI / 2, width: LASER.beamWidth });

  it("charges by the second, not by the tick", () => {
    const player = playerAt(600, 800);
    const oneSecond = beamDamage(player, beam, 1000 / 10) * 10;
    assert.ok(Math.abs(oneSecond - LASER.dps) < 1e-9);
  });

  it("costs a full pass through it exactly one projectile", () => {
    assert.equal((LASER.dps * LASER.durationMs) / 1000, PROJECTILE.damage);
  });

  it("spares anyone standing clear of it", () => {
    const clear = playerAt(600 + LASER.beamWidth / 2 + PLAYER.size / 2 + 5, 800);
    assert.equal(beamDamage(clear, beam, FRAME), 0);
  });

  it("spares anyone behind the barrel", () => {
    // A beam that damaged its own back side would be impossible to read.
    assert.equal(beamDamage(playerAt(600, 100), beam, FRAME), 0);
  });

  it("charges nothing when there is no beam", () => {
    assert.equal(beamDamage(playerAt(600, 800), null, FRAME), 0);
  });

  it("clamps a stalled frame, or one would empty the bar unseen", () => {
    const player = playerAt(600, 800);
    assert.equal(beamDamage(player, beam, 60_000), beamDamage(player, beam, TIME.maxFrameMs));
  });

  it("matches the mana gauge in width, as the sketch asks", async () => {
    const { GAUGE } = await import("../src/render/gauges.js");
    // `config/` cannot import `render/`, so the link is pinned here instead.
    assert.equal(LASER.beamWidth, GAUGE.thickness);
  });
});

describe("Gauge.drain", () => {
  it("takes what it can and floors at zero", () => {
    const gauge = new Gauge({ max: 150, start: 5, regenPerSecond: 0 });
    assert.equal(gauge.drain(10), 5);
    assert.equal(gauge.value, 0);
    assert.equal(gauge.isEmpty, true);
  });

  it("is what stops five health points from being immortality", () => {
    // `spend()` is all-or-nothing: it would refuse 10 forever at 5 left.
    const gauge = new Gauge({ max: 150, start: 5, regenPerSecond: 0 });
    assert.equal(gauge.spend(10), false, "the mana rule, unchanged");
    assert.equal(gauge.value, 5);
  });

  it("ignores a non-positive amount", () => {
    const gauge = new Gauge({ max: 150, start: 100, regenPerSecond: 0 });
    assert.equal(gauge.drain(0), 0);
    assert.equal(gauge.drain(-20), 0);
    assert.equal(gauge.value, 100);
  });
});
