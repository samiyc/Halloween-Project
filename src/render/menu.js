import { CANVAS } from "../config/settings.js";
import { menuButtons } from "./layout.js";
import { FONTS, PALETTE } from "./palette.js";

/**
 * The difficulty menu, and the button style shared with the HUD.
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

  const hasHint = Boolean(button.hint);
  ctx.textAlign = "center";
  ctx.fillStyle = enabled ? PALETTE.text : PALETTE.textMuted;
  ctx.font = FONTS.hud;
  ctx.fillText(button.label, rect.x + rect.width / 2, rect.y + (hasHint ? 38 : 42));

  if (!hasHint) return;
  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = FONTS.label;
  ctx.fillText(button.hint, rect.x + rect.width / 2, rect.y + 66);
}

/**
 * The whole menu screen.
 *
 * Drawn over the full canvas rather than only the board: the run is paused, so
 * the sidebars have nothing live to report.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{canResume: boolean}} session
 */
export function drawMenu(ctx, session) {
  ctx.fillStyle = PALETTE.menuBackdrop;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  const buttons = menuButtons(session);
  const top = buttons[0].rect.y;

  ctx.textAlign = "center";
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONTS.headline;
  ctx.fillText("Magic Spell Game", CANVAS.width / 2, top - 130);

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = FONTS.hint;
  ctx.fillText("Choisissez une difficulté — Échap pour revenir", CANVAS.width / 2, top - 70);

  for (const button of buttons) {
    drawButton(ctx, button);
  }
}
