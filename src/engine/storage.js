/**
 * The only module that touches browser storage.
 *
 * Everything above it works against `{read, write}`, the same way the game
 * works against an injected `Rng` rather than `Math.random()` — which is what
 * lets the whole progression be exercised under plain Node.
 *
 * @typedef {{read: () => string|null, write: (value: string) => void}} Storage
 */

/** Where the campaign progress lives. Namespaced, since an origin is shared. */
export const PROGRESS_KEY = "spellblaster.progress";

/**
 * `localStorage` behind the `Storage` shape.
 *
 * Every access is wrapped: a browser set to block site data, or a strict
 * private window, **throws** on the very first `getItem`. A game that cannot
 * remember anything is fine; a game that will not start is not.
 *
 * Storage is per origin, so `127.0.0.1:5500` and `localhost:5500` keep two
 * different save files, and `file://` keeps none.
 *
 * @param {string} [key]
 * @returns {Storage}
 */
export function browserStorage(key = PROGRESS_KEY) {
  return {
    read() {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        // Blocked or unavailable: play without a memory.
        return null;
      }
    },
    write(value) {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // Same, the other way round: losing the save is not worth an error.
      }
    },
  };
}

/**
 * An in-memory stand-in, for tests and for a run with nothing to persist to.
 * @param {string|null} [initial]
 * @returns {Storage}
 */
export function memoryStorage(initial = null) {
  let value = initial;
  return {
    read: () => value,
    write: (next) => {
      value = next;
    },
  };
}
