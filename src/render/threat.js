import { FIELD } from "../config/settings.js";
import { THREAT_COLORS } from "./palette.js";

/**
 * The markers that sit on the bottom line, under whatever is closest to
 * crossing it.
 *
 * Drawn in **field** coordinates, so this belongs inside `Renderer.inField()` —
 * the same offset every entity goes through, which is what keeps a marker under
 * the enemy it points at rather than 300px to the side.
 *
 * Kept out of `renderer.js`, which is already close to the 220-line budget.
 */

/**
 * Big enough to be found without looking for it.
 *
 * 22x14 originally, scaled x1.5: at that size it read as part of the board edge
 * rather than as a warning, which is the one job it has.
 */
const MARKER = Object.freeze({ width: 33, height: 21 });

/**
 * A dark rim, the same idiom as the turret dome.
 *
 * Markers are drawn over everything so they cannot be hidden, which means one
 * lands on the boss when the boss is the thing about to cross — and red on the
 * boss orange is very nearly invisible. The rim is what keeps it readable on
 * the field, on a grey enemy and on that orange alike.
 */
const MARKER_EDGE = "rgba(0, 0, 0, 0.55)";

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {readonly import("../game/threat.js").Threat[]} markers  One per threat
 *   past the warning threshold, or the single quiet one below it. An empty board
 *   hands over an empty list and nothing is drawn.
 */
export function drawThreatMarkers(ctx, markers) {
  for (const marker of markers) {
    drawMarker(ctx, marker);
  }
}

/**
 * A filled triangle pointing **up**, at the danger it is announcing, its base
 * resting on the line that ends the run.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import("../game/threat.js").Threat} marker
 */
function drawMarker(ctx, marker) {
  const base = FIELD.height;
  ctx.beginPath();
  ctx.moveTo(marker.x, base - MARKER.height);
  ctx.lineTo(marker.x - MARKER.width / 2, base);
  ctx.lineTo(marker.x + MARKER.width / 2, base);
  ctx.closePath();
  ctx.fillStyle = THREAT_COLORS[marker.level];
  ctx.fill();
  ctx.strokeStyle = MARKER_EDGE;
  ctx.lineWidth = 2;
  ctx.stroke();
}
