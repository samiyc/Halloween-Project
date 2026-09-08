/**
 * The story campaign: an ordered list of levels, as data.
 *
 * A level is a **description**, never code. Everything that varies between two
 * levels has to be a field here, so that adding an episode stays an entry in
 * this file — the moment a level needs its own function, the design has gone
 * wrong. See `docs/story-mode.md`.
 *
 * The order of `LEVELS` is the unlock order: a level opens when the one before
 * it has been won. `src/game/progress.js` owns that rule.
 *
 * @typedef {object} Level
 * @property {string} id           Stable key; it is what a save file stores.
 * @property {string} name         Shown on the menu button and in the HUD.
 * @property {string} environment  Which series it belongs to. Cosmetic for now.
 * @property {import("./difficulty.js").DifficultyId} difficulty  Which systems exist.
 * @property {number} bossDelayMs  How long before the boss comes down.
 * @property {string} brief        Read before playing, from the menu.
 * @property {string} debrief      Read on victory, and from the menu afterwards.
 */

/**
 * The five forest episodes.
 *
 * **These are placeholders.** They all run `easy` rules, because what needed
 * proving first was the unlocking, the saving and the text display — not the
 * content. Each already declares its own `difficulty`, so promoting one is a
 * one-word change. `docs/story-mode.md` lists what else is stubbed.
 *
 * @type {readonly Level[]}
 */
export const LEVELS = Object.freeze([
  Object.freeze({
    id: "forest-1",
    name: "L'attaque du relais de Grandbois",
    environment: "forest",
    difficulty: "easy",
    bossDelayMs: 30_000,
    brief:
      "Les machines ont pris le relais de Grandbois il y a six jours, et " +
      "personne n'en est ressorti. Ce n'est qu'un poste de garde, mais c'est " +
      "par là qu'est passé le convoi qui transportait le premier artefact.",
    debrief:
      "Le relais est repris. Dans les débris, une plaque de cuivre gravée : " +
      "pas un plan de bataille, une carte des lieux anciens. Les machines ne " +
      "pillaient pas au hasard — elles cherchaient quelque chose de précis, " +
      "et la clairière des Antennes est le point suivant sur leur carte.",
  }),
  Object.freeze({
    id: "forest-2",
    name: "L'attaque de la clairière des Antennes",
    environment: "forest",
    difficulty: "easy",
    bossDelayMs: 35_000,
    brief:
      "Une forêt d'antennes plantée en pleine clairière, qui écoute quelque " +
      "chose sous la terre. Coupez-la avant qu'elle ait fini d'écouter.",
    debrief:
      "Les antennes se taisent. Elles n'émettaient pas : elles écoutaient un " +
      "battement lent, régulier, venu d'en dessous. Quelque chose dort là, et " +
      "les machines savent où. Reste à savoir qui, du hameau voisin, leur a " +
      "donné cette carte — s'il reste quelqu'un pour répondre.",
  }),
  Object.freeze({
    id: "forest-3",
    name: "La défense du hameau de Fontcloître",
    environment: "forest",
    difficulty: "easy",
    bossDelayMs: 40_000,
    brief:
      "Fontcloître n'a ni mur ni garde, et une colonne de machines remonte la " +
      "vallée. Ses habitants gardent les archives de la région depuis quatre " +
      "cents ans. Tenez jusqu'à ce qu'ils aient tout emporté.",
    debrief:
      "Le hameau tient. Les archivistes sont partis avec leurs coffres, et " +
      "l'un d'eux vous a laissé un feuillet : la carte de cuivre est une " +
      "copie. L'original est à la scierie, qui n'a plus d'ouvriers depuis " +
      "longtemps mais qui tourne encore, jour et nuit.",
  }),
  Object.freeze({
    id: "forest-4",
    name: "L'attaque de la scierie automatisée",
    environment: "forest",
    difficulty: "easy",
    bossDelayMs: 45_000,
    brief:
      "La scierie débite du bois pour personne depuis deux ans. Ce qu'elle " +
      "fabrique vraiment est au fond du bâtiment, et il faudra traverser tout " +
      "ce qu'elle a fabriqué jusqu'ici.",
    debrief:
      "La scierie est arrêtée. Elle ne produisait pas des planches mais des " +
      "châssis — des centaines, tous identiques, tous inachevés. Une armée " +
      "attend d'être montée quelque part, et l'atelier des Cendres est le " +
      "seul endroit de la région capable de lui donner un cœur.",
  }),
  Object.freeze({
    id: "forest-5",
    name: "La défense de l'atelier des Cendres",
    environment: "forest",
    difficulty: "easy",
    bossDelayMs: 50_000,
    brief:
      "Les forgerons des Cendres ont refusé de fuir. Ils vous doivent une " +
      "dette depuis Fontcloître et comptent la payer cette nuit : ils " +
      "tiendront les portes tant que vous tiendrez la cour.",
    debrief:
      "L'atelier est sauvé, et pour la première fois les machines ont reculé " +
      "sans avoir rien emporté. Ce qu'elles cherchaient sous la clairière a " +
      "un nom, que les forgerons prononcent à voix basse. La forêt est " +
      "derrière vous ; la piste continue vers le désert.",
  }),
]);

/**
 * The unlock order. Read it rather than indexing `LEVELS` by hand.
 * @type {readonly string[]}
 */
export const LEVEL_IDS = Object.freeze(LEVELS.map((level) => level.id));

/** Always open, whatever a save file says. */
export const FIRST_LEVEL_ID = LEVEL_IDS[0];

/**
 * @param {string|null} id
 * @returns {Level|null} null for anything unknown — a stale save must not throw
 */
export function levelOf(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}
