import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALL_GLYPHS,
  COMMON_SYMBOLS,
  GLYPHS,
  RARE_SYMBOLS,
  assertGlyphSymbolsAreSafe,
  glyphForSymbol,
  symbolFor,
} from "../src/config/glyphs.js";

describe("glyph registry", () => {
  it("keeps every symbol to a single UTF-16 code unit", () => {
    // Sequences are consumed with sequence[0] and sequence.slice(1). An astral
    // emoji is two code units and would corrupt every sequence containing it,
    // so this is a hard constraint rather than a style preference.
    assert.equal(assertGlyphSymbolsAreSafe(), true);
    for (const glyph of ALL_GLYPHS) {
      assert.equal(glyph.symbol.length, 1, `${glyph.id} spans multiple code units`);
    }
  });

  it("rejects an astral symbol", () => {
    // Guards the guard: proves assertGlyphSymbolsAreSafe would actually catch
    // someone reaching for a spiral emoji instead of a BMP character.
    const astral = "\u{1F300}";
    assert.equal(astral.length, 2, "the emoji really is two code units");
    assert.throws(
      () => assertGlyphSymbolsAreSafe([{ id: "whirl", symbol: astral }]),
      /UTF-16 code units/,
    );
  });

  it("uses U+0245 for the chevron, not a lambda or an ASCII A", () => {
    assert.equal(GLYPHS.chevronUp.symbol.codePointAt(0), 0x245);
    assert.notEqual(GLYPHS.chevronUp.symbol, "A");
    assert.notEqual(GLYPHS.chevronUp.symbol, "Λ");
  });

  it("declares unique symbols", () => {
    const symbols = ALL_GLYPHS.map((glyph) => glyph.symbol);
    assert.equal(new Set(symbols).size, symbols.length);
  });

  it("round-trips glyph id to symbol and back", () => {
    for (const glyph of ALL_GLYPHS) {
      assert.equal(symbolFor(glyph.id), glyph.symbol);
      assert.equal(glyphForSymbol(glyph.symbol).id, glyph.id);
    }
  });

  it("returns null for unknown lookups instead of undefined", () => {
    assert.equal(symbolFor("nope"), null);
    assert.equal(symbolFor(null), null);
    assert.equal(glyphForSymbol("Z"), null);
  });

  it("splits common and rare symbols without overlap", () => {
    assert.deepEqual([...COMMON_SYMBOLS], ["_", "|", "V", "Ʌ"]);
    assert.deepEqual([...RARE_SYMBOLS], ["⚡", "@"]);
    const overlap = COMMON_SYMBOLS.filter((symbol) => RARE_SYMBOLS.includes(symbol));
    assert.deepEqual(overlap, []);
  });
});
