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
  game/      game.js (orchestrator), combat.js, spawner.js, mana.js,
             collection.js, pickup-spawner.js, effects.js, spellbook.js
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

**Hard constraint:** every `symbol` must be exactly one **code point**. Astral
emoji are allowed (🌀, U+1F300, is two UTF-16 code units and works); the spiral
currently uses `@`.

That was not always true. Sequences were consumed with `sequence[0]` /
`sequence.slice(1)`, which work on code units, so 🌀 left a lone surrogate behind
and corrupted every sequence carrying it. `Entity.nextSymbol` and
`Entity.dropFirstSymbol()` now walk code points — **anything consuming a
sequence must go through those two members**, never index a sequence directly.
`assertGlyphSymbolsAreSafe()` is covered by a test.

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

## Canvas, field and sidebars

The canvas is **1900x1200**: a **1300x1200 board** (`FIELD`) centred between two
**300px sidebars** (`SIDEBAR`) that carry the whole HUD. `FIELD` is derived from
the other two, so they cannot drift apart.

**Game logic works entirely in field coordinates (0..1300 x 0..1200) and knows
nothing about the sidebars.** Two places bridge the gap, and only two:

- `Renderer.inField(draw)` translates by `FIELD.x` and clips to the board. All
  entity drawing goes through it; the clip is what stops a sequence label at
  x = 0 from spilling onto the strip.
- `PointerTracker.toCanvasPoint()` undoes the CSS scale **and then** subtracts
  `FIELD.x`. Order matters — subtracting first would scale the offset too.

Do not bake the offset into spawning, clamping or escape detection instead.

A trap worth knowing: gesture recognition is translation-invariant (it reads
only differences), so a wrong offset would **not** break gestures. The only
symptom is a trail drawn 300px from the cursor, which no unit test can see.
Check it in the browser.

`main.js` must pass `FIELD` as the game bounds. It once passed `canvas.width`,
which put the player at the canvas centre and let the board run under the
sidebars — the unit tests missed it because they construct `Game` with defaults.

### Displayed 1:1 — and the trap it closes

The CSS pins the canvas to **1:1** wherever there is room, via a `1900px` term
in its `min()`. One canvas pixel is then one screen pixel, so a measurement taken
in an image editor matches the constants in `settings.js`. It needs a viewport
**≥ 1224px tall**; below that the other terms take over and the canvas shrinks
rather than overflowing. Grey around the board is intentional.

This closes a trap that will otherwise be rediscovered every time someone
measures a screenshot: the browser used to stretch the canvas to fill the
height, and the factor depended on the canvas size. At 1200x900 it was **×1.376**,
at 1900x1200 only **×1.032** — so a 25px square went from 34px to 26px on screen
**without a single constant changing**. If entities ever "look smaller", check
the scale before touching `settings.js`.

The world was then scaled **×1.6** (enemy 40, rare 50, boss 160, player 40, orb
radius 10) to restore the old readability, this time with no zoom. Speeds were
deliberately left alone, so pacing is unchanged and the board is simply denser.
`PointerTracker` still undoes whatever CSS scale remains, so a smaller screen
keeps working.

The board has grown twice (800x600 → 1200x900 → 1300x1200) at unchanged speeds,
so enemies take much longer to cross than originally tuned. Framing the play area
did not shrink it: it is **44% larger** than the previous 1200x900. Win rate held
anyway, because a taller board slows the threat and the mana collection equally.
Tune with `MANA.costCommon` first, then `ENEMY.baseSpeed` / `SPAWN.chancePerFrame`.

## The mana economy

Implemented. `docs/mana-and-spells.md` holds the reasoning and the measurements.

- Gestures cost mana: **8** points for `_ | V Ʌ`, **24** for the rare `↯ @`.
  Blue orbs are worth 5 and fall at 1.5x the enemy rate and speed. Gauge maxes at
  **150**, starts at **20**, trickles 2 points/s.
- **A recognised gesture that hits nothing still costs.** That is what makes
  precision matter. An unrecognised stroke (`recognizeStroke` → `null`) casts
  nothing and costs nothing. Insufficient mana takes nothing and sets
  `manaWarningMs` so the HUD can flash.
- **Melee is free**, which makes it the floor that stops an empty gauge from
  becoming an unwinnable state. Never charge mana for it. It hits **everything
  inside its 75px circle**, not just the nearest target — the range was cut 15%
  when that changed, so walking into a group is what makes it pay. An earlier plan had
  the melee deleted; that was reversed. `docs/rewards.md` and
  `docs/spell-proposals.md` carry banners saying so — do not act on their
  deletion lists.
- A yellow orb every 15-20s grants one random spell into a single slot, cast with
  `E` or right-click, free and with no cooldown. While a spell is held, further
  yellow orbs are **not** collected and keep falling.
- A spell that covers an area previews it: `spellRangeOf()` returns a radius and
  `Renderer.drawSpellRange()` draws a dashed circle while the spell sits in the
  slot, so you can see who is caught before spending it. Casting empties the
  slot, which clears the preview on its own.
- **`SPELL_COLORS` is the single source for every spell colour.** The slot border
  and name, the buff halos and the frozen-enemy tint all derive from it, so the
  ring you get after casting cannot contradict the slot you just looked at.
  The point is identifying the held spell without reading it, which needs hues
  that are actually far apart: the obvious picks (frost tint, old Célérité halo,
  mana blue) sat within 20 degrees — three cyans. A test enforces 45 degrees
  minimum between any two.
- **Spell distances are world-space and must scale with the world.** Givre's
  radius was left at 200 through the x1.6 pass and quietly fell to 2.7x the melee
  reach instead of ~4x; it is 320 now, and a test guards the ratio.

### Balance is measured, not guessed

The costs above came out of a headless simulation, not intuition. Design said 10
points ("a cast costs 2 orbs"); at 10 the game was winnable 4 times in 10,
because the collection ceiling is real — **45%** on the current board — capping
income near 5.1 pts/s against a 9-18 pts/s demand. At 8 it is 10 in 10.

**Cost is a far stronger lever than drop rate**: −20% cost doubled the win rate
while +33% orbs gained one point, since orbs you cannot reach are worth nothing.
Tune `MANA.costCommon` first. If you change any tunable, re-run the simulation
rather than reasoning about it — `tests/mana.test.js` guards the ratios but
cannot tell you whether a run is still winnable.

### Traps already hit once

- Everything consuming a delta goes through `clampDelta()`: regeneration, buff
  durations, enemy slow, melee cadence. Each has a regression test pushing a
  60-second frame.
- The player is already green, so a "green speed buff" would be invisible. Buffs
  are rings around the player; fill stays identity. Rings also stack, which a
  fill colour cannot.
- `PointerTracker` ignores non-left buttons, or a right-click spell cast would
  also start a stroke that the release would charge for.
- There is **no player/enemy collision**, so collecting costs only attention.
  That is the main open design risk, recorded in `docs/rewards.md`.

`Keyboard.takePresses()` is the hook for key-driven abilities.

Guiding constraint across every design doc: a key must never remove a symbol for
free, or the mouse — the core of the game — becomes decorative.
