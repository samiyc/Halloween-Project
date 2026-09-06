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
 * Heights of the two text lines of a button, matching `FONTS.hud` and
 * `FONTS.label`, plus the space between them.
 *
 * They live here, with the rectangles, rather than in the drawing code: text
 * placed by offsets counted down from the top of a rect is exactly how the
 * "Échap" hint ended up sitting on the pause button's bottom border, and a
 * number kept in `menu.js` is a number no test can reach. A test pins them
 * against the fonts they stand for.
 */
export const LINE_HEIGHT = Object.freeze({ label: 24, hint: 19, gap: 9 });

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
 * Where a button's text sits, as middle-baseline y coordinates: the label
 * first, then the hint when there is one.
 *
 * Measured out from the middle of the rect, so both lines stay inside it at any
 * height — which is what makes the button safe to resize.
 *
 * @param {Button} button
 * @returns {Array<{y: number, height: number}>}
 */
export function buttonLines({ rect, hint }) {
  const centerY = rect.y + rect.height / 2;
  const { label, hint: hintHeight, gap } = LINE_HEIGHT;
  if (!hint) return [{ y: centerY, height: label }];

  const block = label + gap + hintHeight;
  const top = centerY - block / 2;
  return [
    { y: top + label / 2, height: label },
    { y: top + block - hintHeight / 2, height: hintHeight },
  ];
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
 *
 * Tall enough for two lines: at 64 the « Échap » hint sat on the bottom border.
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
      height: 76,
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
