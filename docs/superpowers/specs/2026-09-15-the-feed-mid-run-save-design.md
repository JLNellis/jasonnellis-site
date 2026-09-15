# The Feed — mid-run save (Step 1, sub-project 1) — design (2026-09-15)

**Status:** design, approved to spec. First sub-project of "Step 1" from
`2026-09-15-the-feed-v2-evolution-vision.md`. Small, self-contained, and a
**prerequisite** for everything else in Step 1 (Acts, Team-as-characters, the
hall): a run that is longer and builds toward a payoff across acts cannot be
lost to a closed tab.

This is the concrete build spec for the vision doc's **Fixed point 2** ("Mid-run
save is a prerequisite, not a feature"). It does *not* build Acts, Team, or the
hall — those are later sub-projects with their own specs.

---

## Goal

Persist an in-progress run to `localStorage` at every week boundary, offer
**Continue** on the start screen, and clear the save when the run ends. On-device
only, cookieless, no backend — same principles as the rest of the game and the
site. `/privacy` stays exactly true.

The save's promise, stated precisely: **you won't lose your run.** It is not "you
won't lose an un-ended week" (see "The one limitation").

---

## Why now, and why alone

- **Prerequisite.** The vision doc sequences Fixed point 2 at step 0 — before
  Pillar 1 — for a reason: acts that build toward a payoff make a lost run far
  more costly than losing today's ~12-minute single-sitting run.
- **Forward-compat hook.** Acts and Team-as-characters will change the *shape* of
  the engine state `S`. This sub-project introduces the save-schema version that
  lets those later builds retire incompatible saves cleanly instead of resuming
  a stale run into a broken state. Shipping the versioning now, before the shape
  changes, is the point.
- **It does not touch the clock.** Saving does not lengthen a run; Acts and Team
  do. So the "~10 minutes → ~20 minutes" copy reposition (vision doc Fixed
  point 1) is **explicitly deferred** out of this sub-project — see "Out of
  scope."

---

## What gets saved

One JSON blob under `localStorage.thefeed_save`:

```
{
  v:  <SAVE_VERSION integer>,   // schema version; bumped when S's shape changes
  ts: <Date.now()>,             // for a future "saved 3 days ago" affordance; not required
  S:  <the engine state object>,
  ui: { hist, postLog, lastRecap, run }
}
```

- **`S`** — the engine state from `E.newState(...)`, mutated through the run. It
  is flat JSON with no functions (`the-feed-engine.js` `newState` builds a plain
  object), so it round-trips through `JSON.stringify`/`parse` losslessly. It
  already carries everything that matters: `feed` (the activity log — `pushFeed`
  writes `S.feed`), `hand`, `flags`, `plats`, `phase`, `event`, `week`, `cash`,
  `stress`, `rep`, counters, etc.
- **`ui`** — the four UI-only variables in `the-feed.html` that cannot be
  recomputed from `S`:
  - `hist` — the weekly snapshot array behind the trend charts / sparklines.
  - `postLog` — last-3-posts-per-platform, feeds the channel-card art.
  - `lastRecap` — the "WEEK N · WRAPPED" recap line deltas.
  - `run` — `{ restWeeks, peakStress, events }`, the **year-in-review stats on
    the end screen**. Omitting this would make a resumed run show wrong final
    stats, so it is required.

**Deliberately not saved** (transient — empty or default at a week boundary, or
trivially reconstructed by `render()`): `weekLog`, `queue`, `resolving`,
`bizMoreOpen`, `seenFeedLen`, `bumped`, `tab`, `backdropSrc`.

**No RNG state.** The engine's RNG defaults to `Math.random` and the game never
seeds it (`setRng` is used only by the sim/tests). There is no RNG state to
persist; a resumed run simply continues with fresh randomness. This is fine — the
game is not deterministic across a session today either.

---

## Mechanics

### Save point — end of `advance()`

`advance()` (in `the-feed.html`, ~L947) runs `E.advanceWeek(S)`, then
`snapshot()`, `computeRecap()`, sets `S.phase='play'`, `E.buildHand(S)`, and
`render()`. Add a `saveRun()` call at the very end of `advance()`, after
`buildHand`/`render`. The persisted state is therefore always **the clean start
of a week**: `phase==='play'`, `event===null`, `weekLog`/`queue` empty.

`saveRun()` writes the blob described above, wrapped in `try/catch` (a full or
blocked `localStorage` must never throw into the game loop — match the existing
`thefeed_muted` / `thefeed_endings` pattern).

### Restore — Continue on the start screen

On page load, where the start overlay is built (`buildStart`, ~L1456) / shown:

1. `loadRun()` reads and parses `thefeed_save` inside `try/catch`.
2. **A save is valid** iff it parses, `v === SAVE_VERSION`, and `S` looks like a
   live run (`S.over === false`, `S.week` a number in range). Anything else →
   treat as no save.
3. **Valid save present:** the start overlay's primary action becomes
   **"Continue — {S.name} · {niche label} · week {S.week}"**. A **"New run"**
   button is shown as the secondary/ghost action. Continue calls `resumeGame()`.
4. **No valid save:** the start overlay is exactly as it is today (name field,
   niche + platform pickers, "Go live"), no Continue button.

