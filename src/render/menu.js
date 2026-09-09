import { IS_DEV_MODE } from "../config/dev.js";
import { levelOf } from "../config/levels.js";
import { CANVAS } from "../config/settings.js";
import {
  STORY_PANEL,
  buttonLines,
  menuButtons,
  menuColumns,
  storyPanel,
  trainingButtons,
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
  // The dev switches announce themselves: one left on in a commit is then
  // visible the moment the page opens, which no test can do without turning
  // red exactly while the switch is being used. See `config/dev.js`.
  const hint = IS_DEV_MODE ? " — mode dev" : "";
  ctx.fillText(`Choisissez une mission — Échap pour revenir${hint}`, CANVAS.width / 2, top - 70);

  ctx.textAlign = "left";
  ctx.font = FONTS.label;
  ctx.fillText("ENTRAÎNEMENT", columns.training, top - 18);
  ctx.fillText("HISTOIRE", columns.story, top - 18);
}

/**
 * The story of the episode whose info button was pressed.
 *
 * The `debrief` only appears once the episode has been won — it says how it
 * ended, so showing it beforehand would spoil the one thing the level is for.
 * `showsStoryOf()` rather than `isCompleted()` is what lets the dev switch
 * reveal them all without claiming any of them was played.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{progress?: object, infoLevelId?: string|null}} session
 */
function drawStory(ctx, session) {
  const level = levelOf(session.infoLevelId ?? null);
  if (!level) return;

  // Everything below is placed by `layout.js`, rectangle and baselines alike:
  // not one position is written in this file.
  const { rect, title, lines } = storyPanel(
    level,
    session.progress?.showsStoryOf(level.id) ?? false,
  );
  const x = rect.x + STORY_PANEL.pad;

  ctx.strokeStyle = PALETTE.slotEmpty;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  ctx.textAlign = "left";
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONTS.hud;
  ctx.fillText(level.name, x, title.y);

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = FONTS.label;
  for (const line of lines) {
    ctx.fillText(line.text, x, line.y);
  }
}
