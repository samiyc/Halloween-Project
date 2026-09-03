/**
 * Mouse stroke capture.
 *
 * `toCanvasPoint()` is the important part. The original implementation
 * subtracted the bounding rect origin and stopped there, which is only correct
 * while the canvas is displayed at exactly its attribute size. The canvas is
 * now scaled by CSS to fill the viewport, so every coordinate has to be
 * multiplied back into the internal canvas resolution — otherwise gestures
 * land somewhere other than where they were drawn.
 *
 * @typedef {{x: number, y: number}} Point
 */

export class PointerTracker {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} handlers
   * @param {(path: Point[]) => void} handlers.onStrokeComplete
   * @param {() => boolean} [handlers.isEnabled]
   */
  constructor(canvas, { onStrokeComplete, isEnabled = () => true }) {
    this.canvas = canvas;
    this.onStrokeComplete = onStrokeComplete;
    this.isEnabled = isEnabled;
    /** @type {Point[]} */
    this.path = [];
    this.isDrawing = false;
    /** @type {Array<() => void>} */
    this.teardown = [];
  }

  /** @returns {this} */
  attach() {
    const onDown = (event) => this.begin(event);
    const onMove = (event) => this.extend(event);
    // Bound on the window rather than the canvas: releasing the button outside
    // the canvas then still finishes the stroke instead of leaving it stuck.
    const onUp = () => this.finish();

    this.canvas.addEventListener("mousedown", onDown);
    this.canvas.addEventListener("mousemove", onMove);
    globalThis.addEventListener("mouseup", onUp);
    this.teardown.push(() => {
      this.canvas.removeEventListener("mousedown", onDown);
      this.canvas.removeEventListener("mousemove", onMove);
      globalThis.removeEventListener("mouseup", onUp);
    });
    return this;
  }

  detach() {
    for (const undo of this.teardown) undo();
    this.teardown = [];
  }

  /** @param {MouseEvent} event */
  begin(event) {
    if (!this.isEnabled()) return;
    this.isDrawing = true;
    this.path = [this.toCanvasPoint(event)];
  }

  /** @param {MouseEvent} event */
  extend(event) {
    if (!this.isDrawing) return;
    this.path.push(this.toCanvasPoint(event));
  }

  finish() {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    const path = this.path;
    this.path = [];
    if (path.length > 1) this.onStrokeComplete(path);
  }

  /** The in-progress stroke, for the renderer to draw as live feedback. */
  currentPath() {
    return this.isDrawing ? this.path : [];
  }

  /**
   * @param {MouseEvent} event
   * @returns {Point}
   */
  toCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width === 0 ? 1 : this.canvas.width / rect.width;
    const scaleY = rect.height === 0 ? 1 : this.canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }
}