`resumeGame()`:
- Assigns the parsed `S` to the module `S` var and the four `ui` arrays to their
  vars (`hist`, `postLog`, `lastRecap`, `run`).
- Restores the derived UI: `paintBackdrop()`, `tab='home'`, then `render()`.
- Closes the start overlay (`openClose($('startOverlay'), false)`).
- Does **not** re-fire the Plausible `start` event (that fires on `newGame` for a
  fresh run; a resume is not a new run). It also does not re-deal the hand —
  `S.hand` was saved.

### New-run-over-a-save guard

Because a Continue-able save can represent a deep run, starting a fresh run must
not silently destroy it. When the player triggers "New run" (or "Go live" from
the pickers) while a valid save exists, confirm first:

> "Start a new run? Your saved run (week N) will be erased."

On confirm: `clearRun()`, then `newGame(...)` as today. `newGame` also calls
`clearRun()` unconditionally at its top as a belt-and-braces (a fresh run always
supersedes any prior save).

### Clear — on ending

`endGame(key)` (~L1409) sets `S.phase='end'` and records the found ending in
`thefeed_endings`. Add `clearRun()` there: the run is over, so its resume blob is
deleted. The endings gallery (`thefeed_endings`) and the future hall persist
under their **own** keys and are untouched by `clearRun()`.

### Version discipline

`const SAVE_VERSION = 1;` lives next to the save helpers. Any later sub-project
that changes the shape of `S` (Acts adds act/deck state; Team reshapes `hires`
into a dealt cast) **must bump `SAVE_VERSION`**. A bumped version makes every
older save fail the `v === SAVE_VERSION` check and fall through to a clean fresh
start — no migration code, no resuming a v1 run into a v2 engine. This is the
whole reason the version field ships now.

---

## The one limitation (documented, not fixed)

Moves queued mid-week (the queue-on-tap flow) and an **unanswered event**
(`S.phase==='event'`) are not separately persisted. If the tab closes after some
taps but before "End the week," the run resumes at that week's clean start with a
**freshly dealt hand** (different RNG). This is acceptable for Step 1: the save
guarantees the *run*, not an in-progress week. Cross-event/mid-week snapshotting
(saving on entering `phase==='event'` and restoring a pending decision) is
deliberately out of scope — it complicates restore for a marginal case.

---

## Privacy

`/privacy` (`privacy.html`) already covers on-device `localStorage` for game
state (mute, unlock flags, found endings). Add one clause to the same section
noting that **an in-progress game is saved on your device so you can continue it
later, and is erased when the run ends** — never sent anywhere. Bump the "Last
updated" date in the privacy hero eyebrow. No new processor, no cookie, no
consent-banner trigger (per the site's analytics/privacy conventions).

---

## Out of scope (belongs to later Step 1 sub-projects)

- **The clock reposition** ("~10 minutes" → "~20 minutes" across
  `the-feed.html` meta/OG/Twitter/kicker, `tools.njk`, `tool-index/the-feed.md`
  `time`). The 15–25 min *target* is the recorded project decision; the copy edit
  ships with **Acts**, the first sub-project that actually lengthens the run, and
  is confirmed against the Plausible `start`→`end` median so the copy is true
  when it changes. The `week:10/26/40` funnel milestones are week-based, not
  time-based, and do not move with the clock.
- **Acts (Pillar 1), Team-as-characters (Pillar 2), the hall (5a).** Separate
  specs.
- **Mid-week / pending-event resume.** See "The one limitation."

---

## Verification

Chrome/HTML only — `the-feed-engine.js`, the sim, and the tests are **not**
touched (engine tests stay at their current count; `npm run sim` unaffected — no
`CONFIG` or engine change). Verify in the browser preview (`the-feed.html`):

1. Start a run, play a few weeks, reload the page → start overlay shows
   **Continue — …week N**; Continue lands on that week with correct followers,
   cash, stress, rep, trend charts, channel-card art, and feed scrollback.
2. Reach an ending → reload → no Continue button (save cleared); endings gallery
   still shows the newly found ending.
3. With a saved run, choose New run → confirm prompt appears; confirming starts
   fresh and the old save is gone; cancelling leaves the save intact.
4. Corrupt the blob by hand (`localStorage.thefeed_save = 'garbage'`) → reload →
   no crash, start overlay falls back to fresh, no Continue.
5. Simulate a version bump (temporarily set `SAVE_VERSION` higher than the
   stored `v`) → reload → save ignored, fresh start, no crash.
6. Phone width (~375px) and desktop (≥980px): the Continue/New-run buttons lay
   out correctly in the start overlay at both.

---

## Sequencing within Step 1

1. **This sub-project (save).** Ships alone.
2. **Acts (Pillar 1).** Bumps `SAVE_VERSION`; ships the clock reposition.
3. **Team-as-characters (Pillar 2).** Bumps `SAVE_VERSION`; reworks the sim's
   dealt-hand hiring.
4. **The hall (5a).** Folds onto the last of the above, using the existing
   end-screen "how you got here" path line as each run's stored one-liner
   (upgraded to Pillar 4's audience-memory sketch when Step 2 lands).
