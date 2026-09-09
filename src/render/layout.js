import { DIFFICULTIES, DIFFICULTY_IDS } from "../config/difficulty.js";
import { LEVELS } from "../config/levels.js";
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
 * @typedef {{id: string, kind?: string, levelId?: string, label: string,
 *   hint?: string, rect: Rect, enabled: boolean}} Button
 *
 * `kind` is what the click handler branches on — "difficulty", "resume",
 * "level" or "info" — rather than parsing an id back apart.
 */

const MENU_BUTTON = Object.freeze({ width: 460, height: 96, gap: 20 });
/** The small square that unfolds an episode's story. Not a launch button. */
const INFO_BUTTON = Object.freeze({ size: 56, gap: 12 });
const COLUMN_GAP = 60;
/** Top of both menu columns; the title and the subtitle sit above it. */
const MENU_TOP = 250;
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
 * Where the two columns start.
 *
 * The info buttons are counted in the total width, so the block stays optically
 * centred instead of leaning left by half a small square.
 *
 * @returns {{training: number, story: number, info: number, width: number}}
 */
export function menuColumns() {
  const { width } = MENU_BUTTON;
  const total = 2 * width + COLUMN_GAP + INFO_BUTTON.gap + INFO_BUTTON.size;
  const training = (CANVAS.width - total) / 2;
  const story = training + width + COLUMN_GAP;
  return { training, story, info: story + width + INFO_BUTTON.gap, width };
}

/**
 * The left column: the three training modes, then "back to the game".
 *
 * @param {{canResume: boolean}} session
 * @returns {Button[]}
 */
