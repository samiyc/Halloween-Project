import { FIELD } from "../config/settings.js";
import { LASER, TURRET } from "../config/turret.js";
import { withAlpha } from "../tools/color.js";

/**
 * The boss turret, its shots and its beam.
 *
 * All three draw in **field** coordinates, so every function here belongs
 * inside `Renderer.inField()` — the clip is also what keeps a beam aimed at the
 * corner of the board from painting across a sidebar.
 *
 * Kept out of `renderer.js`, which is already close to the 220-line budget.
 */

/** Dark enough to read as a thing mounted on the boss, not part of it. */
const TURRET_COLOR = "#8C1D0E";
/**
 * Greyed while the boss is invincible, matching `BOSS.invincibleColor` a shade
 * darker. The frozen barrel already says the turret is down; the colour is what
 * says it at a glance, without watching it for a second first.
 */
const TURRET_DISARMED = "#6E6E6E";
const TURRET_EDGE = "rgba(0, 0, 0, 0.45)";

/** Long enough to leave the board from any angle; the clip does the rest. */
const BEAM_REACH = Math.hypot(FIELD.width, FIELD.height);

/**
 * The dome and its barrel.
 *
 * The barrel is drawn from the origin **outward**, after rotating about the
 * boss centre, which is what keeps its pivot exactly on that centre however far
 * round it has turned. The dome goes on last, so the barrel appears to come out
 * from under it.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number, size: number}} mount  Boss centre and side.
 * @param {{angle: number, isDisarmed: boolean}} turret
 */
export function drawTurret(ctx, mount, turret) {
  const { size } = mount;
  const barrelWidth = size * TURRET.cannonWidthRatio;
  const color = turret.isDisarmed ? TURRET_DISARMED : TURRET_COLOR;

  ctx.save();
  ctx.translate(mount.x, mount.y);
  ctx.rotate(turret.angle);
  ctx.fillStyle = color;
  ctx.fillRect(0, -barrelWidth / 2, size * TURRET.cannonRatio, barrelWidth);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(mount.x, mount.y, size * TURRET.circleRatio, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = TURRET_EDGE;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Every shot in flight.
 *
 * A shot whose traits carry a `ring` gets a bright rim — the heavy one, where
 * size alone reads as "near" rather than as "this takes a third of your bar".
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {readonly {x: number, y: number, radius: number, color: string, ring?: string}[]} projectiles
 */
export function drawProjectiles(ctx, projectiles) {
  for (const shot of projectiles) {
    ctx.beginPath();
    ctx.arc(shot.x, shot.y, shot.radius, 0, Math.PI * 2);
    ctx.fillStyle = shot.color;
    ctx.fill();

    if (!shot.ring) continue;
    ctx.strokeStyle = shot.ring;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

/**
 * The tell that precedes the beam: a thin dashed line along the barrel.
 *
 * Wrapped in save/restore for the dash alone — an unrestored `setLineDash`
 * leaks into the melee circle and the gesture trail drawn later in the frame.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number, angle: number}} ray  From the muzzle.
 */
export function drawBeamCharge(ctx, ray) {
  ctx.save();
  ctx.setLineDash([18, 14]);
  strokeRay(ctx, ray, { color: withAlpha(LASER.color, 0.75), width: 3 });
  ctx.restore();
}

/**
 * The beam itself: a wide translucent body under a narrow bright core, the
 * same two-pass idiom as the gesture trail.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number, angle: number, width: number}} beam
 */
export function drawBeam(ctx, beam) {
  strokeRay(ctx, beam, { color: withAlpha(LASER.color, 0.4), width: beam.width });
  strokeRay(ctx, beam, { color: LASER.color, width: Math.max(2, beam.width / 4) });
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number, angle: number}} ray
 * @param {{color: string, width: number}} style
 */
function strokeRay(ctx, ray, style) {
  ctx.beginPath();
  ctx.moveTo(ray.x, ray.y);
  ctx.lineTo(ray.x + Math.cos(ray.angle) * BEAM_REACH, ray.y + Math.sin(ray.angle) * BEAM_REACH);
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.width;
  ctx.lineCap = "butt";
  ctx.stroke();
}
