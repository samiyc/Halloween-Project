/**
 * Every gameplay tunable, in one place. Nothing here is read at module scope by
 * game logic — values are passed in through constructors — so tests can build
 * an entity with different numbers without mutating globals.
 *
 * Speeds and sizes are in canvas pixels. Durations are in milliseconds.
 * "…PerFrame" values are per 60 Hz frame; see `TIME.referenceFrameMs`.
 */

/** Internal canvas resolution: the drawing surface as a whole. */
export const CANVAS = Object.freeze({
  width: 1900,
  height: 1200,
});

/**
 * The two vertical strips that carry the HUD.
 *
 * They exist so nothing is ever drawn on top of the board: the score, the spell
 * slot and the glyph legend used to sit over the play area and disappear behind
 * falling enemies.
 */
export const SIDEBAR = Object.freeze({
  width: 300,
  /** Slightly darker than the field, so the eye reads the board as the subject. */
  color: "#40494E",
});

/**
 * The playable board, centred between the two sidebars.
 *
 * Derived from CANVAS and SIDEBAR rather than written out, so the three can
 * never drift apart.
 *
 * Game logic works entirely in field coordinates (0..width, 0..height) and
 * knows nothing about the sidebars — `Renderer` translates by `FIELD.x` and
 * `PointerTracker` subtracts it. Keep it that way: baking the offset into
 * spawning, clamping or escape detection would spread it across the codebase.
 */
export const FIELD = Object.freeze({
  x: SIDEBAR.width,
  y: 0,
  width: CANVAS.width - 2 * SIDEBAR.width,
  height: CANVAS.height,
});

export const TIME = Object.freeze({
  /**
   * Movement was originally written as "pixels added once per animation frame",
   * which silently made the game 2.4x faster on a 144 Hz monitor. Entities now
   * scale by `dt / referenceFrameMs`, so 60 Hz behaves exactly as before and
   * every other refresh rate matches it.
   */
  referenceFrameMs: 1000 / 60,
  /** A tab left in the background produces a huge first dt; clamp it. */
  maxFrameMs: 100,
});

export const STROKE = Object.freeze({
  /** Straight-line start→end distance below which a stroke is ignored. */
  minLength: 50,
  /** Midpoint must clear this fraction of the stroke width to read as a chevron. */
  chevronRatio: 0.2,
  /** Direction runs shorter than this are mouse jitter, not intent. */
  reversalDeadzone: 14,
  /** A zigzag needs at least this many horizontal direction changes. */
  boltMinReversals: 2,
  /** Cumulative turn (degrees) that marks a stroke as a spiral. */
  spiralMinTurn: 450,
  /** Headings for curvature are taken between points at least this far apart. */
  turnSampleDistance: 26,
  /** Moving-average window applied before measuring curvature. */
  turnSmoothingWindow: 5,
});

export const ENEMY = Object.freeze({
  size: 25,
  color: "#AAA",
  minSequence: 1,
  maxSequence: 5,
  /** speed = baseSpeed + random(0..speedSpread) - sequenceLength * speedPerSymbol */
  baseSpeed: 0.6,
  speedSpread: 0.8,
  speedPerSymbol: 0.1,
});

export const RARE_ENEMY = Object.freeze({
  size: 32,
  color: "#8A63D2",
  minSequence: 2,
  maxSequence: 4,
  baseSpeed: 0.35,
  speedSpread: 0.35,
  speedPerSymbol: 0.05,
  /** How many of its symbols are drawn from RARE_SYMBOLS. */
  minRareSymbols: 1,
  maxRareSymbols: 2,
});

export const BOSS = Object.freeze({
  lives: 3,
  size: 100,
  baseColor: "#FF4500",
  invincibleColor: "#888",
  speed: 0.25,
  /** Upward speed during the invincible retreat; ignores `speed`. */
  retreatSpeed: 1.5,
  shrinkPerLife: 15,
  speedGainPerLife: 0.25,
  /** Sequence length = sequenceBase + lives * sequencePerLife. */
  sequenceBase: 6,
  sequencePerLife: 2,
});

export const PLAYER = Object.freeze({
  size: 25,
  color: "#3FD35F",
  /** Pixels per 60 Hz frame, applied per axis then normalised on diagonals. */
  speed: 4,
  /** Distance from player centre to enemy centre for the melee to connect. */
  meleeRange: 55,
  /** Auto-attack period. Fires with no click and no key press. */
  meleeCooldownMs: 1500,
});

export const SPAWN = Object.freeze({
  /** Chance per 60 Hz frame that an enemy appears. */
  chancePerFrame: 0.015,
  /** Of those spawns, the share that are rare enemies. */
  rareShare: 0.12,
});

/**
 * Caps a frame delta at `TIME.maxFrameMs`.
 *
 * Everything that advances game state must go through this. A backgrounded
 * tab, a paused debugger or a stalled frame produces a delta of seconds, and
 * anything consuming it raw jumps forward by that much in one step.
 *
 * @param {number} deltaMs
 * @returns {number}
 */
export function clampDelta(deltaMs) {
  return Math.min(deltaMs, TIME.maxFrameMs);
}

/**
 * Converts a frame delta into "60 Hz frames", the unit every speed above uses.
 * @param {number} deltaMs
 * @returns {number}
 */
export function toFrames(deltaMs) {
  return clampDelta(deltaMs) / TIME.referenceFrameMs;
}
