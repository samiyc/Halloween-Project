import { SPELLS } from "../config/spells.js";

/**
 * What each spell actually does.
 *
 * Kept apart from `config/spells.js`, which is data only — the same split as
 * the glyph registry and the recognizer. A table of handlers rather than a
 * switch, so adding a fifth spell never grows a function's complexity.
 *
 * @type {Readonly<Record<string, (game: import("./game.js").Game) => void>>}
 */
const HANDLERS = Object.freeze({
  frenzy: (game) => game.player.effects.activate(SPELLS.frenzy.id, SPELLS.frenzy.durationMs),
  haste: (game) => game.player.effects.activate(SPELLS.haste.id, SPELLS.haste.durationMs),
  frost: (game) => applyFrost(game),
  potion: (game) => game.mana.gain(SPELLS.potion.manaGain),
});

/**
 * @param {string} spellId
 * @param {import("./game.js").Game} game
 * @returns {boolean} whether the spell existed and was applied
 */
export function applySpell(spellId, game) {
  const handler = HANDLERS[spellId];
  if (!handler) return false;
  handler(game);
  return true;
}

/**
 * Slows every enemy within the Givre radius of the player.
 *
 * The boss is left alone. It already has an invincibility phase of its own and
 * a carefully tuned descent; letting a pickup slow it would quietly rewrite the
 * fight's pacing.
 *
 * @param {import("./game.js").Game} game
 * @returns {number} how many enemies were caught
 */
export function applyFrost(game) {
  const { radius, durationMs } = SPELLS.frost;
  let caught = 0;

  for (const enemy of game.enemies) {
    if (game.player.distanceTo(enemy) > radius) continue;
    enemy.applySlow(durationMs);
    caught += 1;
  }
  return caught;
}