export function trainingButtons({ canResume }) {
  const { width, height, gap } = MENU_BUTTON;
  const x = menuColumns().training;
  let y = MENU_TOP;

  const buttons = DIFFICULTY_IDS.map((id) => {
    const button = {
      id,
      kind: "difficulty",
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
    kind: "resume",
    label: "Retour au jeu",
    hint: canResume ? "Reprend la partie en cours" : "Aucune partie en cours",
    rect: { x, y, width, height },
    enabled: canResume,
  });
  return buttons;
}

/**
 * The centre column: one button per story episode.
 *
 * A locked episode is drawn greyed and swallows nothing — `buttonAt()` already
 * skips disabled buttons, so it behaves like empty space, exactly like a
 * "Retour au jeu" with nothing to resume.
 *
 * @param {{isUnlocked: (id: string) => boolean, isCompleted: (id: string) => boolean}} [progress]
 *   Missing progress means a fresh campaign: only the first episode is open.
 * @returns {Button[]}
 */
export function storyButtons(progress) {
  const { width, height, gap } = MENU_BUTTON;
  const x = menuColumns().story;

  return LEVELS.map((level, index) => {
    const unlocked = progress?.isUnlocked(level.id) ?? index === 0;
    return {
      id: `level:${level.id}`,
      kind: "level",
      levelId: level.id,
      label: unlocked ? level.name : "— verrouillé —",
      hint: storyHint(level, progress, unlocked),
      rect: { x, y: MENU_TOP + index * (height + gap), width, height },
      enabled: unlocked,
    };
  });
}

/**
 * The little square beside each open episode. It launches nothing: it unfolds
 * the story text under the menu.
 *
 * @param {{isUnlocked: (id: string) => boolean, isCompleted: (id: string) => boolean}} [progress]
 * @returns {Button[]}
 */
export function infoButtons(progress) {
  const { size } = INFO_BUTTON;
  const x = menuColumns().info;

  return storyButtons(progress)
    .filter((button) => button.enabled)
    .map((button) => ({
      id: `info:${button.levelId}`,
      kind: "info",
      levelId: button.levelId,
      label: "i",
      rect: { x, y: button.rect.y + (button.rect.height - size) / 2, width: size, height: size },
      enabled: true,
    }));
}

/**
 * Everything clickable on the menu screen, in one list, so the click handling
 * and the drawing walk the same thing.
 *
 * @param {{canResume: boolean, progress?: object}} session
 * @returns {Button[]}
 */
export function menuButtons(session) {
  return [
    ...trainingButtons(session),
    ...storyButtons(session.progress),
    ...infoButtons(session.progress),
  ];
}

/**
 * @param {import("../config/levels.js").Level} level
 * @param {object} [progress]
 * @param {boolean} unlocked
 * @returns {string}
 */
function storyHint(level, progress, unlocked) {
  if (!unlocked) return "Gagnez l'épisode précédent";
  return progress?.isCompleted(level.id) ? "Terminé — rejouable" : "Nouvel épisode";
}

/**
 * The story panel's text metrics.
 *
 * Here rather than in `menu.js` for the reason `LINE_HEIGHT` is here: a number
 * kept in the drawing code is a number no test can reach, and that is exactly
 * how the "Échap" hint ended up sitting on the pause button's bottom border.
 *
 * `descender` is the room left under the last baseline. Without it the panel
 * ended a few pixels under the text and the tails of the g's and p's touched
 * the border.
 */
export const STORY_PANEL = Object.freeze({
  pad: 28,
  maxChars: 96,
  /** Baseline of the title, measured down from the padded top. */
  titleHeight: 24,
  gapAfterTitle: 42,
  lineHeight: 28,
  descender: 8,
});

/**
 * The brief, plus the debrief once the episode has been won.
 *
 * The empty string between the two is a blank line: the wrapping is done here,
 * so what comes out is a list of lines and nothing more.
 *
 * @param {import("../config/levels.js").Level} level
 * @param {boolean} completed
 * @returns {string[]}
 */
export function storyLines(level, completed) {
  const brief = wrapLines(level.brief, STORY_PANEL.maxChars);
  if (!completed) return brief;
  return [...brief, "", ...wrapLines(level.debrief, STORY_PANEL.maxChars)];
}

/**
 * The panel under the menu where an episode's story is written: its rectangle
 * and every baseline inside it.
 *
 * **The height follows the text**, so the margin under the last line is the
 * same as the one above the title whatever the episode says. The panel used to
 * be a fixed rectangle the text was simply poured into, which left a won
 * episode — brief, blank line, debrief — ending 8px from the border.
 *
 * A test walks every episode and checks the panel still fits the canvas: that
 * is what keeps a story text to the three-to-five lines `docs/story-mode.md`
 * asks for.
 *
 * @param {import("../config/levels.js").Level} level
 * @param {boolean} completed
 * @returns {{rect: Rect, title: {y: number}, lines: {text: string, y: number}[]}}
 */
export function storyPanel(level, completed) {
  const { pad, titleHeight, gapAfterTitle, lineHeight, descender } = STORY_PANEL;
  const columns = menuColumns();
  const { height, gap } = MENU_BUTTON;
  const top = MENU_TOP + LEVELS.length * (height + gap) + 40;

  const texts = storyLines(level, completed);
  const firstLineY = top + pad + titleHeight + gapAfterTitle;
  const lastLineY = firstLineY + Math.max(0, texts.length - 1) * lineHeight;

  return {
    rect: {
      x: columns.training,
      y: top,
      width: columns.info + INFO_BUTTON.size - columns.training,
      height: lastLineY + descender + pad - top,
    },
    title: { y: top + pad + titleHeight },
    lines: texts.map((text, index) => ({ text, y: firstLineY + index * lineHeight })),
  };
}

/**
 * Breaks a paragraph into lines of at most `maxChars` characters.
 *
 * A character count rather than `ctx.measureText()`, on purpose: the menu fonts
 * are fixed, and a pure function is one a test can check. Measuring would move
 * the only wrapping rule into the drawing code, where nothing can reach it.
 *
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
export function wrapLines(text, maxChars) {
  const lines = [];
  let line = "";

  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
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
