/**
 * Development switches.
 *
 * Tooling, not content: these exist so the campaign can be exercised without
 * being replayed from the first episode every time. They are **not** cheats
 * offered to a player — nothing in the game turns them on.
 *
 * **Both must be `false` in a commit.** No test enforces that, on purpose: a
 * test would turn red exactly while you are using the flag, which is the one
 * moment red is useless. The menu says "mode dev" in its subtitle instead, so
 * a switch left on is visible the moment the page opens.
 */
export const DEV = Object.freeze({
  /**
   * Opens every story episode, whatever the save file says.
   *
   * It changes what can be *started*, never what has been *won*:
   * `Progress.isCompleted()` stays honest, so the buttons still read "Nouvel
   * épisode" and the real progression is never overwritten.
   */
  unlockAllLevels: false,

  /**
   * Shows the closing paragraph of every episode in the menu panel, without
   * having won it. Independent of the switch above: reading the texts and
   * playing the levels are two different jobs.
   */
  revealAllStories: false,
});

/** Whether anything above is on — the menu says so when it is. */
export const IS_DEV_MODE = Object.values(DEV).some(Boolean);
