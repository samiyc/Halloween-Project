/**
 * Pure geometry over a stroke path (`{x, y}[]`). No canvas, no DOM, no state —
 * every function here is directly unit-testable.
 *
 * @typedef {{x: number, y: number}} Point
 */

/**
 * @param {Point} from
 * @param {Point} to
 * @returns {number}
 */
export function distance(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Straight-line distance from the first to the last point.
 *
 * Note this is deliberately NOT the arc length: it is what gates input via
 * `STROKE.minLength`, and it is why a tightly wound spiral that ends near its
 * own start can be rejected before it is ever classified. The spiral rescue in
 * `isStrokeUsable()` is what compensates for that.
 *
 * @param {readonly Point[]} path
 * @returns {number}
 */
export function span(path) {
  if (path.length < 2) return 0;
  return distance(path[0], path[path.length - 1]);
}

/**
 * The point halfway along the path *by index*, matching the original
 * chevron heuristic. Index-based, not arc-length-based, on purpose: changing it
 * would change how V and Ʌ feel to draw.
 * @param {readonly Point[]} path
 * @returns {Point}
 */
export function midpoint(path) {
  return path[Math.floor(path.length / 2)];
}

/**
 * @param {readonly Point[]} path
 * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, height: number}}
 */
export function boundingBox(path) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of path) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Angle of the start→end vector, in degrees, folded into [0, 180].
 * @param {readonly Point[]} path
 * @returns {number}
 */
export function headingDegrees(path) {
  const start = path[0];
  const end = path[path.length - 1];
  return Math.abs(Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI));
}

/**
 * Counts how many times the path changes direction along one axis, ignoring
 * runs shorter than `deadzone` so mouse jitter is not mistaken for intent.
 *
 * This is the discriminator between chevrons and zigzags: drawing V or Ʌ
 * reverses once in Y while X keeps going one way (0 X-reversals), whereas a
 * lightning bolt reverses in X repeatedly.
 *
 * @param {readonly Point[]} path
 * @param {"x"|"y"} axis
 * @param {number} deadzone
 * @returns {number}
 */
export function countReversals(path, axis, deadzone) {
  let reversals = 0;
  let direction = 0;
  let anchor = path[0]?.[axis] ?? 0;

  for (const point of path) {
    const delta = point[axis] - anchor;
    if (Math.abs(delta) < deadzone) continue;

    const nextDirection = Math.sign(delta);
    if (direction !== 0 && nextDirection !== direction) {
      reversals += 1;
    }
    direction = nextDirection;
    anchor = point[axis];
  }
  return reversals;
}

/**
 * Moving average over the path, used to take hand tremor out before measuring
 * curvature.
 *
 * Turn accumulation is extremely sensitive to jitter: a sawtooth of a few
 * pixels flips the local heading by nearly 180 degrees at every point, and
 * summing those flips makes a ruler-straight drag read as a spiral. Averaging
 * first removes that without meaningfully rounding off a real spiral, whose
 * radius is an order of magnitude larger than the tremor.
 *
 * @param {readonly Point[]} path
 * @param {number} window Number of points averaged; <= 1 returns a copy.
 * @returns {Point[]}
 */
export function smoothed(path, window) {
  if (window <= 1 || path.length < 3) return [...path];

  const reach = Math.floor(window / 2);
  return path.map((_, index) => {
    const from = Math.max(0, index - reach);
    const to = Math.min(path.length - 1, index + reach);
    let sumX = 0;
    let sumY = 0;
    for (let at = from; at <= to; at += 1) {
      sumX += path[at].x;
      sumY += path[at].y;
    }
    const count = to - from + 1;
    return { x: sumX / count, y: sumY / count };
  });
}

/**
 * Cumulative unsigned turn along the path, in degrees.
 *
 * A straight line totals ~0, a chevron ~90-140, a full circle 360, and a
 * spiral of one and a quarter turns exceeds 450 — which is what
 * `STROKE.spiralMinTurn` keys off.
 *
 * Headings are taken between points at least `sampleDistance` apart on a
 * smoothed copy of the path. Both guards matter: smoothing removes tremor,
 * and the sampling stride keeps a single stray point from contributing a full
 * reversal.
 *
 * @param {readonly Point[]} path
 * @param {{sampleDistance: number, smoothingWindow?: number}} options
 * @returns {number}
 */
export function totalTurnDegrees(path, { sampleDistance, smoothingWindow = 1 }) {
  const source = smoothed(path, smoothingWindow);
  const headings = [];
  let anchor = source[0];

  for (const point of source) {
    if (!anchor || distance(anchor, point) < sampleDistance) continue;
    headings.push(Math.atan2(point.y - anchor.y, point.x - anchor.x));
    anchor = point;
  }

  let total = 0;
  for (let index = 1; index < headings.length; index += 1) {
    let turn = headings[index] - headings[index - 1];
    // Fold into (-PI, PI] so a wrap-around does not read as a 350 degree turn.
    while (turn > Math.PI) turn -= 2 * Math.PI;
    while (turn < -Math.PI) turn += 2 * Math.PI;
    total += Math.abs(turn);
  }
  return total * (180 / Math.PI);
}
