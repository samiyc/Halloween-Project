import { STROKE } from "../../config/settings.js";
import {
  boundingBox,
  countReversals,
  headingDegrees,
  midpoint,
  span,
  totalTurnDegrees,
} from "./geometry.js";

/**
 * Turns a raw mouse path into a glyph id, or null when the stroke should be
 * ignored.
 *
 * Classification order matters and is deliberate — each test is a filter for
 * the ones after it:
 *
 *   1. spiral  - winds more than `spiralMinTurn` degrees in total.
 *   2. bolt    - reverses horizontally `boltMinReversals`+ times.
 *   3. chevron - midpoint clears `chevronRatio` of the stroke width.
 *   4. line    - the start->end angle decides horizontal vs vertical.
 *
 * Spiral and bolt come first because both would otherwise be swallowed by the
 * chevron or angle test. Chevrons stay ahead of the angle test so they win
 * ties, which is the original behaviour.
 *
 * @typedef {{x: number, y: number}} Point
 * @param {readonly Point[]} path
 * @param {typeof STROKE} [stroke]
 * @returns {import("../../config/glyphs.js").GlyphId|null}
 */
export function recognizeStroke(path, stroke = STROKE) {
  if (!isStrokeUsable(path, stroke)) return null;

  return (
    detectSpiral(path, stroke) ??
    detectBolt(path, stroke) ??
    detectChevron(path, stroke) ??
    detectLine(path)
  );
}

/**
 * A stroke needs enough points to have a shape, and enough reach to be
 * intentional. A spiral is exempt from the reach test because it can legally
 * end where it began.
 * @param {readonly Point[]} path
 * @param {typeof STROKE} stroke
 * @returns {boolean}
 */
export function isStrokeUsable(path, stroke = STROKE) {
  if (!Array.isArray(path) || path.length < 3) return false;
  if (span(path) >= stroke.minLength) return true;

  // Rescue the wound-up spiral that `span()` would otherwise reject.
  const box = boundingBox(path);
  const reach = Math.max(box.width, box.height);
  return (
    reach >= stroke.minLength &&
    turnOf(path, stroke) >= stroke.spiralMinTurn
  );
}

/**
 * @param {readonly Point[]} path
 * @param {typeof STROKE} stroke
 * @returns {number}
 */
function turnOf(path, stroke) {
  return totalTurnDegrees(path, {
    sampleDistance: stroke.turnSampleDistance,
    smoothingWindow: stroke.turnSmoothingWindow,
  });
}

/**
 * @param {readonly Point[]} path
 * @param {typeof STROKE} stroke
 * @returns {"spiral"|null}
 */
function detectSpiral(path, stroke) {
  const turn = turnOf(path, stroke);
  return turn >= stroke.spiralMinTurn ? "spiral" : null;
}

/**
 * A lightning bolt is a zigzag: the pointer keeps changing horizontal
 * direction. Chevrons never do — they reverse in Y instead — so this test
 * cannot steal a V or a Ʌ.
 * @param {readonly Point[]} path
 * @param {typeof STROKE} stroke
 * @returns {"bolt"|null}
 */
function detectBolt(path, stroke) {
  const reversals = countReversals(path, "x", stroke.reversalDeadzone);
  return reversals >= stroke.boltMinReversals ? "bolt" : null;
}

/**
 * The original chevron heuristic, unchanged so the feel of drawing V and Ʌ is
 * preserved: compare the path's midpoint against both endpoints, relative to
 * how wide the stroke is.
 * @param {readonly Point[]} path
 * @param {typeof STROKE} stroke
 * @returns {"chevronDown"|"chevronUp"|null}
 */
function detectChevron(path, stroke) {
  const start = path[0];
  const end = path[path.length - 1];
  const mid = midpoint(path);

  const width = Math.abs(end.x - start.x);
  const threshold = stroke.chevronRatio * width;

  const dip = Math.min(mid.y - start.y, mid.y - end.y);
  if (dip > threshold) return "chevronDown";

  const rise = Math.min(start.y - mid.y, end.y - mid.y);
  if (rise > threshold) return "chevronUp";

  return null;
}

/**
 * @param {readonly Point[]} path
 * @returns {"horizontal"|"vertical"}
 */
function detectLine(path) {
  const angle = headingDegrees(path);
  return angle <= 45 || angle >= 135 ? "horizontal" : "vertical";
}
