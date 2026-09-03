import { ALL_GLYPHS } from "../config/glyphs.js";
import { END_REASON, GAME_STATUS } from "../game/game.js";
import { FONTS, PALETTE } from "./palette.js";

/** @type {Readonly<Record<string, string>>} */
const LOSS_MESSAGES = Object.freeze({
  [END_REASON.boss]: "Le boss a franchi la ligne.",
  [END_REASON.enemy]: "Un ennemi a franchi la ligne.",
});

/**
 * Score, melee cooldown, glyph legend and the end-of-game overlay.
 *
 * Split from `Renderer` because these draw in screen space and read game
 * state, whereas the renderer draws entities in board space.
 */
export class Hud {
  /** @param {CanvasRenderingContext2D} ctx */
  constructor(ctx) {
    this.ctx = ctx;
  }

  get width() {
    return this.ctx.canvas.width;
  }

  get height() {
    return this.ctx.canvas.height;
  }

  /** @param {import("../game/game.js").Game} game */
  draw(game) {
    this.drawScore(game.enemiesDefeated);
    this.drawMeleeCooldown(game.player);
    this.drawGlyphLegend();
  }

  /** @param {number} defeated */
  drawScore(defeated) {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONTS.hud;
    ctx.textAlign = "left";
    ctx.fillText(`Ghost Eliminated : ${defeated}`, 16, this.height - 20);
  }

  /**
   * A bar that fills as the auto-attack recharges, so the 1.5s rhythm is
   * readable rather than felt.
   * @param {import("../entities/player.js").Player} player
   */
  drawMeleeCooldown(player) {
    const { ctx } = this;
    const barWidth = 140;
    const barHeight = 6;
    const x = 16;
    const y = this.height - 46;
    const ready = 1 - player.meleeChargeRatio;

    ctx.fillStyle = PALETTE.cooldownTrack;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = PALETTE.cooldownFill;
    ctx.fillRect(x, y, barWidth * ready, barHeight);

    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.textAlign = "left";
    ctx.fillText("Mêlée auto", x + barWidth + 10, y + barHeight);
  }

  /** Reminds the player which gesture draws which symbol. */
  drawGlyphLegend() {
    const { ctx } = this;
    ctx.font = FONTS.label;
    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.textMuted;

    let y = 24;
    for (const glyph of ALL_GLYPHS) {
      ctx.fillText(`${glyph.symbol}  ${glyph.name}`, this.width - 16, y);
      y += 16;
    }
  }

  /**
   * End-of-game overlay. The lines are spaced so the 48px headline and the
   * 24px score no longer collide the way they did before.
   *
   * @param {import("../game/game.js").Game} game
   * @param {boolean} canRestart
   */
  drawGameOver(game, canRestart) {
    const { ctx } = this;
    const won = game.status === GAME_STATUS.won;
    const centerX = this.width / 2;
    const centerY = this.height / 2;

    ctx.fillStyle = PALETTE.overlay;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.textAlign = "center";
    ctx.fillStyle = won ? PALETTE.win : PALETTE.lose;
    ctx.font = FONTS.headline;
    ctx.fillText(won ? "You Win!" : "Game Over", centerX, centerY - 40);

    ctx.fillStyle = PALETTE.text;
    ctx.font = FONTS.subhead;
    ctx.fillText(`Ghost Eliminated : ${game.enemiesDefeated}`, centerX, centerY + 16);

    this.drawGameOverFooter(game, canRestart, centerX, centerY);
  }

  /**
   * The cause of death and the restart prompt.
   *
   * Losing to the boss is easy to miss while watching the enemies, so the
   * screen names whatever crossed the line.
   *
   * @param {import("../game/game.js").Game} game
   * @param {boolean} canRestart
   * @param {number} centerX
   * @param {number} centerY
   */
  drawGameOverFooter(game, canRestart, centerX, centerY) {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.hint;
    ctx.textAlign = "center";

    const reason = LOSS_MESSAGES[game.endedBecause];
    if (reason) ctx.fillText(reason, centerX, centerY + 46);
    if (canRestart) ctx.fillText("- Cliquez pour relancer -", centerX, centerY + 86);
  }
}
