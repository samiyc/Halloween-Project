import { FIELD } from "../config/settings.js";
import { BUFF_HALOS } from "../config/spells.js";
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
   * The two sidebars and the board they frame.
   *
   * The field is painted explicitly rather than left to the CSS background, so
   * the sidebars can sit a shade darker — the eye then reads the lighter
   * rectangle as the subject and the strips as chrome.
   */
  drawBackground() {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.sidebar;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = PALETTE.field;
    ctx.fillRect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);

    ctx.fillStyle = PALETTE.sidebarEdge;
    ctx.fillRect(FIELD.x - 1, 0, 1, this.height);
    ctx.fillRect(FIELD.x + FIELD.width, 0, 1, this.height);
  }

  /**
   * Runs a drawing callback in field coordinates: translated past the left
   * sidebar, and clipped to the board.
   *
   * Game logic works in 0..FIELD.width and knows nothing about the sidebars, so
   * this is the single place that offset is applied. The clip is not
   * decoration: an enemy at x = 0 draws its sequence above and slightly left of
   * itself, which would otherwise spill onto the strip.
   *
   * @param {() => void} draw
   */
  inField(draw) {
    const { ctx } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(FIELD.x, FIELD.y, FIELD.width, FIELD.height);
    ctx.clip();
    ctx.translate(FIELD.x, FIELD.y);
    draw();
    ctx.restore();
  }

  /**
   * A square plus the glyph sequence floating above it.
   * @param {{x: number, y: number, size: number, sequence: string, color: string, variant?: string}} entity
   */
  drawEntity(entity) {
    const { ctx } = this;
    ctx.fillStyle = entity.displayColor ?? entity.color;
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
   * The area a held spell would cover, previewed around the player.
   *
   * Dashed, so it never reads as the solid melee circle or as a buff halo. It
   * is drawn only while the spell is in the slot: casting empties the slot, so
   * the preview clears itself.
   *
   * The dash pattern has to be reset — `setLineDash` is context state, and it
   * would otherwise leak into the melee circle and the gesture trail drawn
   * moments later in the same frame.
   *
   * @param {import("../entities/player.js").Player} player
   * @param {number} radius
   */
  drawSpellRange(player, radius) {
    const { ctx } = this;
    ctx.save();
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.arc(player.centerX, player.centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = PALETTE.spellRange;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * A falling pickup: blue mana orb or yellow spell orb.
   * @param {import("../entities/pickup.js").Pickup} pickup
   */
  drawPickup(pickup) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
    ctx.fillStyle = pickup.color;
    ctx.fill();
  }

  /**
   * One ring per active buff, drawn outside the melee circle.
   *
   * Buffs are rings rather than a fill colour because the player is already
   * green: a "green speed buff" would be invisible. Rings also stack, which a
   * single fill cannot do.
   *
   * @param {import("../entities/player.js").Player} player
   */
  drawBuffHalos(player) {
    const { ctx } = this;
    let radius = player.meleeRange + 6;

    for (const id of player.effects.activeIds()) {
      const color = BUFF_HALOS[id];
      if (!color) continue;
      ctx.beginPath();
      ctx.arc(player.centerX, player.centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.stroke();
      radius += 6;
    }
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
   * Outlines everything the melee just hit. The swing is an area attack, so
   * this is how a player sees that walking into a group paid off.
   * @param {readonly {x: number, y: number, size: number}[]} targets
   */
  drawMeleeFlash(targets) {
    const { ctx } = this;
    ctx.strokeStyle = PALETTE.meleeFlash;
    ctx.lineWidth = 3;
    for (const target of targets) {
      ctx.strokeRect(target.x - 3, target.y - 3, target.size + 6, target.size + 6);
    }
  }
}
