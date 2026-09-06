import { DIFFICULTIES, DIFFICULTY_IDS } from "../config/difficulty.js";
import { CANVAS, SIDEBAR } from "../config/settings.js";

/**
 * Where every clickable thing is, as plain rectangles.
 *
 * This file lives in `render/` but never touches a 2D context: it only computes
 * geometry. That is the point — the same rectangles feed the drawing code *and*
 * the click handling, so a button can never be drawn somewhere it cannot be
 * pressed. And being pure, it is the one part of the interface a unit test can
 * actually check.
 *
 * @typedef {{x: number, y: number, width: number, height: number}} Rect
 * @typedef {{id: string, label: string, hint?: string, rect: Rect, enabled: boolean}} Button
 */

const MENU_BUTTON = Object.freeze({ width: 460, height: 96, gap: 24 });
const PAD = 20;

/**
 * @param {Rect} rect
 * @param {{x: number, y: number}} point  In canvas coordinates, not field ones.
 * @returns {boolean}
 */
export function hits(rect, point) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * The first enabled button under the point, or null.
 *
 * Disabled buttons are skipped rather than swallowing the click, so a greyed
 * "Retour au jeu" behaves like empty space.
 *
 * @param {readonly Button[]} buttons
 * @param {{x: number, y: number}} point
 * @returns {Button|null}
 */
export function buttonAt(buttons, point) {
  return buttons.find((button) => button.enabled && hits(button.rect, point)) ?? null;
}

/**
 * The menu's four buttons, stacked and centred.
 *
 * @param {{canResume: boolean}} session
 * @returns {Button[]}
 */
export function menuButtons({ canResume }) {
  const { width, height, gap } = MENU_BUTTON;
  const rows = DIFFICULTY_IDS.length + 1;
  const total = rows * height + (rows - 1) * gap;
  const x = (CANVAS.width - width) / 2;
  let y = (CANVAS.height - total) / 2;

  const buttons = DIFFICULTY_IDS.map((id) => {
    const button = {
      id,
      label: DIFFICULTIES[id].name,
      hint: DIFFICULTIES[id].summary,
      rect: { x, y, width, height },
      enabled: true,
    };
    y += height + gap;
    return button;
  });

  buttons.push({
    id: "resume",
    label: "Retour au jeu",
    hint: canResume ? "Reprend la partie en cours" : "Aucune partie en cours",
    rect: { x, y, width, height },
    enabled: canResume,
  });
  return buttons;
}

/**
 * The pause button, top of the right sidebar. The glyph legend sits below it.
 * @returns {Button}
 */
export function pauseButton() {
  return {
    id: "pause",
    label: "Pause / Menu",
    hint: "Échap",
    rect: {
      x: CANVAS.width - SIDEBAR.width + PAD,
      y: PAD,
      width: SIDEBAR.width - 2 * PAD,
      height: 64,
    },
    enabled: true,
  };
}

/**
 * The "Menu" button on the game-over screen.
 *
 * Clicking anywhere else still restarts at the same difficulty, so this one has
 * to be tested first — otherwise pressing it would relaunch a run instead.
 * @returns {Button}
 */
export function gameOverMenuButton() {
  const width = 320;
  const height = 72;
  return {
    id: "menu",
    label: "Menu",
    rect: {
      x: (CANVAS.width - width) / 2,
      y: CANVAS.height / 2 + 120,
      width,
      height,
    },
    enabled: true,
  };
}
