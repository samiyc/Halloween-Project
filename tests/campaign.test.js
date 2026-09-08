import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DIFFICULTIES } from "../src/config/difficulty.js";
import { FIRST_LEVEL_ID, LEVELS, LEVEL_IDS, levelOf } from "../src/config/levels.js";
import { BOSS, TIME } from "../src/config/settings.js";
import { browserStorage, memoryStorage } from "../src/engine/storage.js";
import { BOSS_PHASE, Boss } from "../src/entities/boss.js";
import { GAME_STATUS, Game } from "../src/game/game.js";
import { SAVE_VERSION, Progress } from "../src/game/progress.js";
import { SCREEN, Session } from "../src/game/session.js";
import { createSeededRandom } from "../src/tools/random.js";

const FRAME = TIME.referenceFrameMs;

/** A campaign backed by a store a test can look inside. */
function saved(initial = null) {
  const storage = memoryStorage(initial);
  return { storage, progress: new Progress({ storage }) };
}

describe("the level registry", () => {
  it("has unique ids, and an order that names only real levels", () => {
    assert.equal(new Set(LEVEL_IDS).size, LEVELS.length);
    for (const id of LEVEL_IDS) {
      assert.ok(levelOf(id), `${id} is in the order but not in the registry`);
    }
    assert.equal(FIRST_LEVEL_ID, LEVEL_IDS[0]);
  });

  it("gives every level a name, a story and a difficulty that exists", () => {
    for (const level of LEVELS) {
      assert.ok(level.name.length > 0, `${level.id} has no name`);
      assert.ok(level.brief.length > 40, `${level.id} has no brief`);
      assert.ok(level.debrief.length > 40, `${level.id} has no debrief`);
      assert.ok(DIFFICULTIES[level.difficulty], `${level.id}: unknown ${level.difficulty}`);
      assert.ok(level.environment.length > 0);
    }
  });

  it("holds the boss back long enough for an opening", () => {
    // The whole point of a story level: the first minute belongs to the
    // ordinary robots. Anything under 20s would not be an opening.
    for (const level of LEVELS) {
      assert.ok(level.bossDelayMs >= 20_000, `${level.id} lets the boss in at once`);
    }
  });

  it("returns null for anything unknown, rather than throwing", () => {
    // A save file can name a level that no longer exists.
    assert.equal(levelOf("does-not-exist"), null);
    assert.equal(levelOf(null), null);
  });
});

describe("Progress", () => {
  it("opens the first level and nothing else on a fresh campaign", () => {
    const { progress } = saved();

    assert.equal(progress.isUnlocked(LEVEL_IDS[0]), true);
    assert.equal(progress.isUnlocked(LEVEL_IDS[1]), false);
    assert.equal(progress.isCompleted(LEVEL_IDS[0]), false);
  });

  it("opens the next level when the one before it is won", () => {
    const { progress } = saved();
    progress.complete(LEVEL_IDS[0]);

    assert.equal(progress.isUnlocked(LEVEL_IDS[1]), true);
    assert.equal(progress.isUnlocked(LEVEL_IDS[2]), false, "only one at a time");
  });

  it("treats a second win as a non-event", () => {
    const { progress } = saved();
    assert.equal(progress.complete(LEVEL_IDS[0]), true);
    assert.equal(progress.complete(LEVEL_IDS[0]), false, "already banked");
  });

  it("ignores a level that is not in the campaign", () => {
    const { progress } = saved();
    assert.equal(progress.complete("forest-999"), false);
    assert.equal(progress.isUnlocked("forest-999"), false);
  });

  it("points at the first level still to be won", () => {
    const { progress } = saved();
    assert.equal(progress.nextLevelId, LEVEL_IDS[0]);
    progress.complete(LEVEL_IDS[0]);
    assert.equal(progress.nextLevelId, LEVEL_IDS[1]);
  });

  it("says the campaign is over when everything is done", () => {
    const { progress } = saved();
    for (const id of LEVEL_IDS) progress.complete(id);
    assert.equal(progress.nextLevelId, null);
  });
});

