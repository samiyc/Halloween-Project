import { THREAT } from "../config/settings.js";

/**
 * How close the board is to ending the run, and where to look.
 *
 * Losing to something you never noticed is the cheapest death in the game: a
 * long-sequence enemy is *slow*, so it crosses the bottom line at the moment
 * attention is furthest from it. This computes what the markers on that line
 * point at — pure, like the rest of `src/game/`, so the rule is testable and
 * the renderer only draws what it is handed.
 *
 * @typedef {"calm"|"warn"|"danger"} ThreatLevel
 * @typedef {{x: number, ratio: number, level: ThreatLevel}} Threat
 */

/**
 * @param {number} ratio  0 at the top of the field, 1 on the losing line.
 * @returns {ThreatLevel}
 */
export function threatLevelOf(ratio) {
  if (ratio >= THREAT.dangerRatio) return "danger";
  if (ratio >= THREAT.warnRatio) return "warn";
  return "calm";
}

/**
 * One entity, reduced to what the marker needs.
 *
 * Progress is measured on `y`, the **top** edge, because that is exactly what
 * `hasEscaped()` compares against the field height. Measuring the bottom edge
 * instead would have the marker turn red at a different moment for a 40px enemy
 * and a 160px boss, and reach 1 well before either had actually lost the run.
 *
 * @param {{y: number, centerX: number}} threat
 * @param {number} fieldHeight
 * @returns {Threat}
 */
function markerFor(threat, fieldHeight) {
  // Clamped, so an entity already past the line reads as a full bar rather than
  // as something beyond it. It stays there for the one frame before the run ends.
  const ratio = Math.min(1, Math.max(0, threat.y / fieldHeight));
  return { x: threat.centerX, ratio, level: threatLevelOf(ratio) };
}

/**
 * The entity closest to crossing the bottom line, and how close it is.
 *
 * One pass, no sort: this runs once per rendered frame.
 *
 * @param {readonly {y: number, centerX: number}[]} threats
 * @param {number} fieldHeight
 * @returns {Threat|null} null when there is nothing to point at
 */
export function lowestThreat(threats, fieldHeight) {
  let lowest = null;
  for (const threat of threats) {
    if (lowest === null || threat.y > lowest.y) lowest = threat;
  }
  return lowest === null ? null : markerFor(lowest, fieldHeight);
}

/**
 * Every marker the bottom line should carry this frame.
 *
 * Past `warnRatio` each threat is announced **separately**: two enemies a few
 * pixels apart used to share a single marker, so the second was invisible until
 * the first was dealt with — precisely the surprise this exists to prevent.
 *
 * Below that threshold the board falls back to a single grey marker on the
 * lowest threat. Nothing is urgent, so one quiet reminder of where the bottom of
 * the board stands is enough; a marker under every enemy would be noise.
 *
 * @param {readonly {y: number, centerX: number}[]} threats
 * @param {number} fieldHeight
 * @returns {Threat[]} empty only on an empty board
 */
export function threatMarkers(threats, fieldHeight) {
  const urgent = [];
  for (const threat of threats) {
    const marker = markerFor(threat, fieldHeight);
    if (marker.level !== "calm") urgent.push(marker);
  }
  if (urgent.length > 0) return urgent;

  // Nothing crossed the threshold, so this one is grey by construction.
  const quiet = lowestThreat(threats, fieldHeight);
  return quiet === null ? [] : [quiet];
}
