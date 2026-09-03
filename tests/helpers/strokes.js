/**
 * Stroke fixtures shared by the gesture tests.
 *
 * These build the same kind of point array the mouse produces, so a recognizer
 * test exercises exactly the code path a real gesture takes.
 *
 * @typedef {{x: number, y: number}} Point
 */

/**
 * A straight run of points between two coordinates.
 * @param {Point} from
 * @param {Point} to
 * @param {number} [steps]
 * @returns {Point[]}
 */
export function segment(from, to, steps = 20) {
  return Array.from({ length: steps + 1 }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / steps,
    y: from.y + ((to.y - from.y) * index) / steps,
  }));
}

/**
 * Chains segments, dropping the duplicated joint between them.
 * @param {...Point[]} parts
 * @returns {Point[]}
 */
export function chain(...parts) {
  return parts.reduce((path, part) => path.concat(path.length ? part.slice(1) : part), []);
}

/** A left-to-right horizontal line. */
export const horizontalStroke = () => segment({ x: 100, y: 300 }, { x: 320, y: 306 });

/** A top-to-bottom vertical line. */
export const verticalStroke = () => segment({ x: 300, y: 100 }, { x: 306, y: 320 });

/** A V: down-right then up-right. Reverses in Y, never in X. */
export const chevronDownStroke = () =>
  chain(segment({ x: 100, y: 200 }, { x: 180, y: 300 }), segment({ x: 180, y: 300 }, { x: 260, y: 200 }));

/** An inverted V. */
export const chevronUpStroke = () =>
  chain(segment({ x: 100, y: 300 }, { x: 180, y: 200 }), segment({ x: 180, y: 200 }, { x: 260, y: 300 }));

/** A zigzag: reverses horizontally three times. */
export const boltStroke = () =>
  chain(
    segment({ x: 200, y: 100 }, { x: 280, y: 170 }),
    segment({ x: 280, y: 170 }, { x: 190, y: 230 }),
    segment({ x: 190, y: 230 }, { x: 270, y: 300 }),
  );

/**
 * An inward spiral of `turns` revolutions.
 * @param {number} [turns]
 * @param {number} [steps]
 * @param {number} [shrink] Fraction of the radius lost over the whole stroke.
 *   A small value makes a whole number of turns end close to its own start,
 *   which is the case that defeats the straight-line length gate.
 * @returns {Point[]}
 */
export function spiralStroke(turns = 1.6, steps = 140, shrink = 0.6) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;
    const angle = turns * 2 * Math.PI * progress;
    const radius = 95 * (1 - shrink * progress);
    return {
      x: 400 + radius * Math.cos(angle),
      y: 400 + radius * Math.sin(angle),
    };
  });
}

/** A spiral that closes back onto its start point. */
export const closedSpiralStroke = () => spiralStroke(2, 160, 0.12);

/** Shorter than STROKE.minLength, so it must be rejected. */
export const tinyStroke = () => segment({ x: 300, y: 300 }, { x: 312, y: 308 }, 6);

/**
 * A horizontal line with per-point jitter, to prove the reversal deadzone
 * ignores hand tremor.
 * @param {number} [amplitude]
 * @returns {Point[]}
 */
export function jitteryHorizontalStroke(amplitude = 4) {
  return segment({ x: 100, y: 300 }, { x: 340, y: 300 }, 40).map((point, index) => ({
    x: point.x + (index % 2 === 0 ? amplitude : -amplitude),
    y: point.y + (index % 3 === 0 ? amplitude : -amplitude),
  }));
}
