# The Feed — Acts, part 2a: structure, transitions, late-act decks — design (2026-09-16)

**Status:** design, awaiting review. Second sub-project of "Step 1" from the v2
evolution vision (`2026-09-15-the-feed-v2-evolution-vision.md`, Pillar 1), and the
first of the two Acts specs. It builds on the shipped mid-run save
(`2026-09-15-the-feed-mid-run-save-design.md` / PR #1) and **must** land on top of
it (it bumps `SAVE_VERSION`).

**Decisions captured (from brainstorming):**
- Acts scope is **content + structure on the existing engine — no economy/slot/
  stress flips.** Depth comes from new decisions and late-act variety, not harder
  numbers.
- Acts is **split into 2a (this spec) and 2b.** 2a = the act framework, telegraphed
  transitions, the late-act deck expansion, the platform-dependency arc, and the
  clock reposition. **2b (separate spec) = the Act III exit decision** that ends a
  run early with a steered existing ending.
- The session-length target is **15–25 minutes**; this is the increment that adds
  the length, so the clock copy reposition ships here.

---

## Goal

Make the back half of a run stop playing like the front half. Give the 52 weeks
three legible **acts** with telegraphed transitions and enough **act-gated event
variety** — concentrated in Act III — that "the same after day 20" becomes
structurally impossible, plus one **seed→harvest arc** (platform dependency) that
makes an Act I/II choice come back in Act III. Reposition the clock copy to match
the now-longer sitting.

This is the direct antidote to the playtester's real complaint (structural
repetition), minus the marquee exit decision, which is 2b.

---

## Fixed points this lives inside

- **Engine stays economy-stable.** No changes to slots, stress economy, overhead,
  post math, or ending thresholds. The only engine additions are a small `act(S)`
  helper and new **event data** (which is balance-relevant and re-simmed, but not a
  formula change). The 6 `npm run sim` targets stay green.
- **The week loop is untouched.** Still 2 content + 1 business (3 with the studio).
- **Eight endings stay eight.** 2a adds no endings and no ending steering (that's
  2b). The transition beats and new decks change *texture*, not outcomes.
- **The save's version gate does its job.** 2a changes the shape of `S` (new
  flags, and the act framework), so it **bumps `SAVE_VERSION` to 2**; a v1 save from
  the save-only build is cleanly retired (fresh start), exactly what the version
  gate was shipped for.
- **Honest to the real world.** New events are checked against the cadence
  precedent; nothing contradicts what creator data shows.

---

## What gets built

### 1. A first-class act concept (engine)

Today `CONFIG.phases = { earlyEnd: 17, midEnd: 35 }` only drives backdrop art.
Add and export a pure helper:

```
act(S)  ->  1 | 2 | 3     // week ≤17 → 1 · ≤35 → 2 · else 3   (reads CONFIG.phases)
```

Also export the act boundaries/labels so the UI and the deck read one source of
truth. The three acts are named: **I — "Nobody's watching" (1–17)**, **II — "The
business" (18–35)**, **III — "The ceiling" (36–52)**. No new boundaries — this is
the existing phase split, promoted to a named concept the rest of the game reads.

### 2. Telegraphed transition beats (chrome)

When the run crosses into a new act (into week 18, and into week 36), the game
shows a **one-time transition beat** — a brief titled overlay/banner in the game's
own voice that names the shift and resets the mental model (the vision doc's
guard against transitions reading as difficulty spikes):

- Into Act II: *"The business."* You're not a person with a hobby any more; the
  numbers have overhead attached now.
- Into Act III: *"The ceiling."* Growth gets harder, the audience knows what it
  wants from you, and the decisions get sharper.

**Delivered as chrome, not an engine event:** `the-feed.html` detects the act
change in `advance()` (comparing `E.act(S)` before/after the week ticks) and shows
the beat once, guaranteed — no dependence on the random event roll firing that
week. A per-run "beats seen" set (UI state, persisted with the save) prevents a
repeat after a reload. Dismissible; it never blocks a decision. Copy is authored
deadpan, in the game's established tone.

### 3. Late-act deck expansion — the flatline killer (engine data)

The deck is 30 cards with light `minWeek`/`maxWeek` gating. Act III (36–52)
currently reuses too much of the same pool, which *is* the "same after day 20"
feeling. Author **~12–16 new act-gated event cards**, weighted heavily toward
Act III, on the Act III themes the vision doc names — **ceiling pressures,
algorithm dependency at scale, a calcified audience that expects a specific you,
reinvent-or-coast** — plus a few Act II cards so the middle also gains texture.

- Each card follows the existing `EVENTS` shape (`id`, `kind`, `title`, `badge`,
  `cond`/`minWeek`/`maxWeek`, `text`, `choices[]` with `t` tags + `stakes` + pure
  `apply(S)`), so they ride the shipped consequence engine with zero new
  machinery.
- The writing is the product: I draft all new cards in the game's deadpan,
  specific voice for Jason's edit; they ship for his review, not as final text.
- Balance: new cards have real follower/cash/rep effects, so **`npm run sim` is
  re-run (seeds 7/42/123) and the 6 targets must stay green**; tune the new cards'
  numbers until they do. No `CONFIG` economy knob changes.

