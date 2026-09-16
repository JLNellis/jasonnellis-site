# The Feed — the hall ("creators you've been") (5a) — design (2026-09-16)

**Status:** design, awaiting review. Sixth and **final Step-1 sub-project** (vision
doc Pillar 5, part 5a). Builds on the mid-run save and the shipped end screen.
Small, chrome-only, on-device — the vision doc's "about a day's work."

**Decision captured earlier (in the save spec):** 5a was written to store "the
Pillar 4 character sketch," but Pillar 4 (audience-memory) is Step 2. So the hall
stores each run's **existing end-screen "how you got here" path line** (already
shipped, and enriched by the Acts exit clause), plus name / niche / platform /
ending. When Pillar 4's richer sketch lands, the bio upgrades to it for free.

---

## Goal

Make the "story you authored" thesis visible **across runs**: the end screen grows a
**"Creators you've been"** shelf listing your past completed runs as short bios. It
gates nothing, changes no balance, adds no new *kind* of stored data (same
`localStorage` the endings gallery already uses), and it's the cheap payoff that
turns single runs into a small collection — without the identity shift of the Big
Bet (5b), which stays out.

---

## Fixed points this lives inside

- **On-device, cookieless, privacy-clean.** A new `localStorage` key alongside the
  existing `thefeed_endings` / `thefeed_save` / `thefeed_muted`. Never leaves the
  device; `/privacy` gets one clause. Same principles as everything else.
- **Gates nothing, changes no balance.** No engine/sim/test change — this is
  entirely `the-feed.html`. Not a new ending, not a start-screen gate (Fixed point
  4 of the vision doc: run #1 is never a demo).
- **Not the Big Bet.** 5a is the read-only shelf. Archetype unlocks / New Game+ (5b)
  are explicitly out — the hall stores state but *uses* none of it to change a run.
- **Forward-compatible with Pillar 4.** The stored bio uses the existing path line
  now; the record leaves room for a richer `sketch` field later without a data
  migration.

---

## What gets built

### 1. Store a bio when a run ends (chrome)

In `endGame(key)`, after the ending is resolved, append a compact record for the
completed run to `localStorage.thefeed_hall` (a JSON array, most-recent-first,
**capped at ~12** to bound storage — drop the oldest beyond that):

```
{
  name,                       // the run's persona name
  niche,                      // niche key
  home,                       // the platform they built on (strongest at end) — key
  endKey,                     // e.g. 'legend' / 'sellout' / 'faded'
  followers,                  // total at end
  exitChoice,                 // 'sold' | 'independent' | undefined (from Acts 2b)
  ts                          // Date.now()
}
```

Wrapped in `try/catch` like the other `localStorage` writes; a blocked/full store
just skips silently. This is the only new stored data, and it's derived entirely
from state the end screen already has.

### 2. The "Creators you've been" shelf (chrome)

The end screen grows a shelf (below the endings gallery, above or beside the CTA —
tuned in the plan) that renders the stored bios, most recent first, **this run
included** (stored first, then the shelf reads the array). Each bio is one compact
line built from the record — e.g.:

> **"midnight uploads"** — Niche legend · 41K followers · Gaming on Longform

with the ending's icon/colour (reusing `END_ICON`) and, when set, the exit clause
("· went independent"). The shelf reads the record fields and renders — it does
**not** store rendered HTML. Empty on a first-ever run (only this run shows);
grows over a browser's history of runs. A small "N runs" count fits the existing
gallery's style.

*(Optional, plan's call: a compact peek of the same shelf on the start screen for
returning players. The vision doc specifies the end-screen shelf; the start-screen
peek is a nice-to-have, not required for 5a.)*

### 3. Privacy clause (chrome/content)

`/privacy` already covers on-device game state (endings found, mute, the in-progress
save). Add the hall to the same "Storage in your browser" clause — "and a short
list of your past runs, so you can see the creators you've been" — never sent
anywhere, cleared with site data. Bump the "Last updated" date if the ship date
differs from it.

---

## Engine / chrome split

- **Chrome only (`the-feed.html`):** the `thefeed_hall` read/write helpers (mirroring
  `foundEndings`), the store call in `endGame`, and the shelf render in the
  end-screen build. The bio uses fields the end screen already computes (`S.name`,
  `S.niche`, the built-on platform, `key`, `totalFollowers()`, `S.flags.exitChoice`).
- **Engine / sim / tests:** untouched.
- **Content:** the `/privacy` clause.
- **No `SAVE_VERSION` interaction** — the hall is its own key, separate from the save
  blob, purely additive.

## Verification

- **Browser (`the-feed.html`):** finish a run → the "Creators you've been" shelf shows
  it (name, ending, followers, niche/platform, exit clause when relevant); finish a
  second, different run → both appear, most recent first; the shelf survives a reload
  (persisted) and is independent of the mid-run save (clearing the save doesn't touch
  it); a fresh browser (empty `thefeed_hall`) shows just the current run; the cap holds
  at ~12 (older runs drop). IIFE clean, no console errors. Mobile + desktop. `/privacy`
  renders the new clause; `npm run build` clean.
- No engine work, so `npm test` / `npm run sim` are unchanged (a guard that the engine
  wasn't touched).

---

## Out of scope

- **Archetype unlocks / New Game+ (5b)** — the Big Bet; a separate, later fork the
  vision doc gates on the replay numbers.
- **Pillar 4's audience-memory character sketch** — Step 2; the bio uses the path
  line until then.
- **A start-screen gate or any balance/engine change.**

---

## Sequencing — this closes Step 1

The hall is the **last Step-1 sub-project**. After it ships, Step 1 (the flatline
fix: save + Acts + Team + the hall) is complete, and the vision doc's plan is to
**read the Plausible numbers** — the flatline drop between `week:26` and `week:40`,
and the replay rate (`end:<key>` → `start`) — before deciding whether and how far to
pursue Steps 2–4 (owned-audience insurance + audience memory, niche/platform builds,
and the 5b Big Bet).
