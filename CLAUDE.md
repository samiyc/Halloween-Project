# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A browser game ("Magic Spell Game"): shapes fall down an HTML5 canvas and the
player destroys them by drawing mouse gestures matching the glyph sequence above
each one. A keyboard-driven player square adds a short-range automatic melee.
Vanilla JavaScript ES modules, **no build step**. Node is a dev dependency only
(tests + lint); the game itself ships no dependencies.

Prose docs live in `docs/` and are written in French, matching how the repo
owner works. Code, comments and identifiers are English.

## Commands

```bash
npm test                                   # node --test, the whole suite
node --test tests/game.test.js             # one file
node --test --test-name-pattern="melee"    # one test by name
npm run test:coverage
npm run lint                               # ESLint 9 + eslint-plugin-sonarjs
npm run check                              # lint + test; run before committing
npm run serve                              # http://localhost:3000/halloween.html
```

The owner normally runs the game through VS Code's Live Server ("Go Live") at
`http://127.0.0.1:5500/halloween.html`. Opening `halloween.html` over `file://`
fails silently with a blank canvas — ES modules need HTTP.

`npm run serve` uses `npx serve`, which rewrites URLs and **drops the query
string**, so `?debug` does not survive there. Use `npx http-server` or Live
Server when the debug hook is needed.

Verifying gameplay means playing it, or driving it through `?debug` (below).

## Architecture

**The rule that everything else follows: game logic never touches the canvas,
the DOM or the clock.** `src/entities/`, `src/game/`, `src/engine/gesture/`,
`src/config/` and `src/tools/` all run under plain Node. A whole match plays out
inside a unit test. Do not reintroduce `ctx` into an entity.

```
halloween.html → src/main.js   (the only module aware of both DOM and game)
src/
  config/    glyphs.js, settings.js — single source of truth, no logic
  tools/     random.js — the only Math.random() in the repo
  entities/  Entity → Enemy, Boss, Player   (state + behaviour, no drawing)
  game/      game.js (orchestrator), combat.js, spawner.js
  engine/    loop.js, keyboard.js, pointer.js, gesture/{geometry,recognizer}.js
  render/    renderer.js, hud.js, palette.js — all 2D-context code
```

Dependencies only point downward: `entities/` never imports `render/`.

### The glyph registry

A glyph is declared once in `src/config/glyphs.js` and matching goes through
`Entity.matches()` → `symbolFor(glyphId)`. **Do not reimplement the
orientation→symbol comparison in a subclass** — that duplication across
`Enemy` and `Boss` was the original design flaw.

`Ʌ` is U+0245 (LATIN CAPITAL LETTER TURNED V), not a Greek lambda or ASCII `A`.

**Hard constraint:** every `symbol` must be a single UTF-16 code unit, because
sequences are consumed with `sequence[0]` / `sequence.slice(1)`. An astral emoji
(🌀, U+1F300) is two units and corrupts sequences silently. That is why the
spiral uses `@`. `assertGlyphSymbolsAreSafe()` is covered by a test.

Adding a gesture = add a registry entry + a `detectXxx()` in `recognizer.js`.
See `docs/gestures.md`.

### Gesture recognition order

`recognizeStroke()` tests spiral → bolt → chevron → line, and the order is
load-bearing: spiral and bolt would otherwise be swallowed by the chevron or
angle test. Chevrons stay ahead of the angle test so they win ties, preserving
the original feel.

Chevrons and bolts are separated structurally, not by tuning: a `V`/`Ʌ` reverses
in **Y** while X advances monotonically (0 X-reversals); a bolt reverses in
**X**. Curvature is measured on a *smoothed* path — without it, a few pixels of
hand tremor read as a spiral.

### Time handling

Everything scales by `toFrames(deltaMs)`, which converts a delta into "60 Hz
frames". At 60 Hz it is exactly 1, so original tuning is preserved; the test
machine measured **163 Hz**, where the old per-frame code ran 2.7x too fast.

**Anything consuming a delta must go through `clampDelta()` or `toFrames()`.**
A backgrounded tab produces multi-second deltas; consumed raw they teleport
entities or instantly refund a cooldown. This was a real bug in `Player.update`,
caught in the browser and now covered by a test.

### Randomness

`Math.random()` appears exactly once, in `tools/random.js`. Everything else
takes an injected `Rng`. `createSeededRandom(42)` replays an identical match —
that is what makes spawning and sequence generation testable, and it keeps
SonarJS's `pseudo-random` rule quiet outside that one justified exception.

### Boss lifecycle

A phase machine: `descending` → (sequence cleared) → `retreating` (invincible,
moves up, ignores `speed`) → reaching the top spends a life, regrows a longer
sequence, shrinks 15px, speeds up 0.25. `isDefeatedForGood()` is only true out
of the retreat phase with no lives left.

Enemies reverse upward once `boss.lives < 1`, computed in `Game.advanceBoard()`
and passed down as `update(deltaMs, { reversed })`. Enemies no longer reach into
the boss object — that coupling threw whenever the boss was absent. The reversal
window is only the final retreat.

## Complexity budget

`eslint.config.js` enforces `complexity: 8`, `cognitive-complexity: 10`,
`max-lines-per-function: 40`, `max-lines: 220`, `max-depth: 3`, `max-params: 4`.
This is deliberate: the original `game.js` was 228 lines with twelve
responsibilities. Split the module rather than raising a limit.

Pinned to ESLint 9, not 10 — ESLint 10 requires Node ≥ 20.19 and this machine
runs 20.10.

## Debug hook

`halloween.html?debug` exposes the live game as `__magicSpell.game` (enemies,
boss phase, player, score). Off by default. Useful for driving the running game
from the console or from browser automation.

## Canvas sizing

Internal resolution is 1200x900 (1.5x the original 800x600, same 4:3), scaled by
CSS to fill the viewport. **`PointerTracker.toCanvasPoint()` multiplies mouse
coordinates back into the internal resolution** — measured scale was 0.96, so
without it every gesture lands off-target. Do not remove that scaling.

Field height went 600 → 900 at unchanged speeds, so enemies take 1.5x longer to
cross and the game is easier than before. Left deliberately untouched; tune via
`ENEMY.baseSpeed` or `SPAWN.chancePerFrame` in `src/config/settings.js`.

## Direction of travel

A playable character exists: ZQSD movement plus an automatic melee. **The melee
is slated for removal.** Play-testing found it gives the player almost no
decisions — the dominant strategy is to park on the boss.

The agreed replacement is in `docs/rewards.md`: the character becomes a
collector of falling pickups, and **contact with an enemy loses the run**, so
movement carries real risk. That doc lists what to delete, what to add, and the
open question (instant loss vs. lives) that should be settled before coding.

`docs/spell-proposals.md` predates that decision and is marked as partially
superseded; its design principles and its "what I would avoid" section still
hold. `Keyboard.takePresses()` remains the hook for any key-driven ability.

Guiding constraint from both docs: a key must never remove a symbol for free, or
the mouse — the core of the game — becomes decorative.
