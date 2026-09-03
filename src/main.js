import { CANVAS } from "./config/settings.js";
import { recognizeStroke } from "./engine/gesture/recognizer.js";
import { Keyboard } from "./engine/keyboard.js";
import { GameLoop } from "./engine/loop.js";
import { PointerTracker } from "./engine/pointer.js";
import { Game } from "./game/game.js";
import { Hud } from "./render/hud.js";
import { Renderer } from "./render/renderer.js";

/**
 * How long the game-over screen stays up before a press can dismiss it.
 *
 * This used to be 1000ms and the listener was on `click`, which made losing
 * almost invisible during normal play: a gesture is a mousedown-drag-mouseup on
 * the canvas, and the browser fires a `click` for exactly that. So the screen
 * appeared, armed one second later, and the player's very next stroke restarted
 * the run — which reads as "the game reset itself for no reason".
 *
 * Two changes fix it: a longer pause, and arming `mousedown` instead of
 * `click`. A `click` can be produced by the mouseup of a stroke that started
 * while the game was still running; a mousedown during the game-over screen is
 * always a fresh, deliberate press.
 */
const RESTART_DELAY_MS = 2500;

/**
 * Wiring only: this is the one module allowed to know about both the DOM and
 * the game. Everything it composes is independently testable.
 */
class App {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    canvas.width = CANVAS.width;
    canvas.height = CANVAS.height;

    const ctx = canvas.getContext("2d");
    this.canvas = canvas;
    this.game = new Game({ bounds: { width: canvas.width, height: canvas.height } });
    this.renderer = new Renderer(ctx);
    this.hud = new Hud(ctx);
    this.keyboard = new Keyboard().attach(globalThis);
    this.pointer = new PointerTracker(canvas, {
      onStrokeComplete: (path) => this.handleStroke(path),
      isEnabled: () => this.game.isRunning,
    }).attach();
    this.loop = new GameLoop((deltaMs) => this.frame(deltaMs));
    this.gameOverElapsedMs = 0;
    this.restartArmed = false;
  }

  start() {
    this.loop.start();
  }

  /** @param {number} deltaMs */
  frame(deltaMs) {
    if (this.game.isRunning) {
      this.game.update(deltaMs, this.keyboard.moveDirection());
    } else {
      this.gameOverElapsedMs += deltaMs;
    }
    this.render();
    this.armRestartWhenReady();
  }

  render() {
    const { game, renderer } = this;
    renderer.clear();
    renderer.drawBoss(game.boss);
    for (const enemy of game.enemies) {
      renderer.drawEntity(enemy);
    }
    renderer.drawMeleeFlash(game.lastMeleeTarget);
    renderer.drawPlayer(game.player, game.lastMeleeTarget !== null);
    renderer.drawStroke(this.pointer.currentPath());
    this.hud.draw(game);

    if (!game.isRunning) {
      this.hud.drawGameOver(game, this.gameOverElapsedMs >= RESTART_DELAY_MS);
    }
  }

  /**
   * @param {readonly {x: number, y: number}[]} path
   */
  handleStroke(path) {
    this.game.castGesture(recognizeStroke(path));
  }

  armRestartWhenReady() {
    if (this.game.isRunning || this.restartArmed) return;
    if (this.gameOverElapsedMs < RESTART_DELAY_MS) return;

    this.restartArmed = true;
    this.canvas.addEventListener("mousedown", () => this.restart(), { once: true });
  }

  /**
   * Restarts in place. The old implementation called `location.reload()`,
   * which is why no state-reset path existed; `Game.reset()` is now the only
   * thing needed.
   */
  restart() {
    this.game.reset();
    this.gameOverElapsedMs = 0;
    this.restartArmed = false;
  }
}

const canvas = document.getElementById("gameCanvas");
if (canvas instanceof HTMLCanvasElement) {
  const app = new App(canvas);
  app.start();

  // Opt-in inspection hook: load halloween.html?debug and the live game is
  // reachable from DevTools as `__magicSpell.game` — enemies, boss phase,
  // score and player state. Off by default so the page exposes nothing.
  if (new URLSearchParams(globalThis.location?.search).has("debug")) {
    globalThis.__magicSpell = app;
  }
} else {
  console.error('No <canvas id="gameCanvas"> found; the game cannot start.');
}
