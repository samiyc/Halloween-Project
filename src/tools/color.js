/**
 * Colour arithmetic.
 *
 * Lives in `tools/` rather than `render/` because entities need it too — an
 * enemy computes its own tint — and `entities/` must never import from
 * `render/`.
 */

/**
 * @param {string} hex `#rgb` or `#rrggbb`
 * @returns {{r: number, g: number, b: number}}
 */
function channels(hex) {
  const digits = hex.slice(1);
  // The shorthand is not a curiosity here: `ENEMY.color` is "#AAA", and read as
  // six digits it parses to a dark blue instead of grey.
  const full =
    digits.length === 3
      ? digits.replace(/./g, (digit) => digit + digit)
      : digits;

  const value = Number.parseInt(full, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/**
 * A hex colour at partial opacity.
 *
 * Lets a translucent shade be derived from the colour that defines it rather
 * than hand-copied — which is how the frost preview circle and the frozen tint
 * would otherwise drift apart.
 *
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function withAlpha(hex, alpha) {
  const { r, g, b } = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Blends two hex colours.
 *
 * @param {string} from   Returned at `amount` 0.
 * @param {string} to     Returned at `amount` 1.
 * @param {number} amount Clamped to 0..1.
 * @returns {string}
 */
export function mixHex(from, to, amount) {
  const ratio = Math.max(0, Math.min(1, amount));
  if (ratio === 0) return from;
  if (ratio === 1) return to;

  const a = channels(from);
  const b = channels(to);
  const blend = (start, end) => Math.round(start + (end - start) * ratio);
  return `rgb(${blend(a.r, b.r)}, ${blend(a.g, b.g)}, ${blend(a.b, b.b)})`;
}
