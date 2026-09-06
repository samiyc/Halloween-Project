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

import { FIELD } from "../config/settings.js";

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
    // Left button only. The right button casts the held spell, and without
    // this filter it would also start a stroke that the following mouseup
    // would then charge mana for.
    if (event.button !== 0) return;
    // Asked in canvas coordinates, because that is where the HUD buttons live:
    // a press aiming at one must not also start a gesture.
    if (!this.isEnabled(this.toCanvasPoint(event))) return;
    this.isDrawing = true;
    this.path = [this.toFieldPoint(event)];
  }

  /** @param {MouseEvent} event */
  extend(event) {
    if (!this.isDrawing) return;
    this.path.push(this.toFieldPoint(event));
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
   * Canvas coordinates: the CSS scale undone, nothing else.
   *
   * This is the space the sidebars and every HUD button live in.
   *
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

  /**
   * Field coordinates: canvas coordinates minus the left sidebar.
   *
   * This is the space entities live in, so it is what a stroke is recorded in.
   * The two used to be one function, which was fine while nothing but gestures
   * read the mouse — the HUD buttons made the conflation untenable.
   *
   * Recognition is translation-invariant, so mixing the two up would not break
   * gestures: the only symptom is a trail drawn 300px from the cursor.
   *
   * @param {MouseEvent} event
   * @returns {Point}
   */
  toFieldPoint(event) {
    const point = this.toCanvasPoint(event);
    return { x: point.x - FIELD.x, y: point.y - FIELD.y };
  }
}
