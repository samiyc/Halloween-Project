import { ALL_GLYPHS } from "../config/glyphs.js";
import { MANA } from "../config/mana.js";
import { SIDEBAR } from "../config/settings.js";
import { SPELLS } from "../config/spells.js";
import { END_REASON, GAME_STATUS } from "../game/game.js";
import { FONTS, PALETTE } from "./palette.js";

/** @type {Readonly<Record<string, string>>} */
const LOSS_MESSAGES = Object.freeze({
  [END_REASON.boss]: "Le boss a franchi la ligne.",
  [END_REASON.enemy]: "Un ennemi a franchi la ligne.",
});

const PAD = 20;

/**
 * The mana gauge, sized off the mockup: a tall vertical bar down the left
 * sidebar, hugging the play area, with its labels to the left of it.
 *
 * It sits on the left rather than the right because that is the edge the eye
 * already returns to for the spell slot and the score.
 */
const MANA_GAUGE = Object.freeze({ thickness: 18, length: 460 });

/**
 * Everything drawn in the two sidebars, plus the end-of-game overlay.
 *
 * The HUD used to be painted over the board and kept disappearing behind
 * falling enemies. It now lives entirely in the strips either side of the
 * field, in canvas coordinates — unlike the renderer, which works translated
 * into field space.
 *
 * Layout: the player's own state on the left (spell slot, score, melee), the
 * reference material on the right (glyph legend, mana gauge).
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

  /** Left edge of the right-hand sidebar. */
  get rightX() {
    return this.width - SIDEBAR.width;
  }

  /** @param {import("../game/game.js").Game} game */
  draw(game) {
    this.drawSpellSlot(game.heldSpell);
    this.drawScore(game.enemiesDefeated);
    this.drawMeleeCooldown(game.player);
    this.drawManaGauge(game);
    this.drawGlyphLegend();
  }

  // ---------------------------------------------------------------- left ---

  /**
   * The single spell slot, top of the left strip.
   * @param {string|null} heldSpell
   */
  drawSpellSlot(heldSpell) {
    const { ctx } = this;
    const spell = heldSpell ? SPELLS[heldSpell] : null;
    const width = SIDEBAR.width - 2 * PAD;

    // Sized for three lines of the x1.6 fonts plus descenders. At 84 the last
    // baseline sat on the border and the text was clipped by its own box.
    ctx.strokeStyle = spell ? PALETTE.slotReady : PALETTE.slotEmpty;
    ctx.lineWidth = 2;
    ctx.strokeRect(PAD, PAD, width, 114);

    ctx.textAlign = "left";
    if (!spell) {
      ctx.fillStyle = PALETTE.textMuted;
      ctx.font = FONTS.label;
      ctx.fillText("Aucun sort", PAD + 16, PAD + 64);
      return;
    }
    ctx.fillStyle = PALETTE.slotReady;
    ctx.font = FONTS.hud;
    ctx.fillText(spell.name, PAD + 16, PAD + 42);
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.fillText(spell.hint, PAD + 16, PAD + 74);
    ctx.fillText("touche E / clic droit", PAD + 16, PAD + 100);
  }

  /** @param {number} defeated */
  drawScore(defeated) {
    const { ctx } = this;
    ctx.textAlign = "left";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.fillText("FANTÔMES", PAD, 190);

    ctx.fillStyle = PALETTE.text;
    ctx.font = FONTS.headline;
    ctx.fillText(String(defeated), PAD, 262);
  }

  /**
   * A bar that fills as the auto-attack recharges, so the 1.5s rhythm is
   * readable rather than felt.
   * @param {import("../entities/player.js").Player} player
   */
  drawMeleeCooldown(player) {
    const { ctx } = this;
    const width = SIDEBAR.width - 2 * PAD;
    const height = 12;
    const y = 332;

    ctx.textAlign = "left";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.fillText("MÊLÉE AUTO", PAD, y - 12);

    ctx.fillStyle = PALETTE.cooldownTrack;
    ctx.fillRect(PAD, y, width, height);
    ctx.fillStyle = PALETTE.cooldownFill;
    ctx.fillRect(PAD, y, width * (1 - player.meleeChargeRatio), height);
  }

  // --------------------------------------------------------------- right ---

  /** Reminds the player which gesture draws which symbol. */
  drawGlyphLegend() {
    const { ctx } = this;
    const x = this.rightX + PAD;

    ctx.textAlign = "left";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.fillText("GESTES", x, PAD + 20);

    let y = PAD + 66;
    for (const glyph of ALL_GLYPHS) {
      ctx.fillStyle = glyph.rarity === "rare" ? PALETTE.rareSequence : PALETTE.text;
      ctx.font = FONTS.sequence;
      ctx.fillText(glyph.symbol, x, y);

      ctx.fillStyle = PALETTE.textMuted;
      ctx.font = FONTS.label;
      ctx.fillText(glyph.name, x + 46, y);
      y += 40;
    }
  }

  /**
   * The vertical mana gauge, anchored bottom-right and filling upward.
   *
   * The tick marks what one common gesture costs, so "can I afford the next
   * stroke" is answered by a glance rather than by reading the number.
   *
   * @param {import("../game/game.js").Game} game
   */
  drawManaGauge(game) {
    const { ctx } = this;
    const { thickness, length } = MANA_GAUGE;
    // Right-aligned inside the left sidebar, so the bar runs along the edge of
    // the play area and its labels have the whole strip to their left.
    const x = SIDEBAR.width - PAD - thickness;
    const bottom = this.height - PAD;
    const top = bottom - length;

    ctx.fillStyle = PALETTE.manaTrack;
    ctx.fillRect(x, top, thickness, length);

    const filled = length * game.mana.ratio;
    ctx.fillStyle = game.manaWarningMs > 0 ? PALETTE.manaWarning : PALETTE.manaFill;
    ctx.fillRect(x, bottom - filled, thickness, filled);

    const tickY = bottom - (length * MANA.costCommon) / MANA.max;
    ctx.fillStyle = PALETTE.text;
    ctx.fillRect(x, tickY, thickness, 1);

    this.drawManaLabel(game, x, top, bottom);
  }

  /**
   * @param {import("../game/game.js").Game} game
   * @param {number} gaugeX
   * @param {number} top
   * @param {number} bottom
   */
  drawManaLabel(game, gaugeX, top, bottom) {
    const { ctx } = this;
    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.fillText("MANA", gaugeX - 14, top + 16);

    ctx.fillStyle = game.manaWarningMs > 0 ? PALETTE.manaWarning : PALETTE.text;
    ctx.font = FONTS.subhead;
    ctx.fillText(String(Math.floor(game.mana.value)), gaugeX - 14, bottom - 30);

    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.fillText(`/ ${MANA.max}`, gaugeX - 14, bottom);
  }

  // ------------------------------------------------------------- overlay ---

  /**
   * End-of-game overlay, drawn across the whole canvas: the run is over, so
   * the sidebars have nothing left to say.
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
    ctx.fillText(`Fantômes éliminés : ${game.enemiesDefeated}`, centerX, centerY + 16);

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
