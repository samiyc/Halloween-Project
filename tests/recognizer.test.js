import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GLYPHS, symbolFor } from "../src/config/glyphs.js";
import { STROKE } from "../src/config/settings.js";
import { isStrokeUsable, recognizeStroke } from "../src/engine/gesture/recognizer.js";
import {
  boltStroke,
  closedSpiralStroke,
  chevronDownStroke,
  chevronUpStroke,
  horizontalStroke,
  jitteryHorizontalStroke,
  segment,
  spiralStroke,
  tinyStroke,
  verticalStroke,
} from "./helpers/strokes.js";

describe("recognizeStroke", () => {
  it("classifies each of the six glyphs", () => {
    const cases = [
      ["horizontal", horizontalStroke()],
      ["vertical", verticalStroke()],
      ["chevronDown", chevronDownStroke()],
      ["chevronUp", chevronUpStroke()],
      ["bolt", boltStroke()],
      ["spiral", spiralStroke()],
    ];
    for (const [expected, path] of cases) {
      assert.equal(recognizeStroke(path), expected, `expected ${expected}`);
    }
  });

  it("returns null for a stroke below the minimum length", () => {
    assert.equal(recognizeStroke(tinyStroke()), null);
  });

  it("returns null for degenerate input instead of throwing", () => {
    assert.equal(recognizeStroke([]), null);
    assert.equal(recognizeStroke([{ x: 1, y: 1 }]), null);
    assert.equal(recognizeStroke(null), null);
  });

  it("maps every recognised glyph to a sequence symbol", () => {
    // The regression guard for the bug this refactor removed: a recognizer
    // able to emit an id that no entity could ever match.
    const paths = [
      horizontalStroke(),
      verticalStroke(),
      chevronDownStroke(),
      chevronUpStroke(),
      boltStroke(),
      spiralStroke(),
    ];
    for (const path of paths) {
      const glyphId = recognizeStroke(path);
      assert.ok(glyphId, "stroke should be recognised");
      assert.ok(symbolFor(glyphId), `no symbol declared for glyph "${glyphId}"`);
      assert.ok(GLYPHS[glyphId], `glyph "${glyphId}" missing from the registry`);
    }
  });
});

describe("recognizer priority", () => {
  it("does not mistake a chevron for a bolt", () => {
    // Chevrons reverse in Y while X keeps going one way; bolts reverse in X.
    // This is the separation the ordering depends on.
    assert.equal(recognizeStroke(chevronDownStroke()), "chevronDown");
    assert.equal(recognizeStroke(chevronUpStroke()), "chevronUp");
  });

  it("does not mistake a bolt for a chevron", () => {
    assert.equal(recognizeStroke(boltStroke()), "bolt");
  });

  it("prefers spiral over bolt when a stroke winds far enough", () => {
    const wide = spiralStroke(2.2);
    assert.equal(recognizeStroke(wide), "spiral");
  });

  it("treats a partial curl as a bolt, not a spiral", () => {
    const halfTurn = spiralStroke(0.55);
    assert.notEqual(recognizeStroke(halfTurn), "spiral");
  });

  it("ignores hand tremor on a straight line", () => {
    assert.equal(recognizeStroke(jitteryHorizontalStroke()), "horizontal");
  });

  it("splits horizontal from vertical at the 45 degree boundary", () => {
    assert.equal(recognizeStroke(segment({ x: 0, y: 0 }, { x: 200, y: 60 })), "horizontal");
    assert.equal(recognizeStroke(segment({ x: 0, y: 0 }, { x: 60, y: 200 })), "vertical");
  });
});

describe("isStrokeUsable", () => {
  it("rejects a stroke that never travels far enough", () => {
    assert.equal(isStrokeUsable(tinyStroke()), false);
  });

  it("accepts a wound spiral that ends near its own start", () => {
    // `span()` measures start->end distance, so a closed spiral would fail the
    // length gate; the spiral rescue in isStrokeUsable is what saves it.
    const closed = closedSpiralStroke();
    const start = closed[0];
    const end = closed[closed.length - 1];
    const startToEnd = Math.hypot(end.x - start.x, end.y - start.y);

    assert.ok(startToEnd < STROKE.minLength, "fixture must end near its start");
    assert.equal(isStrokeUsable(closed), true);
    assert.equal(recognizeStroke(closed), "spiral");
  });
});