describe("Progress saving", () => {
  it("writes a versioned save and reads it back", () => {
    const { storage, progress } = saved();
    progress.complete(LEVEL_IDS[0]);

    assert.deepEqual(JSON.parse(storage.read()), {
      version: SAVE_VERSION,
      completed: [LEVEL_IDS[0]],
    });
    assert.equal(new Progress({ storage }).isUnlocked(LEVEL_IDS[1]), true);
  });

  it("stores completions in campaign order, whatever order they came in", () => {
    const { storage, progress } = saved();
    progress.complete(LEVEL_IDS[1]);
    progress.complete(LEVEL_IDS[0]);

    assert.deepEqual(JSON.parse(storage.read()).completed, [LEVEL_IDS[0], LEVEL_IDS[1]]);
  });

  it("starts over rather than throwing on a broken save", () => {
    // A corrupt key must never be able to stop the menu from opening.
    for (const junk of ["", "not json", "[]", "null", '{"version":1}']) {
      const progress = new Progress({ storage: memoryStorage(junk) });
      assert.equal(progress.isUnlocked(LEVEL_IDS[0]), true, `on ${junk}`);
      assert.equal(progress.isUnlocked(LEVEL_IDS[1]), false, `on ${junk}`);
    }
  });

  it("discards a save written by another version", () => {
    const stale = JSON.stringify({ version: SAVE_VERSION + 1, completed: LEVEL_IDS });
    assert.equal(new Progress({ storage: memoryStorage(stale) }).isUnlocked(LEVEL_IDS[1]), false);
  });

  it("drops level ids that no longer exist", () => {
    const old = JSON.stringify({
      version: SAVE_VERSION,
      completed: [LEVEL_IDS[0], "forest-from-a-past-life"],
    });
    const progress = new Progress({ storage: memoryStorage(old) });

    assert.deepEqual([...progress.completed], [LEVEL_IDS[0]]);
  });

  it("works with no storage at all", () => {
    // A run with nothing to persist to must still be playable.
    const progress = new Progress();
    assert.equal(progress.complete(LEVEL_IDS[0]), true);
    assert.equal(progress.isUnlocked(LEVEL_IDS[1]), true);
  });

  it("forgets everything on reset", () => {
    const { storage, progress } = saved();
    progress.complete(LEVEL_IDS[0]);
    progress.reset();

    assert.equal(progress.isUnlocked(LEVEL_IDS[1]), false);
    assert.deepEqual(JSON.parse(storage.read()).completed, []);
  });
});

describe("browserStorage", () => {
  /**
   * Runs `body` with a stand-in for `localStorage`, and puts the global back.
   * @param {object|undefined} fake
   * @param {(storage: ReturnType<typeof browserStorage>) => void} body
   */
  function withLocalStorage(fake, body) {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", { value: fake, configurable: true });
    try {
      body(browserStorage("test.key"));
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
      else delete globalThis.localStorage;
    }
  }

  it("reads and writes through the real thing when there is one", () => {
    const store = new Map();
    const fake = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
    };

    withLocalStorage(fake, (storage) => {
      assert.equal(storage.read(), null);
      storage.write("hello");
      assert.equal(storage.read(), "hello");
      assert.equal(store.get("test.key"), "hello");
    });
  });

  it("plays on without a memory when storage throws", () => {
    // A strict private window throws on the very first getItem. A game that
    // cannot remember anything is fine; one that will not start is not.
    const hostile = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    };

    withLocalStorage(hostile, (storage) => {
      assert.equal(storage.read(), null);
      assert.doesNotThrow(() => storage.write("x"));
      assert.equal(new Progress({ storage }).isUnlocked(FIRST_LEVEL_ID), true);
    });
  });

  it("survives having no storage at all", () => {
    withLocalStorage(undefined, (storage) => {
      assert.equal(storage.read(), null);
      assert.doesNotThrow(() => storage.write("x"));
    });
  });
});

