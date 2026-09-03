/**
 * Keyboard state tracker.
 *
 * Movement is bound by BOTH `event.code` (physical key position) and
 * `event.key` (the printed letter). That is not redundancy: on an AZERTY
 * keyboard the key labelled Z sits where QWERTY has W, so it reports
 * `code: "KeyW"` together with `key: "z"`. Binding both means ZQSD works on
 * AZERTY and the same physical keys work as WASD on QWERTY, with no layout
 * detection anywhere.
 */

/** @typedef {"up"|"left"|"down"|"right"} MoveAction */

/** @type {Readonly<Record<MoveAction, {codes: string[], keys: string[]}>>} */
export const MOVE_BINDINGS = Object.freeze({
  up: { codes: ["KeyW", "ArrowUp"], keys: ["z", "w"] },
  left: { codes: ["KeyA", "ArrowLeft"], keys: ["q", "a"] },
  down: { codes: ["KeyS", "ArrowDown"], keys: ["s"] },
  right: { codes: ["KeyD", "ArrowRight"], keys: ["d"] },
});

/** Keys whose default browser behaviour (scrolling) would fight the game. */
const SWALLOWED_CODES = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export class Keyboard {
  constructor() {
    /** @type {Set<string>} Holds both codes and lowercased key letters. */
    this.pressed = new Set();
    /** @type {string[]} One-shot presses awaiting consumption; the hook for spell keys. */
    this.pressQueue = [];
    /** @type {Array<() => void>} */
    this.teardown = [];
  }

  /**
   * @param {EventTarget} target
   * @returns {this}
   */
  attach(target) {
    const onKeyDown = (event) => this.handleKeyDown(event);
    const onKeyUp = (event) => this.handleKeyUp(event);
    // A key held while the window loses focus never fires keyup, which would
    // otherwise leave the player sliding forever.
    const onBlur = () => this.pressed.clear();

    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
    target.addEventListener("blur", onBlur);
    this.teardown.push(() => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
    });
    return this;
  }

  detach() {
    for (const undo of this.teardown) undo();
    this.teardown = [];
    this.pressed.clear();
  }

  /** @param {KeyboardEvent} event */
  handleKeyDown(event) {
    if (SWALLOWED_CODES.has(event.code)) event.preventDefault?.();
    if (!event.repeat) this.pressQueue.push(event.code);
    this.pressed.add(event.code);
    if (event.key) this.pressed.add(event.key.toLowerCase());
  }

  /** @param {KeyboardEvent} event */
  handleKeyUp(event) {
    this.pressed.delete(event.code);
    if (event.key) this.pressed.delete(event.key.toLowerCase());
  }

  /**
   * @param {MoveAction|string} action
   * @returns {boolean}
   */
  isDown(action) {
    const binding = MOVE_BINDINGS[action];
    if (!binding) return this.pressed.has(action);
    return (
      binding.codes.some((code) => this.pressed.has(code)) ||
      binding.keys.some((key) => this.pressed.has(key))
    );
  }

  /**
   * Movement intent as a raw vector; each component is -1, 0 or 1. Opposite
   * keys held together cancel out. `Player.move()` normalises the diagonal.
   * @returns {{x: number, y: number}}
   */
  moveDirection() {
    return {
      x: (this.isDown("right") ? 1 : 0) - (this.isDown("left") ? 1 : 0),
      y: (this.isDown("down") ? 1 : 0) - (this.isDown("up") ? 1 : 0),
    };
  }

  /**
   * Drains the one-shot press queue. Spell casting on AERF / Space / 1-4 will
   * read from here; see docs/spell-proposals.md.
   * @returns {string[]}
   */
  takePresses() {
    const presses = this.pressQueue;
    this.pressQueue = [];
    return presses;
  }
}
