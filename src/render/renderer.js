import { FONTS, PALETTE } from "./palette.js";

/**
 * Everything that touches the 2D context lives here.
 *
 * Entities used to draw themselves, which is why they each needed a `canvas`
 * and a `ctx` and could not be tested outside a browser. Moving the drawing
 * out is what made `src/entities/` and `src/game/` testable under plain Node.
 */
export class Renderer {
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

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * A square plus the glyph sequence floating above it.
   * @param {{x: number, y: number, size: number, sequence: string, color: string, variant?: string}} entity
   */
  drawEntity(entity) {
    const { ctx } = this;
    ctx.fillStyle = entity.color;
    ctx.fillRect(entity.x, entity.y, entity.size, entity.size);

    const isRare = entity.variant === "rare";
    ctx.fillStyle = isRare ? PALETTE.rareSequence : PALETTE.text;
    ctx.font = isRare ? FONTS.rareSequence : FONTS.sequence;
    ctx.textAlign = "center";
    // Clamped into the canvas: an entity at y = 0 would otherwise have its
    // sequence drawn above the top edge, leaving the player nothing to read at
    // exactly the moment the thing spawns.
    const labelY = Math.max(entity.y - 10, 16);
    ctx.fillText(entity.sequence, entity.x + entity.size / 2, labelY);
  }

  /**
   * @param {import("../entities/boss.js").Boss} boss
   */
  drawBoss(boss) {
    this.drawEntity(boss);
    const { ctx } = this;
    ctx.fillStyle = PALETTE.textMuted;
    ctx.font = FONTS.label;
    ctx.textAlign = "center";

    const lives = `${boss.lives} ${boss.lives === 1 ? "vie" : "vies"}`;
    const state = boss.isInvincible ? " — invincible" : "";
    ctx.fillText(
      `Angry boss — ${lives}${state}`,
      boss.x + boss.size / 2,
      boss.y + boss.size + 15,
    );
  }

  /**
   * The player, with its melee reach drawn as a ring so the range is legible
   * instead of guessed at.
   * @param {import("../entities/player.js").Player} player
   * @param {boolean} didStrike
   */
  drawPlayer(player, didStrike) {
    const { ctx } = this;

    ctx.beginPath();
    ctx.arc(player.centerX, player.centerY, player.meleeRange, 0, Math.PI * 2);
    ctx.strokeStyle = didStrike ? PALETTE.meleeFlash : PALETTE.meleeRange;
    ctx.lineWidth = didStrike ? 3 : 1.5;
    ctx.stroke();

    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.size, player.size);
  }

  /**
   * Live feedback for the gesture being drawn.
   *
   * This replaces the `drawPath()` call that `game.js` made on every
   * `mousemove` without ever defining it — a ReferenceError per mouse move,
   * which is why strokes were invisible while playing.
   *
   * @param {readonly {x: number, y: number}[]} path
   */
  drawStroke(path) {
    if (path.length < 2) return;
    const { ctx } = this;

    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (const point of path.slice(1)) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = PALETTE.strokeGlow;
    ctx.lineWidth = 9;
    ctx.stroke();

    ctx.strokeStyle = PALETTE.stroke;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  /**
   * Highlights whatever the melee just hit.
   * @param {{x: number, y: number, size: number}|null} target
   */
  drawMeleeFlash(target) {
    if (!target) return;
    const { ctx } = this;
    ctx.strokeStyle = PALETTE.meleeFlash;
    ctx.lineWidth = 2;
    ctx.strokeRect(target.x - 2, target.y - 2, target.size + 4, target.size + 4);
  }
}
