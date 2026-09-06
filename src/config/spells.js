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
    durationMs: 5000,
    /** Divides the melee cooldown */
    attackSpeedMultiplier: 2.5,
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
 * One colour per spell, so the slot is identifiable without reading it.
 *
 * The hues are deliberately spread around the wheel — a test enforces at least
 * 45 degrees between any two. The obvious choices did not survive that: the
 * frost tint, the old Célérité halo and the mana blue sat within 20 degrees of
 * each other, three near-identical cyans. Célérité moved to magenta and the
 * potion to green, which is what makes a glance enough.
 *
 * Two ties were worth keeping and did not move: Frénésie stays the orange of
 * its own halo, and Givre stays the blue that frozen enemies and its preview
 * circle already use.
 */
export const SPELL_COLORS = Object.freeze({
  frenzy: "#FF6B35",
  frost: "#7FD4FF",
  haste: "#FF5FD2",
  potion: "#5FE38A",
});

/**
 * @param {SpellId|string|null} spellId
 * @returns {string|null}
 */
export function spellColorOf(spellId) {
  return SPELL_COLORS[spellId] ?? null;
}

/**
 * Buffs that live on the player and need a visible halo.
 *
 * Derived from `SPELL_COLORS` rather than written out, so the ring you get
 * after casting can never disagree with the colour that was in the slot.
 */
export const BUFF_HALOS = Object.freeze({
  frenzy: SPELL_COLORS.frenzy,
  haste: SPELL_COLORS.haste,
});

/**
 * What a slowed enemy is tinted with: the Givre colour itself, so the slot, the
 * preview circle and the frozen enemies all say the same thing.
 *
 * Lives here rather than in `render/palette.js` because `Enemy.displayColor`
 * needs it, and `entities/` must never import from `render/`.
 */
export const FROST_ENEMY_COLOR = SPELL_COLORS.frost;
