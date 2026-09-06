/**
 * Aiming geometry: angles, turning, and rays.
 *
 * Pure trigonometry with no game vocabulary, so the turret's behaviour can be
 * checked without building a turret. It lives in `tools/` rather than
 * `engine/gesture/geometry.js` because that module measures *strokes* — a
 * different problem that happens to share the word "angle".
 *
 * Angles are in radians, measured the canvas way: 0 points right, and positive
 * turns clockwise because y grows downward.
 *
 * @typedef {{x: number, y: number}} Point
 * @typedef {{x: number, y: number, angle: number}} Ray
 */

const TAU = Math.PI * 2;

/**
 * Wraps an angle into (-π, π].
 *
 * Every comparison below depends on this: two angles a hair either side of the
 * half-turn are neighbours, not opposites, and only the wrapped form says so.
 *
 * @param {number} angle
 * @returns {number}
 */
export function normalizeAngle(angle) {
  const wrapped = ((angle + Math.PI) % TAU + TAU) % TAU;
  return wrapped - Math.PI;
}

/**
 * The angle from one point to another.
 * @param {Point} from
 * @param {Point} to
 * @returns {number}
 */
export function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * The shortest signed turn from one angle to another, in (-π, π].
 * @param {number} from
 * @param {number} to
 * @returns {number}
 */
export function angleDelta(from, to) {
  return normalizeAngle(to - from);
}

/**
 * Turns towards a target angle, by at most `maxStep`.
 *
 * This one function is what makes the turret escapable: uncapped, a barrel that
 * simply assigned `angleTo(player)` would be a laser sight nothing could
 * outrun. It always takes the short way round, so tracking a target that
 * crosses behind the turret does not send the barrel the long way about.
 *
 * @param {number} current
 * @param {number} target
 * @param {number} maxStep  Non-negative; 0 freezes the barrel.
 * @returns {number}
 */
export function turnToward(current, target, maxStep) {
  const delta = angleDelta(current, target);
  if (Math.abs(delta) <= maxStep) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(delta) * maxStep);
}

/**
 * A point `distance` along a ray.
 * @param {Ray} ray
 * @param {number} distance
 * @returns {Point}
 */
export function pointOnRay(ray, distance) {
  return {
    x: ray.x + Math.cos(ray.angle) * distance,
    y: ray.y + Math.sin(ray.angle) * distance,
  };
}

/**
 * Distance from a point to a ray — forward only.
 *
 * A ray, not a line: everything behind the muzzle measures back to the origin
 * rather than onto the infinite extension, so standing behind the barrel is
 * safe. A beam that damaged its own back side would be unreadable.
 *
 * @param {Point} point
 * @param {Ray} ray
 * @param {number} [length] Cap the ray; beyond it, distance is to the far end.
 * @returns {number}
 */
export function distanceToRay(point, ray, length = Number.POSITIVE_INFINITY) {
  const alongX = Math.cos(ray.angle);
  const alongY = Math.sin(ray.angle);
  const offsetX = point.x - ray.x;
  const offsetY = point.y - ray.y;

  const projected = Math.min(Math.max(offsetX * alongX + offsetY * alongY, 0), length);
  return Math.hypot(offsetX - alongX * projected, offsetY - alongY * projected);
}
