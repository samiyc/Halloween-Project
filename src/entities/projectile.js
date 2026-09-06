import { toFrames } from "../config/settings.js";
import { PROJECTILE } from "../config/turret.js";

/**
 * A turret shot: a small circle travelling in a straight line.
 *
 * Shaped like `Pickup` on purpose — same `x`/`y` centre, same `radius`, same
 * `centerX`/`centerY` getters — so the collision helpers and the drawing code
 * treat the two the same way. The difference is the direction: an orb only
 * falls, a projectile goes wherever it was fired, so it can leave the board by
 * any of the four edges.
 */
export class Projectile {
  /**
   * @param {object} options
   * @param {number} options.x      Centre, not a corner.
   * @param {number} options.y
   * @param {number} options.angle  Radians; 0 points right.
   * @param {typeof PROJECTILE} [options.traits]
   */
  constructor({ x, y, angle, traits = PROJECTILE }) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.radius = traits.radius;
    this.damage = traits.damage;
    this.color = traits.color;
    /** Optional bright rim; only the heavy shot carries one. */
    this.ring = traits.ring;
    this.velocityX = Math.cos(angle) * traits.speed;
    this.velocityY = Math.sin(angle) * traits.speed;
  }

  get centerX() {
    return this.x;
  }

  get centerY() {
    return this.y;
  }

  /** @param {number} deltaMs */
  update(deltaMs) {
    const frames = toFrames(deltaMs);
    this.x += this.velocityX * frames;
    this.y += this.velocityY * frames;
  }

  /**
   * Off the board on **any** side.
   *
   * `Pickup.hasEscaped()` only watches the bottom edge because an orb only ever
   * falls. A shot aimed sideways or upward would live in the array forever if
   * this checked the same single edge.
   *
   * @param {{width: number, height: number}} bounds
   * @returns {boolean}
   */
  hasEscaped(bounds) {
    return (
      this.x + this.radius < 0 ||
      this.y + this.radius < 0 ||
      this.x - this.radius > bounds.width ||
      this.y - this.radius > bounds.height
    );
  }
}
