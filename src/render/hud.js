import { ALL_GLYPHS } from "../config/glyphs.js";
import { HEALTH } from "../config/health.js";
import { MANA } from "../config/mana.js";
import { SIDEBAR } from "../config/settings.js";
import { SPELLS, spellColorOf } from "../config/spells.js";
import { END_REASON, GAME_STATUS } from "../game/game.js";
import { drawVerticalGauge } from "./gauges.js";
import { gameOverMenuButton, pauseButton } from "./layout.js";
import { drawButton } from "./menu.js";
import { FONTS, PALETTE } from "./palette.js";

/** @type {Readonly<Record<string, string>>} */
const LOSS_MESSAGES = Object.freeze({
  [END_REASON.boss]: "Le boss a franchi la ligne.",
  [END_REASON.enemy]: "Un ennemi a franchi la ligne.",
});

const PAD = 20;

/**
 * Everything drawn in the two sidebars, plus the end-of-game overlay.
 *
 * The HUD used to be painted over the board and kept disappearing behind
 * falling enemies. It now lives entirely in the strips either side of the
 * field, in canvas coordinates — unlike the renderer, which works translated
 * into field space.
 *
 * What is shown depends on the difficulty: Easy has no mana and no spells, so
 * their readouts would only be clutter. `game.rules` decides, not the HUD.
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
    const { rules } = game;
    if (rules.spells) this.drawSpellSlot(game.heldSpell);
    this.drawScore(game.enemiesDefeated);
    this.drawMeleeCooldown(game.player);
    if (rules.mana) this.drawManaGauge(game);

    drawButton(this.ctx, pauseButton());
    this.drawGlyphLegend(rules);
    if (game.health) this.drawHealthGauge(game.health);
  }

  // ---------------------------------------------------------------- left ---

  /**
   * The single spell slot, top of the left strip. Each spell colours its own
   * border and name, so which one is held reads without being read.
   * @param {string|null} heldSpell
   */
  drawSpellSlot(heldSpell) {
    const { ctx } = this;
    const spell = heldSpell ? SPELLS[heldSpell] : null;
    const width = SIDEBAR.width - 2 * PAD;
    const color = spellColorOf(heldSpell) ?? PALETTE.slotEmpty;

    ctx.strokeStyle = color;
    ctx.lineWidth = spell ? 3 : 2;
    ctx.strokeRect(PAD, PAD, width, 114);

    ctx.textAlign = "left";
    if (!spell) {
      ctx.fillStyle = PALETTE.textMuted;
      ctx.font = FONTS.label;
      ctx.fillText("Aucun sort", PAD + 16, PAD + 64);
      return;
    }
    ctx.fillStyle = color;
    ctx.font = FONTS.hud;
    ctx.fillText(spell.name, PAD + 16, PAD + 42);
    // The two lines below stay muted: colouring everything would flatten the
    // hierarchy and the name is what carries the identification.
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
   * A bar that fills as the auto-attack recharges, so its rhythm is readable
   * rather than felt.
   * @param {import("../entities/player.js").Player} player
   */
  drawMeleeCooldown(player) {
    const { ctx } = this;
    const y = 332;

    ctx.textAlign = "left";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.fillText("MÊLÉE AUTO", PAD, y - 12);

    ctx.fillStyle = PALETTE.cooldownTrack;
    ctx.fillRect(PAD, y, SIDEBAR.width - 2 * PAD, 12);
    ctx.fillStyle = PALETTE.cooldownFill;
    ctx.fillRect(PAD, y, (SIDEBAR.width - 2 * PAD) * (1 - player.meleeChargeRatio), 12);
  }

  /**
   * The mana gauge. The tick marks what one common gesture costs, so "can I
   * afford the next stroke" is answered by a glance.
   * @param {import("../game/game.js").Game} game
   */
  drawManaGauge(game) {
    drawVerticalGauge(this.ctx, {
      side: "left",
      ratio: game.mana.ratio,
      label: "MANA",
      value: game.mana.value,
      max: MANA.max,
      fill: PALETTE.manaFill,
      alert: game.manaWarningMs > 0,
      tickAt: MANA.costCommon,
    });
  }

  // --------------------------------------------------------------- right ---

  /**
   * Which gesture draws which symbol. Easy never spawns rare enemies, so its
   * legend stops at the four common glyphs.
   * @param {import("../config/difficulty.js").DifficultyRules} rules
   */
  drawGlyphLegend(rules) {
    const { ctx } = this;
    const x = this.rightX + PAD;
    const glyphs = rules.rareEnemies
      ? ALL_GLYPHS
      : ALL_GLYPHS.filter((glyph) => glyph.rarity === "common");

    ctx.textAlign = "left";
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.fillText("GESTES", x, 140);

    let y = 186;
    for (const glyph of glyphs) {
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
   * The health bar, Hard only: the mana gauge mirrored into the right sidebar.
   * Nothing damages it yet — the boss attack patterns that would are still to
   * be designed.
   * @param {import("../game/gauge.js").Gauge} health
   */
  drawHealthGauge(health) {
    drawVerticalGauge(this.ctx, {
      side: "right",
      ratio: health.ratio,
      label: "VIE",
      value: health.value,
      max: HEALTH.max,
      fill: PALETTE.healthFill,
    });
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
    drawButton(ctx, gameOverMenuButton());
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
