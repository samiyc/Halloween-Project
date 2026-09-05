import { SIDEBAR } from "../config/settings.js";

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
});

export const FONTS = Object.freeze({
  sequence: "16px Arial",
  rareSequence: "bold 18px Arial",
  label: "12px Arial",
  hud: "15px Arial",
  headline: "48px Arial",
  subhead: "24px Arial",
  hint: "13px Arial",
});
