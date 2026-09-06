/**
 * The three difficulty modes, as feature switches rather than numbers.
 *
 * Nothing here changes how fast enemies fall or how often they spawn: the modes
 * differ by **which mechanics exist at all**. Easy is the game before mana,
 * Medium is the game as it stands, Hard adds the health bar.
 *
 * The rules are cumulative on purpose — every level is a superset of the one
 * before it, so a player meets one new system at a time. A test enforces that,
 * because the property is easy to state and easy to break by accident.
 */

/** @typedef {"easy"|"medium"|"hard"} DifficultyId */

/**
 * @typedef {object} DifficultyRules
 * @property {DifficultyId} id
 * @property {string} name         Shown on the menu button.
 * @property {string} summary      One line under the button.
 * @property {boolean} mana        Gestures cost mana, blue orbs fall, gauge shown.
 * @property {boolean} rareEnemies Purple enemies, and with them the rare glyphs.
 * @property {boolean} spells      Yellow orbs, the spell slot, E / right click.
 * @property {boolean} health      The red health bar.
 */

/** @type {Readonly<Record<DifficultyId, DifficultyRules>>} */
export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: "easy",
    name: "Facile",
    summary: "Gestes gratuits, ennemis gris",
    mana: false,
    rareEnemies: false,
    spells: false,
    health: false,
  }),
  medium: Object.freeze({
    id: "medium",
    name: "Normal",
    summary: "Mana, ennemis rares, sorts",
    mana: true,
    rareEnemies: true,
    spells: true,
    health: false,
  }),
  hard: Object.freeze({
    id: "hard",
    name: "Difficile",
    summary: "Normal + barre de vie",
    mana: true,
    rareEnemies: true,
    spells: true,
    health: true,
  }),
});

/**
 * Ordered from easiest to hardest. The order is meaningful — the menu lists
 * them in it, and the cumulative check walks it.
 * @type {readonly DifficultyId[]}
 */
export const DIFFICULTY_IDS = Object.freeze(["easy", "medium", "hard"]);

/** What a fresh install starts on, and what `Game` assumes when asked nothing. */
export const DEFAULT_DIFFICULTY = "medium";

/** The switches every mode declares, in the order they unlock. */
export const RULE_NAMES = Object.freeze(["mana", "rareEnemies", "spells", "health"]);

/**
 * @param {DifficultyId|string|null} id
 * @returns {DifficultyRules} the default rules for anything unrecognised
 */
export function rulesOf(id) {
  return DIFFICULTIES[id] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}
