import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MANA_ORB } from "../src/config/pickups.js";
import { PLAYER, TIME } from "../src/config/settings.js";
import {
  HEAVY,
  LASER,
  PHASE_PATTERNS,
  PROJECTILE,
  SPIRAL,
  TURRET,
  VOLLEY,
  patternsForPhase,
} from "../src/config/turret.js";
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

/**
 * A turret that can only ever roll one pattern, so a test can name it.
 *
 * The table is injected the way the generator is — a real turret reads it from
 * the boss's phase, which is exactly what a test about one attack does not want
 * to depend on.
 */
function turretOf(pattern, seed = 1) {
  return new Turret({
    rng: createSeededRandom(seed),
    patternsFor: () => [{ id: pattern, weight: 1 }],
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
    let lasers = 0;
    const draws = 5000;

    for (let index = 0; index < draws; index += 1) {
      if (weightedPick(rng, PHASE_PATTERNS[1]) === "laser") lasers += 1;
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

    turret.update(FRAME, { origin: MOUNT, target });
    const afterOne = turret.angle;

    assert.notEqual(afterOne, Math.PI / 2, "it must move");
    assert.ok(Math.abs(angleDelta(afterOne, Math.PI)) > 1, "but nowhere near the target yet");
  });

  it("freezes the barrel while it is forbidden to fire", () => {
    // The frozen barrel on a greyed dome is the tell that the boss is between
    // lives. An earlier version kept tracking through the retreat, which read
    // as a threat that could not actually fire.
    const turret = turretOf("volley");
    turret.angle = 0;

    run(turret, 400, { canFire: false, target: { x: MOUNT.x, y: MOUNT.y + 500 } });
    assert.equal(turret.angle, 0, "not one degree while disarmed");
    assert.equal(turret.isDisarmed, true);
  });

  it("reports itself armed again the frame firing is allowed", () => {
    const turret = turretOf("volley");
    run(turret, 100, { canFire: false });
    assert.equal(turret.isDisarmed, true);

    turret.update(FRAME, { origin: MOUNT, target: { x: 0, y: 0 } });
    assert.equal(turret.isDisarmed, false);
  });

  it("converges on a still target given enough time", () => {
    const turret = turretOf("volley");
    turret.angle = 0;
    const target = { x: MOUNT.x, y: MOUNT.y + 500 };

    run(turret, 2000, { target });
    assert.ok(Math.abs(angleDelta(turret.angle, Math.PI / 2)) < 0.01);
  });

  it("tracks at the configured base speed, restored from the laser workaround", () => {
    const turret = turretOf("volley");
    turret.angle = 0;
    assert.equal(turret.rotationDegPerSecond, TURRET.rotationDegPerSecond);

    turret.update(1000, { origin: MOUNT, target: { x: MOUNT.x, y: MOUNT.y + 500 } });
    // One second of delta is clamped to 100ms, so a tenth of the rotation.
    const expected = (TURRET.rotationDegPerSecond * Math.PI) / 180 / 10;
    assert.ok(Math.abs(turret.angle - expected) < 1e-9);
  });

  it("clamps rotation on a stalled frame like every other delta consumer", () => {
    const slow = turretOf("volley");
    const stalled = turretOf("volley");
    slow.angle = stalled.angle = 0;
    const target = { x: MOUNT.x - 500, y: MOUNT.y };

    slow.update(TIME.maxFrameMs, { origin: MOUNT, target });
    stalled.update(60_000, { origin: MOUNT, target });
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

describe("Turret laser rotation", () => {
  it("crawls at its own speed, a sixth of the tracking one", () => {
    // The reason the beam is escapable at all: at the full tracking speed it
    // simply stayed on the player, because it never has to lead a target.
    const turret = turretOf("laser");
    run(turret, TURRET.cooldownMs + LASER.chargeMs + 100);

    assert.ok(turret.beam, "must actually be burning");
    assert.equal(turret.rotationDegPerSecond, LASER.rotationDegPerSecond);
    assert.ok(LASER.rotationDegPerSecond < TURRET.rotationDegPerSecond / 4);
  });

  it("turns far slower during the beam than it does between attacks", () => {
    const beaming = turretOf("laser");
    run(beaming, TURRET.cooldownMs + LASER.chargeMs + 100);
    const beamStart = beaming.angle;
    run(beaming, 500, { target: { x: 0, y: MOUNT.y } });
    const swung = Math.abs(angleDelta(beamStart, beaming.angle));

    const tracking = turretOf("volley");
    tracking.angle = beamStart;
    run(tracking, 500, { target: { x: 0, y: MOUNT.y } });
    const tracked = Math.abs(angleDelta(beamStart, tracking.angle));

    assert.ok(swung < tracked, `beam swung ${swung}, tracking managed ${tracked}`);
  });

  it("goes back to the tracking speed once the beam is out", () => {
    const turret = turretOf("laser");
    run(turret, TURRET.cooldownMs + LASER.chargeMs + LASER.durationMs + 200);
    assert.equal(turret.beam, null);
    assert.equal(turret.rotationDegPerSecond, TURRET.rotationDegPerSecond);
  });
});

describe("Turret spiral", () => {
  it("fires roughly one shot per interval for its whole duration", () => {
    const turret = turretOf("spiral");
    const arm = run(turret, TURRET.cooldownMs + SPIRAL.durationMs + 100);
    const expected = SPIRAL.durationMs / SPIRAL.shotIntervalMs;

    assert.ok(
      Math.abs(arm.length - expected) <= 2,
      `expected about ${expected} shots, got ${arm.length}`,
    );
  });

  it("sweeps blind, ignoring where the player actually is", () => {
    // The whole point: the spiral is a wall to walk out of, not an aimed shot.
    // A tracking barrel would just be a very fast volley.
    const turret = turretOf("spiral");
    run(turret, TURRET.cooldownMs + 100);
    const target = { x: MOUNT.x, y: MOUNT.y + 500 };

    const before = turret.angle;
    run(turret, 300, { target });
    const after = turret.angle;
    run(turret, 300, { target });

    assert.notEqual(before, after, "it must keep turning");
    assert.ok(
      Math.abs(angleDelta(after, turret.angle)) > 0.3,
      "and keep going past the player rather than settling on them",
    );
  });

  it("covers its declared sweep, derived rather than written twice", () => {
    const turret = turretOf("spiral");
    run(turret, TURRET.cooldownMs + 100);

    const perSecond = (SPIRAL.sweepDegrees / SPIRAL.durationMs) * 1000;
    assert.ok(Math.abs(turret.rotationDegPerSecond - perSecond) < 1e-9);
    assert.ok(perSecond > TURRET.rotationDegPerSecond, "a spiral outruns the tracking speed");
  });

  it("rolls its direction, so the arm cannot be learned by heart", () => {
    const directions = new Set();
    for (let seed = 1; seed <= 20; seed += 1) {
      const turret = turretOf("spiral", seed);
      run(turret, TURRET.cooldownMs + 100);
      directions.add(Math.sign(turret.sweepSign));
    }
    assert.deepEqual([...directions].sort(), [-1, 1]);
  });

  it("throws slow shots, so the arm stays on the board to be walked out of", () => {
    const turret = turretOf("spiral");
    const [shot] = run(turret, TURRET.cooldownMs + 100);
    const speed = Math.hypot(shot.velocityX, shot.velocityY);

    assert.ok(speed < PROJECTILE.speed, "a spiral shot must be slower than an aimed one");
    assert.equal(shot.damage, PROJECTILE.damage, "but it still costs the same on contact");
  });

  it("stops when its clock runs out, not on a shot budget", () => {
    const turret = turretOf("spiral");
    run(turret, TURRET.cooldownMs + SPIRAL.durationMs + 100);
    assert.equal(turret.sweepSign, 0, "the sweep must end with the pattern");
    assert.equal(turret.rotationDegPerSecond, TURRET.rotationDegPerSecond);
  });
});

describe("Turret heavy shot", () => {
  it("sends exactly one, five times the size, for a third of the bar", () => {
    const turret = turretOf("heavy");
    const shots = run(turret, TURRET.cooldownMs + 300);

    assert.equal(shots.length, 1);
    assert.equal(shots[0].radius, PROJECTILE.radius * 5);
    assert.equal(shots[0].damage, 50);
  });

  it("drifts, rather than being dodged on reflex", () => {
    const turret = turretOf("heavy");
    const [heavy] = run(turret, TURRET.cooldownMs + 300);
    assert.ok(Math.hypot(heavy.velocityX, heavy.velocityY) < PROJECTILE.speed / 2);
  });

  it("carries a rim, because size alone reads as near, not as lethal", () => {
    const turret = turretOf("heavy");
    const [heavy] = run(turret, TURRET.cooldownMs + 300);
    assert.ok(heavy.ring, "the heavy shot must be marked");
    assert.equal(new Projectile({ x: 0, y: 0, angle: 0 }).ring, undefined);
  });

  it("uses its own short cooldown rather than the shared one", () => {
    // Measured between two shots rather than against a wall clock, so the test
    // says what it means: how long the turret waits after a heavy shot.
    assert.ok(HEAVY.cooldownMs < TURRET.cooldownMs);
    const turret = turretOf("heavy");
    const times = [];

    for (let elapsed = 0; elapsed < 12_000; elapsed += FRAME) {
      const fired = turret.update(FRAME, { origin: MOUNT, target: { x: 600, y: 900 } });
      if (fired.length > 0) times.push(elapsed);
    }

    assert.ok(times.length >= 3, `expected a few heavy shots, got ${times.length}`);
    const gap = times[2] - times[1];
    assert.ok(
      Math.abs(gap - HEAVY.cooldownMs) < 4 * FRAME,
      `expected about ${HEAVY.cooldownMs}ms between heavy shots, measured ${gap}`,
    );
  });
});

describe("attack tables per boss phase", () => {
  const idsIn = (phase) => patternsForPhase(phase).map((entry) => entry.id);

  it("keeps the three-shot volley in every phase, unchanged", () => {
    // The baseline the other patterns are read against; it is deliberately the
    // one thing that never changes across the fight.
    for (const phase of [1, 2, 3]) {
      assert.ok(idsIn(phase).includes("volley"), `phase ${phase} lost the volley`);
    }
  });

  it("gives phase 1 the laser and nothing else", () => {
    assert.deepEqual(idsIn(1).sort(), ["laser", "volley"]);
  });

  it("swaps the laser for the spiral and the heavy shot in phase 2", () => {
    const ids = idsIn(2);
    assert.ok(ids.includes("spiral") && ids.includes("heavy"));
    assert.ok(!ids.includes("laser"), "the laser is a phase 1 signature");
  });

  it("brings everything together in the last phase", () => {
    assert.deepEqual(idsIn(3).sort(), ["heavy", "laser", "spiral", "volley"]);
  });

  it("makes each rare attack one roll in five in phase 2", () => {
    const total = patternsForPhase(2).reduce((sum, entry) => sum + entry.weight, 0);
    for (const id of ["spiral", "heavy"]) {
      const entry = patternsForPhase(2).find((candidate) => candidate.id === id);
      assert.equal(entry.weight / total, 0.2, `${id} should be 1 in 5`);
    }
  });

  it("clamps a phase that does not exist", () => {
    // The boss spends a frame at zero lives before the run is won, which asks
    // for a phase 4.
    assert.deepEqual(patternsForPhase(4), PHASE_PATTERNS[3]);
    assert.deepEqual(patternsForPhase(0), PHASE_PATTERNS[1]);
  });

  it("names only patterns that exist", () => {
    for (const phase of [1, 2, 3]) {
      for (const { id } of patternsForPhase(phase)) {
        assert.ok([VOLLEY, LASER, SPIRAL, HEAVY].some((p) => p.id === id), `unknown ${id}`);
      }
    }
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

  it("costs a full pass through it exactly two projectiles", () => {
    // Doubled when the barrel slowed to 15°/s for the beam: a beam you can
    // walk out of can afford to hurt more than one you cannot.
    assert.equal((LASER.dps * LASER.durationMs) / 1000, PROJECTILE.damage * 2);
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
