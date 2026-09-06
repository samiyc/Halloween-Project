import { CANVAS, FIELD } from "./config/settings.js";
import { spellRangeOf } from "./config/spells.js";
import { recognizeStroke } from "./engine/gesture/recognizer.js";
import { Keyboard } from "./engine/keyboard.js";
import { GameLoop } from "./engine/loop.js";
import { PointerTracker } from "./engine/pointer.js";
import { Session } from "./game/session.js";
import { Hud } from "./render/hud.js";
import { buttonAt, gameOverMenuButton, menuButtons, pauseButton } from "./render/layout.js";
import { drawMenu } from "./render/menu.js";
import { Renderer } from "./render/renderer.js";
import { drawBeam, drawBeamCharge, drawProjectiles, drawTurret } from "./render/turret.js";

/**
 * How long the game-over screen stays up before a press can dismiss it.
 *
 * This used to be 1000ms and the listener was on `click`, which made losing
 * almost invisible during normal play: a gesture is a mousedown-drag-mouseup on
 * the canvas, and the browser fires a `click` for exactly that. So the screen
 * appeared, armed one second later, and the player's very next stroke restarted
 * the run — which reads as "the game reset itself for no reason".
 */
const RESTART_DELAY_MS = 2500;

/**
 * Wiring only: this is the one module allowed to know about both the DOM and
 * the game. Everything it composes is independently testable — the navigation
 * lives in `Session`, the button geometry in `render/layout.js`.
 */
class App {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    canvas.width = CANVAS.width;
    canvas.height = CANVAS.height;

