/**
 * The four spells a yellow orb can grant.
 *
 * Declared here as data only; `src/game/spellbook.js` holds what each one
 * actually does. Same split as `glyphs.js` versus the recognizer.
 *
 * They are free — no mana, no cooldown. The yellow orb is already the
 * resource, and it is rare. Charging mana on top would also make the mana
 * potion absurd: spending mana to gain mana.
 */

/** @typedef {"frenzy"|"frost"|"haste"|"potion"} SpellId */

export const SPELLS = Object.freeze({
  frenzy: Object.freeze({
    id: "frenzy",
    name: "Frénésie",
    hint: "Attaque ×1,5",
    durationMs: 8000,
    /** Divides the melee cooldown: 1500ms becomes 1000ms. */
    attackSpeedMultiplier: 1.5,
  }),
  frost: Object.freeze({
    id: "frost",
    name: "Givre",
    hint: "Ennemis ralentis",
    durationMs: 8000,
    /**
     * Roughly four times the melee reach, so it stays a zone tool rather than
     * a second melee.
     *
     * 320, not 200: this is a world-space distance and it was missed when the
     * world was scaled x1.6, which had quietly dropped it to 2.7x the melee.
     * Any new spell distance has to scale with the world too.
     */
    radius: 320,
    slowFactor: 0.5,
  }),
  haste: Object.freeze({
    id: "haste",
    name: "Célérité",
    hint: "Déplacement ×1,5",
    durationMs: 8000,
    moveSpeedMultiplier: 1.5,
  }),
  potion: Object.freeze({
    id: "potion",
    name: "Grande potion",
    hint: "+50 mana",
    durationMs: 0,
    manaGain: 50,
  }),
});

/** @type {readonly SpellId[]} */
export const SPELL_IDS = Object.freeze(Object.keys(SPELLS));

/**
 * The area a held spell would cover, so the HUD can preview it.
 *
 * Showing the circle while the spell sits in the slot is what turns Givre from
 * "cast and hope" into a placement decision: you can see which enemies are
 * inside before spending it. The preview disappears on its own once the slot
 * empties.
 *
 * @param {SpellId|string|null} spellId
 * @returns {number|null} null for spells that have no area
 */
export function spellRangeOf(spellId) {
  return SPELLS[spellId]?.radius ?? null;
}

/**
 * Buffs that live on the player and need a visible halo.
 *
 * The fill colour stays the player's identity green — a "green speed buff"
 * would be invisible on a green square — so buff state is carried by a ring
 * instead. That also lets two buffs show at once, which a single fill colour
 * cannot express.
 */
export const BUFF_HALOS = Object.freeze({
  frenzy: "#FF6B35",
  haste: "#4FE3FF",
});

/**
 * What a slowed enemy is tinted with.
 *
 * Lives here rather than in `render/palette.js` because `Enemy.displayColor`
 * needs it, and `entities/` must never import from `render/`.
 */
export const FROST_ENEMY_COLOR = "#7FD4FF";
