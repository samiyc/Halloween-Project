import { clampDelta } from "../config/settings.js";
import { LASER } from "../config/turret.js";
import { distanceToRay } from "../tools/aim.js";

/**
 * What the turret's fire does to the player, as pure functions over the board.
 *
 * The mirror image of `collection.js`: same shape, opposite sign. One walks a
 * list of circles and hands out mana, this one walks a list of circles and
 * takes health.
 */

/**
 * Moves every shot, drops the ones that left the board or hit, and totals the
 * damage.
 *
 * Move, cull and collide in one pass, like `collectPickups` — a shot that
 * crossed the player this frame must not also be tested next frame.
 *
 * @param {import("../entities/player.js").Player} player
 * @param {import("../entities/projectile.js").Projectile[]} projectiles
 * @param {object} context
 * @param {{width: number, height: number}} context.bounds
 * @param {number} context.deltaMs
 * @returns {{remaining: import("../entities/projectile.js").Projectile[], damage: number}}
 */
export function resolveProjectiles(player, projectiles, { bounds, deltaMs }) {
  const remaining = [];
  let damage = 0;

  for (const projectile of projectiles) {
    projectile.update(deltaMs);
    if (projectile.hasEscaped(bounds)) continue;

    if (!hitsPlayer(player, projectile)) {
      remaining.push(projectile);
      continue;
    }
    damage += projectile.damage;
  }

  return { remaining, damage };
}

/**
 * Circle against the player's square, read as a circle of half its width.
 *
 * Deliberately **not** `isTouching()` from `collection.js`: that one adds
 * `PICKUP_MAGNET_PADDING`, ten forgiving pixels that exist to help you catch an
 * orb. Forgiveness on an incoming shot is the opposite favour — it would land
 * hits before anything visibly touched.
 *
 * @param {import("../entities/player.js").Player} player
 * @param {{centerX: number, centerY: number, radius: number}} projectile
 * @returns {boolean}
 */
export function hitsPlayer(player, projectile) {
  return player.distanceTo(projectile) <= player.size / 2 + projectile.radius;
}

/**
 * Health lost to the beam this frame, or 0 while standing clear of it.
 *
 * Charged per millisecond rather than per tick, so the beam costs the same at
 * 60 Hz and at 165 Hz. `clampDelta` caps a stalled frame, which matters more
 * here than anywhere: an unclamped multi-second delta would empty the bar in
 * one step for a beam the player never saw.
 *
 * @param {import("../entities/player.js").Player} player
 * @param {{x: number, y: number, angle: number, width: number}|null} beam
 * @param {number} deltaMs
 * @returns {number}
 */
export function beamDamage(player, beam, deltaMs) {
  if (!beam || !isInBeam(player, beam)) return 0;
  return (LASER.dps * clampDelta(deltaMs)) / 1000;
}

/**
 * @param {import("../entities/player.js").Player} player
 * @param {{x: number, y: number, angle: number, width: number}} beam
 * @returns {boolean}
 */
export function isInBeam(player, beam) {
  const centre = { x: player.centerX, y: player.centerY };
  return distanceToRay(centre, beam) <= beam.width / 2 + player.size / 2;
}
