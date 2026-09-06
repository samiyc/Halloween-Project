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
  config/    glyphs.js, settings.js, difficulty.js — single source of truth
  tools/     random.js — the only Math.random() in the repo; color.js,
             aim.js, hit-flash.js
  entities/  Entity → Enemy, Boss, Player   (state + behaviour, no drawing)
             plus Turret and Projectile, which extend nothing
  game/      session.js (menu/pause), game.js (orchestrator), combat.js,
             spawner.js, gauge.js, collection.js, pickup-spawner.js,
             effects.js, spellbook.js, boss-attacks.js, threat.js
  engine/    loop.js, keyboard.js, pointer.js, gesture/{geometry,recognizer}.js
  render/    renderer.js, hud.js, menu.js, gauges.js, palette.js, turret.js,
             threat.js — 2D-context code, plus layout.js which is pure geometry
             and has no ctx
```

Dependencies only point downward: `entities/` never imports `render/`. Colour
arithmetic (`withAlpha`, `mixHex`) therefore lives in `tools/color.js`, not in
`palette.js` — an enemy computes its own tint. `channels()` there handles the
`#rgb` shorthand on purpose: `ENEMY.color` is `"#AAA"`, and read as six digits
it parses to a dark blue instead of grey.

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

## Difficulty, menu and pause

`docs/difficulty.md` holds the detail. The short version:

- **`src/config/difficulty.js`** declares three modes as feature switches, not
  numbers: `mana`, `rareEnemies`, `spells`, `health`. Easy has none, Normal has
  the first three, Hard adds health. They are **cumulative**, and a test walks
  `DIFFICULTY_IDS` to enforce it.
- Switching `rareEnemies` off passes `rareShare: 0` to the existing `Spawner`.
  No rare enemy means **no rare glyph can reach a sequence**, so "no bolts or
  spirals on Easy" is a consequence, not a second rule.
- **`src/game/session.js`** is the app-level state machine — menu vs playing,
  Escape, the 300ms toggle cooldown. Pure, no DOM, like `Game`.
- **Pausing is the absence of an update**: `main.js` stops calling
  `game.update()` while the menu is up. The run is frozen, not destroyed.
- **`src/render/layout.js`** returns the button rectangles and touches no ctx.
  Drawing and hit-testing read the same geometry, so a button cannot be drawn
  where it cannot be pressed — and it is the one part of the UI a unit test can
  check.
- `ManaPool` became **`Gauge`** (`src/game/gauge.js`) when health arrived: the
  spec asked for a bar "symmetric to the mana bar", so it is the same class and
  the same `drawVerticalGauge()`, mirrored.

### The boss turret — what Hard actually adds

`docs/boss-patterns.md` holds the detail and the proposals for further patterns.

The boss carries a dome and a barrel that **tracks the player slowly** and fires
one attack per cooldown, rolled from **its phase's table**. Health can now reach
zero, which is a third loss reason beside "an enemy crossed" and "the boss
crossed".

- **The rotation cap is the mechanic, and it is per pattern.** Uncapped tracking
  is a laser sight that nothing outruns. `TURRET.rotationDegPerSecond` (90) is
  the tracking default; a pattern may override it, and the beam does — at 90 it
  simply stayed on the player, because a beam never has to lead a target. At 15
  it can be walked out of, which is what earned it double damage.
- **Phases come from lives**: `Boss.phaseNumber` is 1 at full lives, then 2, then
  3; `patternsForPhase()` owns the tables and clamps, because the boss spends a
  frame at zero lives before the run is won. The three-shot volley is in every
  phase and is deliberately the one thing that never changes.
- **There is no spread parameter, and there must not be one.** The barrel keeps
  tracking through a burst, so a moving player makes the shots fan out on their
  own. The fan is information: it says the player moved.
- **The spiral sweeps blind** — it ignores the target entirely, at a rate derived
  from `sweepDegrees / durationMs` rather than written twice. 405° rather than
  360° so the arm does not close on its own start, leaving a walkable gap.
- **The turret holds fire while the boss is invincible** (`canFire`), which also
  **freezes the barrel and greys the dome**, and re-arms a full cooldown on the
  way back. An earlier version kept the barrel tracking through the retreat so
  its return would be readable; it read as a threat that could not fire.
- **`Game` owns the turret, not `Boss`.** It needs the player's position, and the
  boss must not learn about the player — the same decoupling that fixed enemies
  reaching into the boss object.
- Gated on `rules.health`, deliberately with no switch of its own: a
  `bossAttacks` flag could never differ from it.
