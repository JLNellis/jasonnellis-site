# The Feed — Team-as-characters, part 2b: drift-with-scale + morale — design (2026-09-16)

**Status:** design, awaiting review. Fifth Step-1 sub-project (Pillar 2, part 2b) —
completes Team-as-characters. Builds on Team 2a (the dealt cast, PR #4) and the
consequence engine (`S.flags` + `priority` events) from Acts. This is the payoff of
the cast: the playtester's exact stretch idea — *"hire your college roommate as an
editor early on, but they flounder as the channel gets bigger… an edgy hire that
causes backlash later."*

**Decisions captured (from brainstorming):**
- **Focused scope:** author the two marquee arcs the playtester named — the
  **roommate-editor drowning at scale** and the **edgy-designer backlash detonating**
  — plus the two systemic mechanics: **morale** (overworked hires threaten to walk)
  and **firing thins the candidate pool**. The other six characters keep their 2a
  traits; bespoke arcs for them are a possible follow-up, not 2b.
- **Morale = talk-down-or-lose:** sustained high stress → one event where an
  overworked hire threatens to quit; pay/rest to keep them, or let them go.

---

## Goal

Turn the cast from a set of static modifiers into **relationships that change over a
run**: the loyal cheap hire you took early can't keep up once you're big; the edgy
hire you took for reach eventually costs you; and a team you run into the ground
starts to leave. Every one of these is a **discrete flagged event** on the existing
engine — a decision with a trade-off — never a bar on screen.

---

## Fixed points this lives inside

- **No continuous "morale/XP" stat.** Drift and morale are delivered as **discrete
  priority events** gated on flags/counters, exactly the machinery Acts used. The
  only new state is a couple of flags and one hidden stress-streak counter (never
  displayed) — the vision doc's explicit line.
- **The cap holds.** No new characters; 2b adds arcs to the existing 8-character cast.
- **The sim stays the balance contract.** Unlike the Acts exit (which personas
  declined), these events *fire on* personas that hired the relevant characters and
  cost them cash / modifiers, so `npm run sim` is re-run and the 6 targets kept green
  (seeds 7/42/123) — real balance work.
- **Save-compatible — no `SAVE_VERSION` bump.** Every new field (`S.flags.*`, the
  stress-streak counter) is absent-means-default, so a Team-2a **v3** save resumes
  cleanly. `SAVE_VERSION` stays 3.

---

## What gets built

### 1. The roommate-editor drowns at scale (engine event)

A **priority event**, fired once, gated on `S.hires.editor === 'editor-roommate'`
**and** the channel having outgrown them (e.g. `totalFollowers(S)` past a scale
threshold, ~40–50K, or `act(S) >= 2` with real size — tuned in the plan). Sets a
`roommateDrift` flag so it fires once. Framed warmly: your friend is in over their
head at this size.
- **Level them up** *(repair)* — pay cash for help/training; the roommate holds on
  (you keep the editor). "Cash + a beat" — a warm outcome, they grow into it. No `fx`
  change (the payoff is narrative + retention).
- **Let them go** *(escalate)* — lose the editor (`S.hires.editor = null`) and eat a
  **rep hit** (you cut your friend, and it shows). You can re-hire a better editor
  from the pool later — at the re-hire cost, and the firing thins the pool (§4).

### 2. The edgy-designer backlash detonates (engine event)

A **priority event**, fired once, gated on `S.hires.designer === 'designer-edgy'`
**and** `act(S) >= 2`. Sets an `edgyDetonated` flag. The louder packaging you took for
reach finally triggers a real backlash — a **rep + follower hit** (the 2a `edgy` flag
already made everyday hostile events bite harder; this is the signature blow-up).
- **Stand by them** *(escalate)* — keep the designer, eat the full hit (you doubled
  down on the bit).
- **Rein it in / let them go** *(repair)* — a smaller hit, but you lose the edgy reach
  (fire the designer, or a lasting `fx` dampening — plan decides; simplest is fire +
  the reduced hit).

### 3. Morale — talk-down-or-lose (engine: counter + flag + event)

- **The counter (hidden):** in `settleWeek`, increment a `hiStressStreak` when the
  week's band is fumes or redline, reset to 0 otherwise — mirroring the existing
  `redlineStreak`. Never displayed.
- **The flag:** once `hiStressStreak >= N` (tuned, ~3–4) **and** `hireCount(S) >= 1`,
  a `morale` flag becomes eligible.
- **The event** *(priority when `morale`)*: an overworked hire (a random current one)
  says they can't keep this up.
  - **Talk them down** *(repair)* — pay cash (a bonus / time off) and/or take a stress
    hit yourself; keep them, and the streak resets.
  - **Let them walk** *(escalate)* — lose that hire's modifier (`S.hires[role]=null`)
    and a **rep hit**; the pool thins (§4).
  Clears the `morale` flag either way.

### 4. Firing thins the candidate pool (engine: flag + dealTeamHand)

`biz.fire` (and any "let them go" above) sets `S.flags.firedRecently = S.week`. For
~N weeks after, **word gets around**: `dealTeamHand` (from 2a) offers **fewer
candidates** (deal 1–2 instead of 2–3) while `firedRecently` is recent. A small,
honest roguelike consequence — churning your roster costs you options for a while.

---

## Engine / chrome / sim split

- **Engine (`the-feed-engine.js`):** the two arc events + the morale event added to
  `EVENTS` (with `cond`/`priority`); the `hiStressStreak` counter in `settleWeek`; the
  `firedRecently` flag in `biz.fire` (and the "let go" branches); `dealTeamHand` reads
  `firedRecently` to shrink the hand. No `CONFIG` economy knob changes beyond adding
  a couple of tuning constants (the scale threshold, the streak N, the pool-thin
  window).
- **Sim (`tools/the-feed-sim.js`):** likely no persona logic change — the new events
  resolve by their `t` tags through `resolveEvent`. Re-run and tune the event numbers
  to keep 6/6; the Sustainable (hires the roommate) will now hit the drift arc, so
  watch its Legend rate; the firing-thins-pool may change hire counts.
- **Chrome (`the-feed.html`):** minimal — the events render through the existing event
  UI unchanged; the Team panel already reads `hiredChar`, so a fired/quit role simply
  shows empty. No new panel work. (No `SAVE_VERSION` bump.)
- **Docs:** `the-feed-BACKLOG.md` note.

## Save

No `SAVE_VERSION` bump. New state (`S.flags.roommateDrift`/`edgyDetonated`/`morale`/
`firedRecently`, `S.hiStressStreak`) is all absent-means-default, so a v3 save resumes
fine — if it's already past a trigger, that one arc just won't fire.

---

## Out of scope

- **Bespoke signature events for the other six characters** (pro editor, steady
  designer, manager, mod, producer, analyst). Possible follow-up; not 2b.
- **A morale meter / staff XP.** Explicitly not — flags + a hidden counter only.
- **The edgy designer's everyday amplifier** already shipped in 2a (`edgy` flag in
  `repHit`); 2b adds only the one-time detonation.