describe("Session in the campaign", () => {
  /** @returns {Session} */
  const sessionWith = (progress) =>
    new Session({ rng: createSeededRandom(42), progress });

  it("starts an open level, and hands its rules to the game", () => {
    const { progress } = saved();
    const session = sessionWith(progress);

    assert.equal(session.startLevel(FIRST_LEVEL_ID), true);
    assert.equal(session.screen, SCREEN.playing);
    assert.equal(session.level.id, FIRST_LEVEL_ID);
    assert.equal(session.game.rules.id, levelOf(FIRST_LEVEL_ID).difficulty);
  });

  it("refuses a locked level, even asked directly", () => {
    // The greyed button is a courtesy; this is the rule.
    const session = sessionWith(saved().progress);

    assert.equal(session.startLevel(LEVEL_IDS[1]), false);
    assert.equal(session.screen, SCREEN.menu, "nothing must have started");
    assert.equal(session.game, null);
  });

  it("refuses a level that does not exist", () => {
    assert.equal(sessionWith(saved().progress).startLevel("nope"), false);
  });

  it("banks a win, which opens the next level", () => {
    const { progress } = saved();
    const session = sessionWith(progress);
    session.startLevel(FIRST_LEVEL_ID);
    session.game.status = GAME_STATUS.won;

    assert.equal(session.noteOutcome(), true);
    assert.equal(progress.isUnlocked(LEVEL_IDS[1]), true);
    assert.equal(session.noteOutcome(), false, "called every frame, banked once");
  });

  it("banks nothing on a loss, or on a training run", () => {
    const { progress } = saved();
    const session = sessionWith(progress);

    session.startLevel(FIRST_LEVEL_ID);
    session.game.status = GAME_STATUS.lost;
    assert.equal(session.noteOutcome(), false);

    session.start("hard");
    session.game.status = GAME_STATUS.won;
    assert.equal(session.noteOutcome(), false, "training is not a campaign win");
    assert.equal(progress.isCompleted(FIRST_LEVEL_ID), false);
  });

  it("forgets the level when a training mode is started", () => {
    const session = sessionWith(saved().progress);
    session.startLevel(FIRST_LEVEL_ID);
    session.start("easy");

    assert.equal(session.levelId, null);
    assert.equal(session.level, null);
    assert.equal(session.game.level, null);
  });

  it("replays whatever was last launched", () => {
    const session = sessionWith(saved().progress);

    session.startLevel(FIRST_LEVEL_ID);
    session.restart();
    assert.equal(session.game.level.id, FIRST_LEVEL_ID, "an episode replays itself");

    session.start("hard");
    session.restart();
    assert.equal(session.game.level, null);
    assert.equal(session.game.rules.id, "hard", "a training run replays its mode");
  });

  it("unfolds one story at a time in the menu", () => {
    const session = sessionWith(saved().progress);

    session.toggleInfo(FIRST_LEVEL_ID);
    assert.equal(session.infoLevelId, FIRST_LEVEL_ID);
    session.toggleInfo(LEVEL_IDS[1]);
    assert.equal(session.infoLevelId, LEVEL_IDS[1], "another one takes its place");
    session.toggleInfo(LEVEL_IDS[1]);
    assert.equal(session.infoLevelId, null, "and the same one folds back");
  });
});

describe("the boss arrival delay", () => {
  /** @param {number} arrivalDelayMs */
  const bossWith = (arrivalDelayMs) =>
    new Boss({ fieldWidth: 1300, rng: createSeededRandom(11), arrivalDelayMs });

  it("leaves the training modes exactly as they were", () => {
    const boss = bossWith(0);
    assert.equal(boss.phase, BOSS_PHASE.descending);
    assert.equal(boss.isWaiting, false);
    assert.equal(boss.y, 0);
  });

  it("parks above the board until its delay is spent", () => {
    const boss = bossWith(5000);
    assert.equal(boss.phase, BOSS_PHASE.waiting);
    assert.ok(boss.y <= -boss.size, "it must be out of sight");

    for (let elapsed = 0; elapsed < 4000; elapsed += FRAME) boss.update(FRAME);
    assert.equal(boss.phase, BOSS_PHASE.waiting);
    assert.ok(boss.y <= -boss.size, "it must not creep in early");
  });

  it("cannot be touched, and cannot lose a life, while it waits", () => {
    const boss = bossWith(5000);
    assert.equal(boss.isInvincible, true, "which is what holds the turret too");
    assert.equal(boss.stripSymbol(), null);

    boss.sequence = "";
    assert.equal(boss.resolveClearedSequence(), false);
    assert.equal(boss.lives, BOSS.lives);
  });

  it("slides in and becomes vulnerable exactly when it lands", () => {
    const boss = bossWith(1000);
    let elapsed = 0;
    while (boss.isWaiting && elapsed < 20_000) {
      boss.update(FRAME);
      elapsed += FRAME;
    }

    assert.equal(boss.phase, BOSS_PHASE.descending);
    assert.equal(boss.y, 0, "it lands on the top edge, not past it");
    assert.equal(boss.isInvincible, false);
    // The delay, plus its own height at the off-board speed — a couple of
    // seconds of arrival, not the ten it would take at its descent speed.
    assert.ok(elapsed > 1000 && elapsed < 4000, `arrival took ${elapsed}ms`);
  });

  it("clamps a stalled frame like every other delta consumer", () => {
    // A backgrounded tab would otherwise spend the whole delay in one step.
    const boss = bossWith(5000);
    boss.update(60_000);
    assert.equal(boss.phase, BOSS_PHASE.waiting);
  });

  it("keeps a waiting boss out of the threat markers", () => {
    const level = levelOf(FIRST_LEVEL_ID);
    const game = new Game({ rng: createSeededRandom(7), level });

    assert.equal(game.boss.isWaiting, true);
    assert.ok(!game.threats.includes(game.boss), "nothing to point at off-screen");

    game.boss.phase = BOSS_PHASE.descending;
    assert.ok(game.threats.includes(game.boss));
  });

  it("gives a story game the level's delay, and a training game none", () => {
    const level = levelOf(FIRST_LEVEL_ID);
    assert.equal(new Game({ rng: createSeededRandom(7), level }).boss.arrivalMs, level.bossDelayMs);
    assert.equal(new Game({ rng: createSeededRandom(7) }).boss.arrivalMs, 0);
  });
});
