import { CANVAS, SIDEBAR } from "../config/settings.js";
import { FONTS, PALETTE } from "./palette.js";

/**
 * The vertical bars in the sidebars: mana on the left, health on the right.
 *
 * One function drawn twice rather than two near-identical ones. The spec asks
 * for a health bar "symmetric to the mana bar, same dimensions and values", so
 * the symmetry is literal here — only the side, the colour and the numbers
 * differ.
 */
export const GAUGE = Object.freeze({ thickness: 18, length: 460 });

const PAD = 20;
const LABEL_GAP = 14;

/**
 * @typedef {object} GaugeSpec
 * @property {"left"|"right"} side   Which sidebar, and therefore which way the
 *   labels run: outward, away from the board.
 * @property {number} ratio          0 to 1.
 * @property {string} label          "MANA", "VIE".
 * @property {number} value
 * @property {number} max
 * @property {string} fill
 * @property {boolean} [alert]       Flash the fill and the number.
 * @property {number} [tickAt]       Absolute value to mark, e.g. one cast.
 */

/**
 * Where the bar sits for a given side: always hugging the play area, anchored
 * to the bottom of its sidebar.
 * @param {"left"|"right"} side
 * @returns {{x: number, top: number, bottom: number}}
 */
export function gaugeBounds(side) {
  const bottom = CANVAS.height - PAD;
  const x =
    side === "left"
      ? SIDEBAR.width - PAD - GAUGE.thickness
      : CANVAS.width - SIDEBAR.width + PAD;
  return { x, top: bottom - GAUGE.length, bottom };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {GaugeSpec} spec
 */
export function drawVerticalGauge(ctx, spec) {
  const { thickness, length } = GAUGE;
  const { x, top, bottom } = gaugeBounds(spec.side);

  ctx.fillStyle = PALETTE.manaTrack;
  ctx.fillRect(x, top, thickness, length);

  const filled = length * Math.max(0, Math.min(1, spec.ratio));
  ctx.fillStyle = spec.alert ? PALETTE.manaWarning : spec.fill;
  ctx.fillRect(x, bottom - filled, thickness, filled);

  if (spec.tickAt !== undefined && spec.max > 0) {
    ctx.fillStyle = PALETTE.text;
    ctx.fillRect(x, bottom - (length * spec.tickAt) / spec.max, thickness, 1);
  }

  drawGaugeLabels(ctx, spec, { x, top, bottom, thickness });
}

/**
 * The label, the value and the maximum, set outward from the bar so they never
 * sit over the board.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {GaugeSpec} spec
 * @param {{x: number, top: number, bottom: number, thickness: number}} box
 */
function drawGaugeLabels(ctx, spec, box) {
  const onLeft = spec.side === "left";
  const anchor = onLeft ? box.x - LABEL_GAP : box.x + box.thickness + LABEL_GAP;
  ctx.textAlign = onLeft ? "right" : "left";

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = FONTS.label;
  ctx.fillText(spec.label, anchor, box.top + 16);

  ctx.fillStyle = spec.alert ? PALETTE.manaWarning : PALETTE.text;
  ctx.font = FONTS.subhead;
  ctx.fillText(String(Math.floor(spec.value)), anchor, box.bottom - 30);

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = FONTS.label;
  ctx.fillText(`/ ${spec.max}`, anchor, box.bottom);
}
