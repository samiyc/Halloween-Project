import { CANVAS, FIELD } from "./config/settings.js";
import { spellRangeOf } from "./config/spells.js";
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
    // The board, not the canvas: the sidebars are chrome, and passing the full
    // canvas here would let enemies spawn and fall underneath them.
    this.game = new Game({ bounds: { width: FIELD.width, height: FIELD.height } });
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
    this.bindSpellCasting();
  }

  /**
   * The held spell fires on E or on a right click.
   *
   * The context menu has to be suppressed or the right click opens it instead,
   * and PointerTracker ignores non-left buttons so the same click cannot also
   * start a gesture.
   */
  bindSpellCasting() {
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    this.canvas.addEventListener("mousedown", (event) => {
      if (event.button === 2) this.game.castSpell();
    });
  }

  start() {
    this.loop.start();
  }

  /** @param {number} deltaMs */
  frame(deltaMs) {
    // Drained every frame, running or not, so the queue cannot grow unbounded
    // while the game-over screen is up.
    const presses = this.keyboard.takePresses();

    if (this.game.isRunning) {
      if (presses.includes("KeyE")) this.game.castSpell();
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
    renderer.drawBackground();
    // Everything that lives in field coordinates goes inside, so the offset is
    // applied once and nothing can spill onto the sidebars.
    renderer.inField(() => this.drawBoard());
    this.hud.draw(game);

    if (!game.isRunning) {
      this.hud.drawGameOver(game, this.gameOverElapsedMs >= RESTART_DELAY_MS);
    }
  }

  /** Drawn in field coordinates — see `Renderer.inField()`. */
  drawBoard() {
    const { game, renderer } = this;
    renderer.drawBoss(game.boss);
    for (const enemy of game.enemies) {
      renderer.drawEntity(enemy);
    }
    for (const pickup of game.pickups) {
      renderer.drawPickup(pickup);
    }
    // Only spells that cover an area have a range to preview, and only while
    // one is actually held — casting empties the slot and the circle goes.
    const spellRange = spellRangeOf(game.heldSpell);
    if (spellRange !== null) renderer.drawSpellRange(game.player, spellRange);

    renderer.drawMeleeFlash(game.lastMeleeTargets);
    renderer.drawBuffHalos(game.player);
    renderer.drawPlayer(game.player, game.lastMeleeTargets.length > 0);
    renderer.drawStroke(this.pointer.currentPath());
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
    // Left button only: a right click is a spell cast, not a restart.
    const onPress = (event) => {
      if (event.button !== 0) return;
      this.canvas.removeEventListener("mousedown", onPress);
      this.restart();
    };
    this.canvas.addEventListener("mousedown", onPress);
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
