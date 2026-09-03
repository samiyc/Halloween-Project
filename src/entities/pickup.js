import { toFrames } from "../config/settings.js";

/**
 * A falling collectable: a blue mana orb or a yellow spell orb.
 *
 * Round rather than square, so it never reads as an enemy at a glance. Like
 * every entity it holds no drawing code — `Renderer.drawPickup()` does that.
 */
export class Pickup {
  /**
   * @param {object} options
   * @param {import("../config/pickups.js").PickupKind} options.kind
   * @param {number} options.x  Centre, not a corner: these are circles.
   * @param {number} options.y
   * @param {{radius: number, color: string, speed: number}} options.traits
   */
  constructor({ kind, x, y, traits }) {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.radius = traits.radius;
    this.color = traits.color;
    this.speed = traits.speed;
  }

  get centerX() {
    return this.x;
  }

  get centerY() {
    return this.y;
  }

  /** @param {number} deltaMs */
  update(deltaMs) {
    this.y += this.speed * toFrames(deltaMs);
  }

  /**
   * A missed orb is simply gone — there is no penalty for letting one fall
   * past, only the opportunity cost.
   * @param {number} fieldHeight
   * @returns {boolean}
   */
  hasEscaped(fieldHeight) {
    return this.y - this.radius > fieldHeight;
  }
}
