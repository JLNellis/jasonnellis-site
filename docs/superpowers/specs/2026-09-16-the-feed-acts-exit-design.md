# The Feed — Acts, part 2b: the Act III exit decision — design (2026-09-16)

**Status:** design, awaiting review. Third Step-1 sub-project (Pillar 1, part 2b),
and the marquee of the Acts work. Builds on Acts 2a
(`2026-09-16-the-feed-acts-structure-design.md` / PR #2) and the mid-run save.

**Decisions captured (from brainstorming):**
- The exit **ends the run early, steered to one of the existing eight endings** —
  never a ninth (Fixed point 3 of the vision doc).
- It **appears guaranteed once, late in Act III** (the climax), not left to the
  random event roll.
- It is a **single climactic event** with three choices, not a multi-beat chain.
- **The sim's balance personas decline it** — it's a player narrative choice, not a
  balance lever — so 2b does not perturb the 6 sim targets.

---

## Goal

Give the run a real ending decision — *what did it cost, and what's next?* — instead
of only a threshold reached at week 52 or a failure state. Around week 46, every
Act III run faces one guaranteed fork: **sell the channel**, **go independent**, or
**keep climbing**. The first two end the run now with an existing ending steered by
how you got here; the third plays the year out. This is the decision the flatline
was missing, and it makes the eight endings read as *paths you authored* rather than
numbers you cleared.

---

## Fixed points this lives inside

- **Eight endings stay eight.** The exit *reaches* `sellout` / `legend` / `faded` —
  it never adds one. The failure endings (cancelled / bankrupt / burnout) and the
  year-end growth endings (goat / star / legend / faded) all still resolve exactly
  as today for anyone who declines the exit.
- **No economy/formula change.** No `CONFIG` knob edits except one new constant
  (`exitWeek`). The only mechanical change to the core loop is a one-line guard in
  `checkEndings` that honors an event-set ending.
- **The sim stays the contract for balance.** Personas decline the exit, so the 6
  targets are unchanged and stay meaningful about the core loop. The exit's own
  feel (is each path a fair, legible outcome?) is a design/playtest question, not a
  sim target.
- **Save-compatible.** The only new state is `S.flags.exitOffered` (absent = not yet
  offered), so a 2a v2 save resumes cleanly. **No `SAVE_VERSION` bump.**

---

## What gets built

### 1. The forced exit event (engine)

A single event, `id: 'the-exit'`, authored in the game's voice — the moment the
run has been building to. It is **guaranteed once** in late Act III by a pre-empt
at the top of `rollEvent(S)`:

```
function rollEvent(S) {
  // The Act III exit is guaranteed once, late in the run — it pre-empts the random roll.
  if (S.week === CONFIG.exitWeek && !S.flags.exitOffered) {
    S.flags.exitOffered = S.week;
    const ev = EVENTS.find(e => e.id === 'the-exit');
    S.seenEvents.push(ev.id);
    return ev;
  }
  if (!(S.week >= 2 && chance(CONFIG.eventChance))) return null;
  ... // unchanged
}
```

- `CONFIG.exitWeek = 46` — late enough to be a climax and to have real state to
  steer on, early enough that "keep climbing" still leaves ~6 weeks of consequence.
- It fires regardless of `eventChance`, exactly once (the `exitOffered` flag), and
  pre-empts any random event that week (the offer takes precedence over noise).
- The event is not `repeatable` and is pushed to `seenEvents` so nothing re-draws
  it.

### 2. The three choices, steered by state (engine)

Each choice's `apply(S)` uses only existing helpers. The two exits end the run by
setting `S.over` / `S.endKey`; "keep climbing" returns a normal log and the run
continues.

- **Sell the channel** *(tag: `escalate`)* — a buyout hits the bank, then the run
  ends as **`sellout`**. `apply`: `const buyout = Math.round(totalFollowers(S) * <rate>); S.cash += buyout; S.grossEarned += buyout; S.flags.exitChoice = 'sold'; S.over = true; S.endKey = 'sellout';` plus a cash float + a feed line ("You sold. The check cleared. The channel is someone else's problem now."). Selling *is* selling out — the existing `sellout` ending copy fits ("you became an ad in human form / cashed out"). The buyout makes the choice tangible on the end screen's Bank line. Starting `<rate>`: about `$3 × followers` (a plausible channel-sale multiple) — flavor only, tuned for feel not balance, since the run ends.
- **Go independent** *(tag: `neutral`)* — walk away on your own terms; the outcome
  keys on whether you built something you own. `apply`: if an owned audience exists
  (`S.members > 0 || S.plats.writing.active`) **and** `S.rep >= <indieRep>` (starting value **50** — a notch below `legendRep`'s 55, since walking away clean is a softer bar than grinding to Legend) →
  `S.endKey = 'legend'` ("you left with the audience that was actually yours"); else
  → `S.endKey = 'faded'` ("you jumped, and there was no floor to land on"). Set
  `S.flags.exitChoice = 'independent'`, `S.over = true`. This makes the owned-audience
  + reputation you built *matter at the exit* — a preview of Pillar 3a's "owned
  audience is the hedge," delivered here for free.
- **Keep climbing** *(tag: `repair`)* — decline the offer, play the year out. `apply`
  does **not** set `S.over` and makes **no state change at all** — a feed line only
  ("You turned it down. The work isn't finished."). Zero economy effect is deliberate:
  the sim's personas all pick this choice (§4), so a null effect guarantees the sim
  measures exactly the pre-2b core loop. The run continues to week 52 and resolves
  normally (goat / star / legend / faded by the existing thresholds, or a late failure
  ending). The trade-off is inherent: decline to gamble on a bigger year-end ending,
  at the risk of burning out or fading instead.

**Why these tags:** the sim already special-cases the exit (personas decline — see
§4), so the tags are chosen for the *player-facing* reply order and for honest
semantics (the reparative "keep doing the work" reads as `repair`; the dramatic
cash-out as `escalate`), not to steer the sim.

### 3. The `checkEndings` guard (engine — the one-line core)

`checkEndings(S)` currently recomputes the key every call. Add, as its first line:

```
function checkEndings(S) {
  if (S.over && S.endKey) return S.endKey;   // honor an ending an event already decided (the exit)
  ... // unchanged
}
```

The exit's `apply` runs in the week loop (`settleWeek → rollEvent → applyEventChoice
→ advanceWeek → checkEndings`); after "sell" or "go independent" sets
`S.over`/`S.endKey`, the very next `checkEndings` returns it and the game ends with
that ending. This is the entire mechanism the vision doc's "steer to one of the
existing eight" needs, and it changes nothing for a run that never sets those.

### 4. Sim handling — personas decline (sim)

In `tools/the-feed-sim.js` `resolveEvent`, special-case the exit so every persona
keeps climbing:

```
function resolveEvent(S, ev, persona) {
  if (ev.id === 'the-exit') { /* pick the 'keep climbing' choice index */ return; }
  ... // unchanged tag-preference logic
}
```

Result: the sim measures the core loop exactly as before 2b (no early exits, no
economy change), so the **6 targets stay green with no retune**. Add a
deterministic engine test that the exit is forced at `exitWeek`, that each exit
choice sets the right `endKey` for representative states, and that "keep climbing"
leaves `S.over` false.

### 5. End-screen acknowledgment (chrome — light)

The exit steers to an *existing* ending, so the existing end screen renders. Add a
**single-line acknowledgment** so the payoff reads as chosen, not stumbled into:
when `S.flags.exitChoice` is set, the end screen's existing "how you got here" path
line gains a clause — "…and you took the buyout in week 46" / "…and you went
independent in week 46." Pure chrome reading `S.flags`; no new ending, no new screen.
(The richer character sketch is Pillar 4 / Step 2 — not here.)

---

## Engine / chrome / sim split

- **Engine (`the-feed-engine.js`):** `CONFIG.exitWeek`; the `the-exit` event (data +
  the three `apply`s); the `rollEvent` pre-empt; the one-line `checkEndings` guard.
- **Sim (`tools/the-feed-sim.js`):** the `resolveEvent` decline special-case.
- **Tests (`tools/the-feed-test.js`):** forced-at-`exitWeek`; each choice's steering;
  keep-climbing leaves the run alive; `checkEndings` honors a pre-set ending.
- **Chrome (`the-feed.html`):** the one-line end-screen path acknowledgment. The
  event itself renders through the existing event UI unchanged.
- **Docs:** `the-feed-BACKLOG.md` note.

## Save compatibility

The only new state is `S.flags.exitOffered` / `S.flags.exitChoice`, both absent-means-
default. A 2a v2 save resumes without a bump: if it's already past week 46 the exit
simply won't fire (acceptable — the offer is a one-time moment), and a save before 46
gets it normally. **`SAVE_VERSION` stays 2.**

---

## Out of scope

- **Team-as-characters (Pillar 2)** and **the hall (5a)** — later sub-projects.
- **Pillar 4's audience-memory character sketch** — the exit sets a flag the future
  sketch can read, but 2b ships only the one-line path acknowledgment.
- **Economy/mechanic flips per act** — still cut.
- **A "sold gracefully / cashed out" ninth ending** — explicitly not; sell → the
  existing `sellout`.

---

## Verification

- **Engine:** `npm test` grows — the exit is forced exactly at `exitWeek` (not week
  45 or 47), fires once, and pre-empts the roll; "sell" ends as `sellout` with the
  buyout banked; "go independent" ends as `legend` with an owned audience + rep and
  `faded` without; "keep climbing" leaves `S.over === false`; `checkEndings` returns
  a pre-set `endKey`. All green.
- **Balance:** `npm run sim` on seeds 7/42/123 → still **6/6, no retune** (personas
  decline). Confirm the ending mix is unchanged vs. 2a.
- **Browser (`the-feed.html`):** play/fast-forward into Act III to week 46 → the exit
  event appears once as the week's event; "keep climbing" returns to the game and the
  run continues; "sell" ends the run on the `sellout` screen with the buyout in the
  Bank stat and the path line noting the buyout; "go independent" ends on `legend`
  (with a newsletter/members + rep) or `faded` (without); no console errors (the
  IIFE-load check). The exit fires under a resumed v2 save too.

---

## Sequencing

1. **This sub-project (2b).** Completes Pillar 1 (Acts). No `SAVE_VERSION` bump.
2. **Team-as-characters (Pillar 2).**
3. **The hall (5a)** — folds on last; the exit's `exitChoice` flag is one more thing
   the stored character sketch can read.