- **`Gauge.drain()` vs `spend()`.** You *pay* mana, you *suffer* damage.
  `spend()` is all-or-nothing and refuses what it cannot cover, which on a health
  bar would make a player with 5 HP immortal. `drain()` takes what is there.
- The turret is the project's **first and only `ctx.rotate()`**: barrel drawn from
  the origin outward inside `save()/translate(centre)/rotate()/restore()`, so its
  pivot is exactly the boss centre.
- A beam or a burst is invisible to browser automation unless the loop is stopped
  (`app.loop.stop()`) and frames are driven by hand — 500ms is 30 rAF frames.

### Two coordinate spaces

`PointerTracker.toCanvasPoint()` undoes the CSS scale. **`toFieldPoint()`** then
subtracts `FIELD.x`. Buttons live in canvas space, entities in field space; the
two were one function until the HUD buttons made that untenable.

`isEnabled` receives the **canvas** point so a press aimed at the pause button
cannot also start a gesture — both listeners see the same mousedown.

### A trap worth remembering

Subtracting frame deltas never lands exactly on zero: 18 subtractions of 1000/60
from 300 leave 7.1e-15, which kept the Escape cooldown "active" for one extra
frame. `Session.tick()` snaps anything below a millisecond to zero. Any future
timer built the same way needs the same treatment.

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
- **HUD text is placed from the middle of its rect, never by an offset counted
  down from the top.** `pauseButton()` was 64 tall with its hint written at
  `y + 66`, so "Échap" was drawn across the bottom border — the same defect the
  spell slot had. `buttonLines()` in `layout.js` now derives both baselines from
  the rect, so a button can be resized safely, and a test checks every button's
  lines stay inside it. `drawButton` sets `textBaseline` and restores it: no
  other draw in the HUD expects anything but the default.

### The hit flash

Losing a symbol lights the square to `HIT_FLASH.color` and fades it back over
100 ms, on every difficulty. Three things keep it in one piece:

- It is armed in **`Entity.dropFirstSymbol()`**, the single point both damage
  sources funnel through (`decrementSequence` for gestures, `stripSymbol` for the
  melee). Do not arm it at a call site; a new damage source would then miss it.
  The player is the exception, armed by `Player.takeHit()` from `Game`, because
  it carries no sequence to lose.
- The countdown and the blend live in **`tools/hit-flash.js`**, shared by
  `Entity` and `Player` — the two have no common ancestor, and the player has no
  business inheriting glyph members just to blink.
- Subclasses express a lasting tint by overriding **`baseColor`, never
  `displayColor`** — `displayColor` is the flash blended over `baseColor`. That
  is why a frozen enemy still flashes and fades back to blue rather than grey.
- The countdown burns down in `Enemy.update()` and `Boss.update()` through
  `tickHitFlash()`, which clamps like every other delta consumer.

A flash is invisible in a screenshot taken through browser automation unless the
loop is stopped first (`app.loop.stop()`), then a single `app.frame(0)` drawn:
100 ms is six rAF frames, long gone by the time the screenshot lands.

### The threat markers

Triangles sit on the bottom line, aligned with what is closest to crossing it:
grey below 60% of the descent, amber to 80%, red past it (`THREAT` in
`settings.js`, colours in `THREAT_COLORS`). On every difficulty — nothing in the
path reads `game.rules`. `docs/gameplay.md` holds the reasoning.

- **`threatMarkers()` in `game/threat.js` is the entry point**, pure, fed
  `Game.threats` — `[...enemies, boss]`: both end the run by crossing the same
  line, and the boss is the one that gets forgotten at 0.25px/frame.
- **`warnRatio` is a threshold of attention, not just a colour.** Past it *every*
  threat gets its own marker; below it the board falls back to the single grey
  marker of `lowestThreat()`. Two enemies a few pixels apart shared one marker
  before, so the second was invisible — the exact surprise this exists to stop.
- **Progress is `y / fieldHeight`, the top edge** — exactly what `hasEscaped()`
  compares, so 1 is the frame the run is lost. Measuring the bottom edge would
  make a 40px enemy and a 160px boss turn red at different distances.
- **Drawn last in `drawBoard()`, and inside `inField()`.** Drawn first, the boss
  body covered its own marker entirely at the one moment it mattered; a dark rim
  is what keeps a red one readable on the boss orange. Being inside `inField()`
  is what puts a marker under its enemy rather than 300px away — the offset trap
  again, and again invisible to a unit test.

`Keyboard.takePresses()` is the hook for key-driven abilities.

Guiding constraint across every design doc: a key must never remove a symbol for
free, or the mouse — the core of the game — becomes decorative.
