import { PICKUP_KIND, PICKUP_MAGNET_PADDING } from "../config/pickups.js";

/**
 * Picking up what has fallen, as a pure function over the pickup list.
 *
 * There is no player/enemy collision in the game, so collecting carries no
 * risk: the only cost of chasing an orb is the attention it takes and the ones
 * you miss while doing it. See docs/mana-and-spells.md for why that is the main
 * open question of the design.
 *
 * @param {import("../entities/player.js").Player} player
 * @param {import("../entities/pickup.js").Pickup[]} pickups
 * @param {object} options
 * @param {number} options.fieldHeight
 * @param {boolean} options.canTakeSpell  False while a spell is already held,
 *   in which case yellow orbs are left to keep falling rather than overwriting
 *   the one being saved.
 * @returns {{remaining: import("../entities/pickup.js").Pickup[], manaOrbs: number, tookSpell: boolean}}
 */
export function collectPickups(player, pickups, { fieldHeight, canTakeSpell }) {
  const remaining = [];
  let manaOrbs = 0;
  let tookSpell = false;

  for (const pickup of pickups) {
    if (pickup.hasEscaped(fieldHeight)) continue;

    if (!isTouching(player, pickup)) {
      remaining.push(pickup);
      continue;
    }
    if (pickup.kind === PICKUP_KIND.mana) {
      manaOrbs += 1;
      continue;
    }
    // A spell orb, and the slot is taken: leave it falling.
    if (!canTakeSpell || tookSpell) {
      remaining.push(pickup);
      continue;
    }
    tookSpell = true;
  }

  return { remaining, manaOrbs, tookSpell };
}

/**
 * Circle against the player's square, treated as a circle of half its width
 * plus a small forgiving margin.
 *
 * @param {import("../entities/player.js").Player} player
 * @param {import("../entities/pickup.js").Pickup} pickup
 * @returns {boolean}
 */
export function isTouching(player, pickup) {
  const reach = player.size / 2 + pickup.radius + PICKUP_MAGNET_PADDING;
  return player.distanceTo(pickup) <= reach;
}