### 4. One seed→harvest arc: platform dependency (engine flag + events)

The vision doc's model — *"the platform you built on is the one the algorithm
turns on."* A `concentrated` signal is derived (a creator whose strongest platform
holds the large majority of their followers by late Act II) and recorded as a flag;
an Act III **"the platform you built on turned on you"** event reads it and bites
**hardest on that platform** (a reach/algorithm event whose severity keys on
concentration). A creator who spread has a softer version; a concentrated creator
feels the seed they planted in Act I harvested in Act III.

- Pure flag + `cond`/`apply` on the existing engine (like the shipped
  `crypto-fallout`→`soldOut` and `receipts`→`roasted` echoes). No economy change;
  the follower effect is tuned in the sim like any other event.
- This is the **only** new arc in 2a. Hire/deal drift belongs to Team-as-characters
  (a later sub-project), and the exit is 2b.

### 5. Clock reposition (chrome/content)

This increment adds the length, so the "~10 minutes" copy moves to the honest new
figure. Reposition all six surfaces to **"about twenty minutes"** (the midpoint of
the agreed 15–25 target):

- `the-feed.html` meta description (`:13`), `og:description` (`:17`),
  `twitter:description` (`:25`), start-screen kicker (`:688`).
- `tools.njk` (`:86`, "makes that felt in ten minutes").
- `tool-index/the-feed.md` front-matter `time: "About 10 min"` → `"About 20 min"`.

The `week:10/26/40` Plausible milestones are **week-based, not time-based**, so
they do not move. After ship, the number is trued-up against the live Plausible
`start`→`end` median (the vision doc's "How we'll know" clock watch); "about twenty
minutes" is the first honest estimate, adjustable once real data exists.

---

## Engine / chrome split (so the change is legible)

- **Engine (`the-feed-engine.js`):** add + export `act(S)` and the act
  labels/boundaries; add the new `EVENTS` cards (items 3 and 4); add the
  `concentrated`-style flag that the platform-dependency event reads. **No `CONFIG`
  economy knobs change.** Engine tests get new cases (act helper boundaries; the
  platform-dependency event's cond/effect; new-card phase gating and non-repeat).
- **Sim (`tools/the-feed-sim.js`):** no persona logic change is required (new cards
  resolve by their `t` tags through the existing `resolveEvent`), but the run is
  re-simmed and the 6 targets confirmed green; retune new-card numbers only.
- **Chrome (`the-feed.html`):** the act-transition beat overlay + its "beats seen"
  state (saved), reading `E.act(S)`; the clock copy; wire `SAVE_VERSION` bump to 2.
- **Other files:** `tools.njk`, `tool-index/the-feed.md` (clock copy);
  `the-feed-BACKLOG.md` gets an "Acts (2a) shipped" note.

## The save interaction (why SAVE_VERSION bumps)

2a adds run state that a v1 save doesn't have (the transition-beats-seen set, the
platform-dependency flag, and any act bookkeeping). Rather than migrate, **bump
`SAVE_VERSION` 1 → 2**. A v1 save then fails `validSave` and is discarded to a
clean fresh start — the exact forward-compat behavior the save sub-project shipped
for. (A player mid-run when 2a deploys loses that one in-progress run; acceptable
and expected for a version bump, and the norm for a live web game gaining a major
update.)

---

## Out of scope (later sub-projects)

- **The Act III exit decision** (sell / go independent / keep climbing, ending the
  run early with a steered existing ending, and the one-line `checkEndings`
  change). That is **2b**, the next spec.
- **Economy/mechanic flips per act** (Act III overhead ramps, etc.) — explicitly
  cut in brainstorming; this increment is content + structure only.
- **Team-as-characters drift** (the roommate-editor drowns at scale, the edgy
  hire's backlash) — a separate Step 1 sub-project.
- **The hall (5a)** — folds on last, using the existing end-screen path line.

---

## Verification

- **Engine:** `npm test` grows with new deterministic cases (act boundaries; the
  platform-dependency event fires only when concentrated + in Act III; new cards
  respect phase gating and per-run non-repeat) and stays fully green.
- **Balance:** `npm run sim` on seeds 7/42/123 — the 6 targets stay green after the
  new cards are tuned; record the before/after ending mix in the plan.
- **Browser (`the-feed.html`, served at `http://localhost:8080/the-feed.html`):**
  crossing into week 18 and week 36 shows the transition beat once and not again
  after a reload; Act III surfaces the new cards (spot-check by playing/among seeds);
  the platform-dependency event lands for a concentrated run; a v1 save is discarded
  (Continue absent) after the `SAVE_VERSION` bump, a v2 save resumes; no console
  errors (the IIFE-load check from the save plan). Mobile + desktop for the beat
  overlay.
- **Clock copy:** all six surfaces read "about twenty minutes"; `npm run build`
  clean.

---

## Sequencing

1. **This sub-project (2a).** Lands on top of the save; bumps `SAVE_VERSION` to 2.
2. **2b — the Act III exit decision.** The `checkEndings` change + the exit event +
   endings steering + sim handling. Bumps `SAVE_VERSION` again if it adds state.
3. **Team-as-characters (Pillar 2).**
4. **The hall (5a).**
