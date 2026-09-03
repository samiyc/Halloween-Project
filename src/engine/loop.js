/**
 * requestAnimationFrame driver.
 *
 * Its only job is to hand a frame delta to a callback and to be stoppable. The
 * old loop re-entered itself with `requestAnimationFrame(gameLoop)` and simply
 * returned when the game ended, so there was no way to restart without
 * reloading the page.
 */
export class GameLoop {
  /**
   * @param {(deltaMs: number) => void} onFrame
   * @param {{requestAnimationFrame: Function, cancelAnimationFrame: Function}} [scheduler]
   */
  constructor(onFrame, scheduler = globalThis) {
    this.onFrame = onFrame;
    this.scheduler = scheduler;
    this.handle = null;
    this.lastTimestamp = null;
  }

  get isRunning() {
    return this.handle !== null;
  }

  start() {
    if (this.isRunning) return;
    this.lastTimestamp = null;
    this.schedule();
  }

  stop() {
    if (!this.isRunning) return;
    this.scheduler.cancelAnimationFrame(this.handle);
    this.handle = null;
    this.lastTimestamp = null;
  }

  schedule() {
    this.handle = this.scheduler.requestAnimationFrame((timestamp) => {
      const previous = this.lastTimestamp ?? timestamp;
      this.lastTimestamp = timestamp;
      this.schedule();
      this.onFrame(timestamp - previous);
    });
  }
}
