import { LEVEL_IDS } from "../config/levels.js";

/**
 * Which story levels are open, and which are done.
 *
 * Pure: the storage is injected as `{read, write}`, exactly like the random
 * generator is injected. A test drives it with `memoryStorage()`, the browser
 * gives it `browserStorage()`, and neither one is special-cased here.
 *
 * The whole unlock rule is one sentence: **a level opens when the one before it
 * in `LEVEL_IDS` has been won**, and the first is always open.
 */

/**
 * Bumped whenever the stored shape changes. A save written by an older version
 * is discarded rather than migrated — there is nothing in it worth a migration,
 * and a half-understood save is worse than a fresh one.
 */
export const SAVE_VERSION = 1;

export class Progress {
  /**
   * @param {object} [options]
   * @param {import("../engine/storage.js").Storage|null} [options.storage]
   * @param {readonly string[]} [options.order] Injected for tests.
   */
  constructor({ storage = null, order = LEVEL_IDS } = {}) {
    this.storage = storage;
    this.order = order;
    /** @type {Set<string>} */
    this.completed = new Set(readCompleted(storage, order));
  }

  /** @param {string} levelId */
  isCompleted(levelId) {
    return this.completed.has(levelId);
  }

  /**
   * @param {string} levelId
   * @returns {boolean} false for an id that is not in the campaign at all
   */
  isUnlocked(levelId) {
    const index = this.order.indexOf(levelId);
    if (index < 0) return false;
    return index === 0 || this.isCompleted(this.order[index - 1]);
  }

  /** The furthest level the player may start, for the menu to point at. */
  get nextLevelId() {
    return this.order.find((id) => !this.isCompleted(id)) ?? null;
  }

  /**
   * Records a win. Idempotent: winning a level twice is not an event.
   * @param {string} levelId
   * @returns {boolean} whether this changed anything
   */
  complete(levelId) {
    if (!this.order.includes(levelId) || this.isCompleted(levelId)) return false;
    this.completed.add(levelId);
    this.save();
    return true;
  }

  /** Forgets everything, save file included. */
  reset() {
    this.completed.clear();
    this.save();
  }

  save() {
    // Written in campaign order rather than in completion order, so two saves
    // holding the same levels are the same string.
    const completed = this.order.filter((id) => this.completed.has(id));
    this.storage?.write(JSON.stringify({ version: SAVE_VERSION, completed }));
  }
}

/**
 * Reads a save file, defensively.
 *
 * Absent, unparseable, of another version, or holding ids that no longer exist:
 * every one of those falls back to an empty progression. A corrupt key must
 * never be able to stop the menu from opening.
 *
 * @param {import("../engine/storage.js").Storage|null} storage
 * @param {readonly string[]} order
 * @returns {string[]}
 */
function readCompleted(storage, order) {
  const raw = storage?.read() ?? null;
  if (!raw) return [];

  const saved = parse(raw);
  if (saved?.version !== SAVE_VERSION || !Array.isArray(saved.completed)) return [];
  return saved.completed.filter((id) => order.includes(id));
}

/**
 * @param {string} raw
 * @returns {{version?: unknown, completed?: unknown}|null}
 */
function parse(raw) {
  try {
    const value = JSON.parse(raw);
    return typeof value === "object" && value !== null ? value : null;
  } catch {
    // Someone else's key, or a truncated write.
    return null;
  }
}