    const ctx = canvas.getContext("2d");
    this.canvas = canvas;
    // The board, not the canvas: the sidebars are chrome, and passing the full
    // canvas here would let enemies spawn and fall underneath them.
    this.session = new Session({ bounds: { width: FIELD.width, height: FIELD.height } });
    this.renderer = new Renderer(ctx);
    this.hud = new Hud(ctx);
    this.keyboard = new Keyboard().attach(globalThis);
    this.pointer = new PointerTracker(canvas, {
      onStrokeComplete: (path) => this.handleStroke(path),
      isEnabled: (point) => this.acceptsGestureAt(point),
    }).attach();
    this.loop = new GameLoop((deltaMs) => this.frame(deltaMs));
    this.gameOverElapsedMs = 0;
    this.bindPointer();
  }

  get game() {
    return this.session.game;
  }

  /** True once the game-over screen has been up long enough to dismiss. */
  get canRestart() {
    return this.gameOverElapsedMs >= RESTART_DELAY_MS;
  }

  bindPointer() {
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("mousedown", (event) => this.handlePress(event));
  }

  start() {
    this.loop.start();
  }

  /** @param {number} deltaMs */
  frame(deltaMs) {
    // Drained every frame, whichever screen is up, so the queue cannot grow
    // unbounded while the menu is open.
    const presses = this.keyboard.takePresses();
    this.session.tick(deltaMs);
    if (presses.includes("Escape")) this.session.toggleMenu();

    if (this.session.isPlaying && this.game) {
      if (presses.includes("KeyE")) this.game.castSpell();
      // Pausing is simply not calling this: the run freezes where it stands.
      if (this.game.isRunning) this.game.update(deltaMs, this.keyboard.moveDirection());
      else this.gameOverElapsedMs += deltaMs;
    }
    this.render();
  }

  // ----------------------------------------------------------------- input --

  /**
   * Gestures are only drawn on the board, and never by a press that is really
   * aiming at a button — both listeners see the same mousedown.
   * @param {{x: number, y: number}} point  Canvas coordinates.
   * @returns {boolean}
   */
  acceptsGestureAt(point) {
    if (!this.session.isPlaying || !this.game?.isRunning) return false;
    return !buttonAt([pauseButton()], point);
  }

  /** @param {MouseEvent} event */
  handlePress(event) {
    const point = this.pointer.toCanvasPoint(event);
    if (event.button === 2) {
      this.game?.castSpell();
      return;
    }
    if (event.button !== 0) return;

    if (this.session.isPlaying) this.pressWhilePlaying(point);
    else this.pressInMenu(point);
  }

  /** @param {{x: number, y: number}} point */
  pressInMenu(point) {
    const button = buttonAt(menuButtons(this.session), point);
    if (!button) return;
    if (button.id === "resume") this.session.resume();
    else this.session.start(button.id);
  }

  /** @param {{x: number, y: number}} point */
  pressWhilePlaying(point) {
    if (buttonAt([pauseButton()], point)) {
      this.session.openMenu();
      return;
    }
    if (this.game?.isRunning || !this.canRestart) return;

    // The Menu button has to win over click-anywhere-to-restart, or pressing it
    // would relaunch a run instead of opening the menu.
    if (buttonAt([gameOverMenuButton()], point)) this.session.openMenu();
    else this.restart();
  }

  /** @param {readonly {x: number, y: number}[]} path */
  handleStroke(path) {
    this.game?.castGesture(recognizeStroke(path));
  }

  restart() {
    this.session.start(this.session.difficulty);
    this.gameOverElapsedMs = 0;
  }

  // ---------------------------------------------------------------- render --

  render() {
    const { renderer } = this;
    renderer.clear();

    if (!this.session.isPlaying || !this.game) {
      drawMenu(renderer.ctx, this.session);
      return;
    }

    renderer.drawBackground();
    // Everything that lives in field coordinates goes inside, so the offset is
    // applied once and nothing can spill onto the sidebars.
    renderer.inField(() => this.drawBoard());
    this.hud.draw(this.game);

    if (!this.game.isRunning) this.hud.drawGameOver(this.game, this.canRestart);
  }

  /** Drawn in field coordinates — see `Renderer.inField()`. */
  drawBoard() {
    const { game, renderer } = this;
    renderer.drawBoss(game.boss);
    if (game.turret) drawTurret(renderer.ctx, game.turretMount, game.turret);
    for (const enemy of game.enemies) {
      renderer.drawEntity(enemy);
    }
    for (const pickup of game.pickups) {
      renderer.drawPickup(pickup);
    }
    drawProjectiles(renderer.ctx, game.projectiles);
    // Only spells that cover an area have a range to preview, and only while
    // one is actually held — casting empties the slot and the circle goes.
    const spellRange = spellRangeOf(game.heldSpell);
    if (spellRange !== null) renderer.drawSpellRange(game.player, spellRange);

    this.drawTurretBeam();
    renderer.drawMeleeFlash(game.lastMeleeTargets);
    renderer.drawBuffHalos(game.player);
    renderer.drawPlayer(game.player, game.lastMeleeTargets.length > 0);
    renderer.drawStroke(this.pointer.currentPath());
  }

  /**
   * The laser and the dashed tell that precedes it.
   *
   * Drawn under the player on purpose: a beam painted over it would hide the
   * one square the player is watching, exactly while it is being burned.
   */
  drawTurretBeam() {
    const { game, renderer } = this;
    const turret = game.turret;
    if (!turret) return;

    if (turret.beam) {
      drawBeam(renderer.ctx, turret.beam);
    } else if (turret.isCharging) {
      const muzzle = turret.muzzle(game.turretMount);
      drawBeamCharge(renderer.ctx, { ...muzzle, angle: turret.angle });
    }
  }
}

const canvas = document.getElementById("gameCanvas");
if (canvas instanceof HTMLCanvasElement) {
  const app = new App(canvas);
  app.start();

  // Opt-in inspection hook: load halloween.html?debug and the live session is
  // reachable from DevTools as `__magicSpell.session`. Off by default.
  if (new URLSearchParams(globalThis.location?.search).has("debug")) {
    globalThis.__magicSpell = app;
  }
} else {
  console.error('No <canvas id="gameCanvas"> found; the game cannot start.');
}
