/**
 * All gameplay randomness funnels through here.
 *
 * Two reasons: `Math.random()` cannot be seeded, which makes spawn logic and
 * sequence generation untestable; and SonarJS flags every raw `Math.random()`
 * call site, so containing it to one file keeps the rest of the codebase clean.
 */

/**
 * @typedef {object} Rng
 * @property {() => number} float      Uniform in [0, 1).
 * @property {(min: number, max: number) => number} range   Uniform in [min, max).
 * @property {(min: number, max: number) => number} int     Uniform integer in [min, max].
 * @property {<T>(items: readonly T[]) => T} pick           One element.
 * @property {(probability: number) => boolean} chance      True with probability p.
 */

/**
 * Wraps a raw `() => number` generator in the `Rng` helpers.
 * @param {() => number} float
 * @returns {Rng}
 */
function fromFloat(float) {
  const range = (min, max) => min + float() * (max - min);
  return {
    float,
    range,
    int: (min, max) => Math.floor(range(min, max + 1)),
    pick: (items) => items[Math.floor(float() * items.length)],
    chance: (probability) => float() < probability,
  };
}

/**
 * The production generator.
 * @type {Rng}
 */
export const systemRandom = fromFloat(
  // eslint-disable-next-line sonarjs/pseudo-random -- gameplay variety, never security-sensitive
  () => Math.random(),
);

/**
 * A deterministic generator (mulberry32) for tests and reproducible runs.
 * The same seed always yields the same game.
 * @param {number} seed
 * @returns {Rng}
 */
export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return fromFloat(() => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

/**
 * Builds a random symbol string, e.g. "_V|Ʌ".
 * @param {Rng} rng
 * @param {number} length
 * @param {readonly string[]} symbols
 * @returns {string}
 */
export function randomSequence(rng, length, symbols) {
  let sequence = "";
  for (let index = 0; index < length; index += 1) {
    sequence += rng.pick(symbols);
  }
  return sequence;
}

/**
 * Picks one entry, favouring the heavier ones.
 *
 * `pick()` is uniform, which cannot express "the laser is one attack in five".
 * Weights are relative, not probabilities: `[4, 1]` and `[40, 10]` behave the
 * same, so a pattern can be made rarer without rebalancing the others.
 *
 * @template T
 * @param {Rng} rng
 * @param {readonly {id: T, weight: number}[]} entries  Non-empty; weights ≥ 0.
 * @returns {T}
 */
export function weightedPick(rng, entries) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  // All-zero weights would otherwise return undefined rather than an entry.
  if (total <= 0) return entries[0].id;

  let ticket = rng.range(0, total);
  for (const entry of entries) {
    ticket -= Math.max(0, entry.weight);
    if (ticket < 0) return entry.id;
  }
  // Only reachable through floating-point residue at the very top of the range.
  return entries[entries.length - 1].id;
}

/**
 * Fisher-Yates shuffle on a copy.
 * @template T
 * @param {Rng} rng
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function shuffled(rng, items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = rng.int(0, index);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}
