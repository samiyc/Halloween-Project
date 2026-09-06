import { SIDEBAR } from "../config/settings.js";
import { SPELL_COLORS } from "../config/spells.js";

/**
 * A hex colour at partial opacity.
 *
 * Lets a translucent shade be derived from the one that defines it rather than
 * hand-copied, which is how the preview circle and the frost tint used to drift
 * apart waiting to happen.
 *
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
function withAlpha(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Every colour and font used on the canvas. Kept apart from `settings.js` so
 * that gameplay tuning and visual tuning do not share a file.
 *
 * The canvas background lives in `styles/halloween.css`; these are the values
 * only the 2D context can apply.
 */
export const PALETTE = Object.freeze({
  text: "#FFFFFF",
  textMuted: "rgba(255, 255, 255, 0.65)",
  stroke: "#FFE066",
  strokeGlow: "rgba(255, 224, 102, 0.35)",
  meleeRange: "rgba(63, 211, 95, 0.28)",
  meleeFlash: "#FFFFFF",
  rareSequence: "#E4D4FF",
  overlay: "rgba(20, 26, 30, 0.78)",
  win: "#7BE38A",
  lose: "#FF8B6B",
  cooldownTrack: "rgba(255, 255, 255, 0.22)",
  cooldownFill: "#3FD35F",
  manaTrack: "rgba(255, 255, 255, 0.18)",
  manaFill: "#4FA8FF",
  manaWarning: "#FF6B6B",
  slotEmpty: "rgba(255, 255, 255, 0.30)",
  slotReady: "#FFD447",
  /** Sidebars sit slightly darker than the board, so the board reads as the subject. */
  sidebar: SIDEBAR.color,
  field: "#546872",
  sidebarEdge: "rgba(0, 0, 0, 0.35)",
  /** Preview of a held spell area — the Givre colour itself, so they match. */
  spellRange: withAlpha(SPELL_COLORS.frost, 0.55),
  /** The health bar on Hard: the mana gauge mirrored, in red. */
  healthFill: "#E2564B",
  buttonFill: "rgba(255, 255, 255, 0.05)",
  menuBackdrop: "#2F373B",
});

/** Scaled with the world (x1.6) so text keeps its weight against the entities. */
export const FONTS = Object.freeze({
  sequence: "26px Arial",
  rareSequence: "bold 29px Arial",
  label: "19px Arial",
  hud: "24px Arial",
  headline: "76px Arial",
  subhead: "38px Arial",
  hint: "21px Arial",
});
