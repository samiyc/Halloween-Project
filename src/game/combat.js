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
 * next symbol matches loses it, and so does the boss. The melee trades that
 * board-wide reach for a small circle, in exchange for ignoring which symbol a
 * target is waiting for.
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
 * The melee auto-attack: strips one symbol from **every** target inside the
 * circle, whatever those symbols are. No click, no key press.
 *
 * It used to hit only the closest target, which made the character a tool for
 * focusing one tough enemy. Hitting the whole circle instead rewards walking
 * into a crowd, so the range was tightened by 15% to pay for it — the circle
 * covers proportionally less ground than it did as a single-target attack.
 *
 * @param {import("../entities/player.js").Player} player
 * @param {object} board
 * @param {import("../entities/enemy.js").Enemy[]} board.enemies
 * @param {import("../entities/boss.js").Boss|null} [board.boss]
 * @returns {{hits: Array<{target: object, symbol: string}>, defeated: object[]}|null}
 */
export function resolveMelee(player, { enemies, boss = null }) {
  if (!player.isMeleeReady()) return null;

  const hits = [];
  const defeated = [];

  for (const target of meleeTargets(player, enemies, boss)) {
    const symbol = target.stripSymbol();
    // The boss refuses to be stripped while retreating, so a null can come back
    // even from a target that was in range.
    if (symbol === null) continue;
    hits.push({ target, symbol });
    if (target.isDefeated()) defeated.push(target);
  }

  // Swinging at nothing must not cost the rhythm: the cooldown only starts once
  // at least one symbol has actually come off.
  if (hits.length === 0) return null;

  player.startMeleeCooldown();
  return { hits, defeated };
}

/**
 * Everything within reach and still worth hitting.
 *
 * @param {import("../entities/player.js").Player} player
 * @param {import("../entities/enemy.js").Enemy[]} enemies
 * @param {import("../entities/boss.js").Boss|null} boss
 * @returns {object[]}
 */
function meleeTargets(player, enemies, boss) {
  const candidates = boss !== null && !boss.isInvincible ? [...enemies, boss] : enemies;
  return candidates.filter(
    (candidate) => !candidate.isDefeated() && player.distanceTo(candidate) <= player.meleeRange,
  );
}
