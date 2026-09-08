import { levelOf } from "../config/levels.js";
import { CANVAS } from "../config/settings.js";
import {
  buttonLines,
  menuButtons,
  menuColumns,
  storyPanel,
  trainingButtons,
  wrapLines,
} from "./layout.js";
import { FONTS, PALETTE } from "./palette.js";

/**
 * The menu — training on the left, the campaign in the middle — and the button
 * style shared with the HUD.
 *
 * The menu owns no geometry of its own: every rectangle comes from
 * `layout.js`, which the click handling reads too. A button drawn here is a
 * button that can be pressed, by construction.
 */

/** Text lines in the story panel, at `FONTS.label` and its padding. */
const PANEL = Object.freeze({ pad: 28, lineHeight: 28, maxChars: 96 });

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import("./layout.js").Button} button
 */
export function drawButton(ctx, button) {
  const { rect, enabled } = button;
  const border = enabled ? PALETTE.slotReady : PALETTE.slotEmpty;

  ctx.fillStyle = PALETTE.buttonFill;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  // Line positions come from `layout.js`, like the rectangle itself: a line
  // placed by a constant counted down from `rect.y` is what put the "Échap"
  // hint on the bottom border, and it was a number no test could see.
  const [label, hint] = buttonLines(button);
  const centerX = rect.x + rect.width / 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = enabled ? PALETTE.text : PALETTE.textMuted;
  ctx.font = FONTS.hud;
  ctx.fillText(button.label, centerX, label.y);

  if (hint) {
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.fillText(button.hint, centerX, hint.y);
  }

  // Restored: every other draw in the HUD assumes the default baseline.
  ctx.textBaseline = "alphabetic";
}

/**
 * The whole menu screen.
 *
 * Drawn over the full canvas rather than only the board: the run is paused, so
 * the sidebars have nothing live to report.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{canResume: boolean, progress?: object, infoLevelId?: string|null}} session
 */
export function drawMenu(ctx, session) {
  ctx.fillStyle = PALETTE.menuBackdrop;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  drawTitles(ctx, session);
  for (const button of menuButtons(session)) {
    drawButton(ctx, button);
  }
  drawStory(ctx, session);
}

/**
 * The game title, the hint, and the heading over each column.
 *
 * The vertical anchor is the first button's rectangle rather than a constant of
 * its own: move the columns and the titles follow.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{canResume: boolean}} session
 */
function drawTitles(ctx, session) {
  const top = trainingButtons(session)[0].rect.y;
  const columns = menuColumns();

  ctx.textAlign = "center";
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONTS.headline;
  ctx.fillText("Spell Blaster 3000", CANVAS.width / 2, top - 130);

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = FONTS.hint;
  ctx.fillText("Choisissez une mission — Échap pour revenir", CANVAS.width / 2, top - 70);

  ctx.textAlign = "left";
  ctx.font = FONTS.label;
  ctx.fillText("ENTRAÎNEMENT", columns.training, top - 18);
  ctx.fillText("HISTOIRE", columns.story, top - 18);
}

/**
 * The story of the episode whose info button was pressed.
 *
 * The `debrief` only appears once the episode has been won: it says how it
 * ended, so showing it beforehand would spoil the one thing the level is for.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{progress?: object, infoLevelId?: string|null}} session
 */
function drawStory(ctx, session) {
  const level = levelOf(session.infoLevelId ?? null);
  if (!level) return;
  const completed = session.progress?.isCompleted(level.id) ?? false;

  const rect = storyPanel();
  ctx.strokeStyle = PALETTE.slotEmpty;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  ctx.textAlign = "left";
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONTS.hud;
  ctx.fillText(level.name, rect.x + PANEL.pad, rect.y + PANEL.pad + 20);

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = FONTS.label;
  let y = rect.y + PANEL.pad + 66;
  for (const line of storyLines(level, completed)) {
    ctx.fillText(line, rect.x + PANEL.pad, y);
    y += PANEL.lineHeight;
  }
}

/**
 * The brief, plus the debrief once the episode has been won.
 *
 * An empty string between the two is a blank line: the wrapping is done, so
 * this is a list of lines and nothing more.
 *
 * @param {import("../config/levels.js").Level} level
 * @param {boolean} completed
 * @returns {string[]}
 */
function storyLines(level, completed) {
  const brief = wrapLines(level.brief, PANEL.maxChars);
  if (!completed) return brief;
  return [...brief, "", ...wrapLines(level.debrief, PANEL.maxChars)];
}
