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
  it("keeps every symbol to a single code point", () => {
    // Astral emoji are allowed — Entity walks code points, not code units — but
    // a symbol still has to be exactly one character, or nothing can tell where
    // it ends inside a sequence.
    assert.equal(assertGlyphSymbolsAreSafe(), true);
    for (const glyph of ALL_GLYPHS) {
      assert.equal([...glyph.symbol].length, 1, `${glyph.id} is not a single code point`);
    }
  });

  it("accepts an astral emoji as a symbol", () => {
    // 🌀 is two UTF-16 code units. It used to be rejected because sequences were
    // sliced by code unit, which left a lone surrogate behind. Entity now walks
    // code points, so it is a legal symbol.
    const astral = "\u{1F300}";
    assert.equal(astral.length, 2, "the emoji really is two code units");
    assert.equal([...astral].length, 1, "but a single code point");
    assert.equal(assertGlyphSymbolsAreSafe([{ id: "whirl", symbol: astral }]), true);
  });

  it("still rejects a symbol made of several code points", () => {
    // Guards the guard: two characters glued together have no findable end.
    assert.throws(() => assertGlyphSymbolsAreSafe([{ id: "double", symbol: "ab" }]), /code points/);
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
    // Deliberately not pinning the rare symbols to literal characters: they are
    // cosmetic and get changed. What must hold is the split itself.
    assert.deepEqual([...COMMON_SYMBOLS], ["_", "|", "V", "Ʌ"]);
    assert.equal(RARE_SYMBOLS.length, 2);
    const overlap = COMMON_SYMBOLS.filter((symbol) => RARE_SYMBOLS.includes(symbol));
    assert.deepEqual(overlap, []);
  });
});