- **The hall (5a)** — the final Step-1 sub-project.

---

## Verification

- **Engine/tests:** `npm test` grows — the roommate-drift event is eligible only with
  the roommate hired past the scale threshold and fires once; "let them go" clears the
  role + hits rep; the edgy detonation is eligible only with the edgy designer in act
  ≥ 2 and fires once; `hiStressStreak` counts consecutive fumes+ weeks and resets; the
  morale event needs the streak + a hire; `biz.fire` sets `firedRecently`;
  `dealTeamHand` deals fewer while `firedRecently` is recent.
- **Balance:** `npm run sim` seeds 7/42/123 → 6/6 after tuning; record the Sustainable
  (roommate path) and overall hire/ending mix vs. the Team-2a baseline.
- **Browser (`the-feed.html`):** hire the roommate editor, grow past the threshold →
  the drift event lands; "let them go" empties the editor seat and the next hand is
  thinner; run the team into fumes for several weeks → the morale event fires and a
  hire can walk; no console errors (IIFE-load check). A v3 save resumes.

---

## Sequencing

1. **This sub-project (Team 2b).** Completes Pillar 2. No `SAVE_VERSION` bump.
2. **The hall (5a)** — the last Step-1 sub-project: past runs persist as short bios on
   the end screen, reading the existing path line + the exit/character flags.
