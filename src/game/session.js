import { DEFAULT_DIFFICULTY, rulesOf } from "../config/difficulty.js";
import { clampDelta } from "../config/settings.js";
import { systemRandom } from "../tools/random.js";
import { Game } from "./game.js";

export const SCREEN = Object.freeze({
  menu: "menu",
  playing: "playing",
});

/**
 * How long Escape is ignored after it has just been used.
 *
 * Without it a held key would flip between menu and board every frame. Short
 * enough that a deliberate second press still lands.
 */
export const MENU_TOGGLE_COOLDOWN_MS = 300;

/**
 * What the application is doing: sitting in the menu, or playing a run.
 *
 * Pure state, no canvas and no listeners — same rule as `Game`, so the whole
 * navigation can be exercised in a unit test. `src/main.js` only routes input
 * into it and asks it what to draw.
 *
 * Pausing is the absence of an update rather than a flag inside `Game`: while
 * the menu is up, `main.js` simply stops calling `game.update()`. The run is
 * frozen, not destroyed.
 */
export class Session {
  /**
   * @param {object} [options]
   * @param {{width: number, height: number}} [options.bounds]
   * @param {import("../tools/random.js").Rng} [options.rng]
   */
  constructor({ bounds = undefined, rng = systemRandom } = {}) {
    this.bounds = bounds;
    this.rng = rng;
    this.screen = SCREEN.menu;
    /** @type {Game|null} */
    this.game = null;
    /** @type {import("../config/difficulty.js").DifficultyId} */
    this.difficulty = DEFAULT_DIFFICULTY;
    this.toggleCooldownMs = 0;
  }

  /** The rules of the run in progress, or of the mode about to be started. */
  get rules() {
    return this.game?.rules ?? rulesOf(this.difficulty);
  }

  /**
   * Whether "Retour au jeu" does anything. A finished run cannot be resumed —
   * there is nothing left to go back to.
   */
  get canResume() {
    return this.game !== null && this.game.isRunning;
  }

  get isPlaying() {
    return this.screen === SCREEN.playing;
  }

  /**
   * Starts a fresh run. Picking a difficulty always restarts, even the one
   * already being played; resuming is what the other button is for.
   * @param {import("../config/difficulty.js").DifficultyId} difficulty
   */
  start(difficulty) {
    this.difficulty = rulesOf(difficulty).id;
    this.game = new Game({ bounds: this.bounds, rng: this.rng, difficulty: this.difficulty });
    this.screen = SCREEN.playing;
    this.toggleCooldownMs = MENU_TOGGLE_COOLDOWN_MS;
  }

  /** Freezes the run and shows the menu. */
  openMenu() {
    this.screen = SCREEN.menu;
    this.toggleCooldownMs = MENU_TOGGLE_COOLDOWN_MS;
  }

  /**
   * Unfreezes the run.
   * @returns {boolean} whether there was anything to go back to
   */
  resume() {
    if (!this.canResume) return false;
    this.screen = SCREEN.playing;
    this.toggleCooldownMs = MENU_TOGGLE_COOLDOWN_MS;
    return true;
  }

  /**
   * What Escape does: out of the board into the menu, or back again.
   * @returns {boolean} whether the screen actually changed
   */
  toggleMenu() {
    if (this.toggleCooldownMs > 0) return false;
    if (this.isPlaying) {
      this.openMenu();
      return true;
    }
    return this.resume();
  }

  /**
   * Advances the cooldown. Called every frame whichever screen is up, so the
   * menu stays responsive; clamped like every other delta consumer.
   *
   * The remainder is snapped to zero below a millisecond. Subtracting frame
   * deltas never lands exactly on zero — 18 subtractions of 1000/60 from 300
   * leave 7.1e-15, which is enough to keep `> 0` true and swallow one more
   * Escape. Sub-millisecond is done, whatever the arithmetic says.
   *
   * @param {number} deltaMs
   */
  tick(deltaMs) {
    const remaining = this.toggleCooldownMs - clampDelta(deltaMs);
    this.toggleCooldownMs = remaining < 1 ? 0 : remaining;
  }
}
