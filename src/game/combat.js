/**
 * Combat resolution, as pure functions over entity lists.
 *
 * Nothing here touches the canvas, the clock or the DOM, so every rule below
 * is directly unit-testable — which matters because these are the rules a
 * player will argue about.
 */

/**
 * Applies one recognised gesture to the whole board.
 *
 * A gesture has no range limit and hits every entity at once: each enemy whose
 * next symbol matches loses it, and so does the boss. That board-wide reach is
 * what the player's melee trades away for the ability to strike a single tough
 * target regardless of which symbol it is waiting for.
 *
 * @param {import("../config/glyphs.js").GlyphId|null} glyphId
 * @param {object} board
 * @param {import("../entities/enemy.js").Enemy[]} board.enemies
 * @param {import("../entities/boss.js").Boss|null} [board.boss]
 * @returns {{hits: number, defeated: import("../entities/enemy.js").Enemy[], bossHit: boolean}}
 */
export function resolveGesture(glyphId, { enemies, boss = null }) {
  let hits = 0;
  const defeated = [];

  for (const enemy of enemies) {
    if (!enemy.decrementSequence(glyphId)) continue;
    hits += 1;
    if (enemy.isDefeated()) defeated.push(enemy);
  }

  const bossHit = boss !== null && !boss.isInvincible && boss.decrementSequence(glyphId);
  if (bossHit) hits += 1;

  return { hits, defeated, bossHit };
}

/**
 * The melee auto-attack: strips one symbol from the single closest target
 * within reach, whatever that symbol is. No click, no key press.
 *
 * Closest-only is deliberate. An area melee would make positioning trivially
 * strong and undercut the gestures; one target per tick keeps the character a
 * tool for focusing a tough enemy rather than a crowd clearer.
 *
 * @param {import("../entities/player.js").Player} player
 * @param {object} board
 * @param {import("../entities/enemy.js").Enemy[]} board.enemies
 * @param {import("../entities/boss.js").Boss|null} [board.boss]
 * @returns {{target: object, symbol: string, defeated: boolean}|null}
 */
export function resolveMelee(player, { enemies, boss = null }) {
  if (!player.isMeleeReady()) return null;

  const target = findMeleeTarget(player, enemies, boss);
  if (!target) return null;

  const symbol = target.stripSymbol();
  if (symbol === null) return null;

  player.startMeleeCooldown();
  return { target, symbol, defeated: target.isDefeated() };
}

/**
 * @param {import("../entities/player.js").Player} player
 * @param {import("../entities/enemy.js").Enemy[]} enemies
 * @param {import("../entities/boss.js").Boss|null} boss
 * @returns {object|null}
 */
function findMeleeTarget(player, enemies, boss) {
  const candidates = boss !== null && !boss.isInvincible ? [...enemies, boss] : enemies;

  let closest = null;
  let closestDistance = Infinity;

  for (const candidate of candidates) {
    if (candidate.isDefeated()) continue;
    const distance = player.distanceTo(candidate);
    if (distance > player.meleeRange || distance >= closestDistance) continue;
    closest = candidate;
    closestDistance = distance;
  }
  return closest;
}
