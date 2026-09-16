# The Feed — Team-as-characters, part 2a: the dealt cast + traits — design (2026-09-16)

**Status:** design, awaiting review. Fourth Step-1 sub-project (Pillar 2, part 2a).
Builds on the mid-run save and Acts (Pillar 1). This is the direct fix for the
playtester's sharpest note: *"hires are safe bets with no trade-offs — I never had
to fire somebody to bring somebody on."*

**Decisions captured (from brainstorming):**
- Team-as-characters is **split**: **2a (this spec) = dealt hiring + the capped cast
  with traits**; **2b (later) = drift-with-scale + morale-as-flag** (the per-character
  signature arcs).
- Hiring is **dealt, not shopped**: opening Team shows **this week's 2–3 candidates**,
  fixed within the week and varying week to week — you take what's on offer.
- **No continuous stat.** Traits are discrete modifiers; drift/morale (2b) are
  discrete flagged events. The cap (≤10 characters) is the fence against a
  personality sim.

---

## Goal

Turn the six always-available role modifiers into a **small authored cast dealt as a
roguelike shop**: each week the Team panel offers 2–3 candidates (role × character ×
price), and each hire is a **bet, not a strict upgrade** — the cheap loyal one, the
expensive pro, the edgy one. You don't always get the safe pick, and filling a role
means passing on whatever else was offered. This makes the roster a set of *choices
with trade-offs* instead of a checklist, which is exactly what the playtester asked
for.

---

## Fixed points this lives inside

- **The cap is the fence.** ≤10 characters across the six existing roles; each is one
  role-instance with **one trait** (a varied modifier + price). No character has more
  than its one mechanical hook. Drift and morale arcs are 2b.
- **No continuous "staff XP / morale" stat.** 2a is purely the dealt cast + traits.
- **The six roles stay six.** A character *fills* an existing role (editor, manager,
  mod, designer, producer, analyst); role-uniqueness holds (one editor at a time).
  The hire cap (`hireCap`, 2/3/4/6 by studio) is unchanged.
- **The sim stays the balance contract.** The dealt hand changes how personas hire,
  and traits change effect magnitudes, so `npm run sim` is re-run and the 6 targets
  kept green (seeds 7/42/123) — real balance work.
- **Save-versioned.** `S.hires[role]` changes shape (boolean → a character id) and a
  dealt `S.teamHand` is added, so **`SAVE_VERSION` bumps 2 → 3**; a v2 save retires
  cleanly (the version gate again).

---

## What gets built

### 1. The cast (engine data)

A `CHARACTERS` table: **8 characters** across the six roles — two roles get a real
in-role choice, four get a single distinctive hire. Each entry:
`{ id, role, name, trait, sign, weekly, blurb, fx }`, where `fx` holds the tunable
effect params the modifier sites read. The roster (copy is a draft for Jason's voice
pass; numbers tuned in the plan/sim):

| id | role | name / trait | the bet |
|---|---|---|---|
| `editor-roommate` | editor | your college roommate — loyal, cheap, limited | low `sign`/`weekly`; a **weaker** stress cut, no views bump. (2b: drowns at scale.) |
| `editor-pro` | editor | the seasoned pro — expensive, strong | high `sign`/`weekly`; a **bigger** stress cut + a small longform/live views bump. |
| `designer-steady` | designer | the reliable one | today's designer: mid price, +15% views. |
| `designer-edgy` | designer | the edgy one — cheaper, louder | cheaper; a **bigger** views bump, but a `edgy` flag that makes hostile-event rep hits bite a little harder (the "courts backlash" trait). (2b: the backlash *detonates*.) |
| `manager` | manager | the fixer | today's manager: better deals, less sellout smell. |
| `mod` | mod | the shield | today's mod: softens rep hits + follower losses. |
| `producer` | producer | the archivist | today's producer: evergreen tails earn longer. |
| `analyst` | analyst | the numbers person | today's analyst: heat fades slower. |

The two-character roles (editor, designer) are where the in-role bet lives; the
single-character roles still create **cross-role** scarcity through the dealt hand
("this week it's a mod or a producer, not both — which do you need?"). **The edgy
designer is deliberately not a strict upgrade over the steady one** — it's cheaper
and higher-reach but raises your controversy baseline, so it's a bet even in 2a.

### 2. `S.hires[role]`: boolean → character id (engine)

Today `S.hires = { editor: false, manager: false, ... }`. In v2a it holds the hired
**character id** or `null`: `S.hires = { editor: 'editor-pro', designer: null, ... }`.
A helper `hiredChar(S, role)` returns the `CHARACTERS` entry filling that role (or
null). `hireCount`, `payroll`, and the modifier sites read through it.

### 3. Modifier sites read the character (engine)

The flat per-role modifiers move from hard-coded constants into each character's `fx`,
read at the same sites they live today — **no new sites, no new formula shape**, just
the magnitude sourced from the hired character:
- `viewsMult` — designer views bump (steady vs edgy), editor-pro's small bump.
- `stressCost` — editor stress cut (roommate weaker, pro stronger).
- `repHit` / `loseFollowers` — mod softening; the edgy designer's `edgy` flag nudges
  rep hits up.
- `settleWeek` — analyst heat-keep; `doPost` — producer tail length.
- `payroll` — sums each hired character's `weekly`.

### 4. The dealt hand (engine)

`dealTeamHand(S)` picks **2–3 candidates** from `CHARACTERS`, excluding roles already
filled and (2b) recently-fired characters. It is dealt **once per week** into
`S.teamHand` (an array of ids) in `advanceWeek`, so it is fixed within the week,
varies week to week, persists in the save, and can't be re-rolled by reopening the
dialog. When every hireable role is filled, the hand is empty (the panel says the
team is set).

### 5. Hire / fire from the hand (engine)

`biz.hire(S, id)` hires the chosen candidate (validating it's in `S.teamHand`, the
role is free, cap/cost/business-slot as today) and sets `S.hires[role] = id`.
`biz.fire(S, role)` sets `S.hires[role] = null`. `hireInfo` is re-expressed against a
candidate id. (2b adds the fire→morale flag and the drift events.)

### 6. Team panel rework (chrome)

The Team dialog / rail panel (`renderStudio` / `#teamDlg`) stops listing the six
fixed roles and instead shows **this week's dealt candidates** as cards (name, role,
trait line, sign + weekly, the bet in plain words) with a Hire action, plus the
current roster (who fills each role) with a Fire action. The hire-portrait slots
(`avatar-hire-<role>`) still key on role; a per-character portrait is a 2b/asset
nicety. Reads `S.teamHand` + `hiredChar`.

### 7. Sim rework (sim)

The sim's `nextHire(S, order)` assumes the six roles are always available in a fixed
order — that breaks. Rewrite it to **choose from `S.teamHand`**: each persona picks
the best-value offered candidate for its strategy (the Optimizer takes the growth
hires, the Sustainable the sustainable ones, within cap/affordability). Re-run
`npm run sim` on seeds 7/42/123 and tune character `fx`/prices until the **6 targets
stay green**; record the before/after hire mix.

---

## Engine / chrome / sim split

- **Engine (`the-feed-engine.js`):** `CHARACTERS`; `S.hires` as ids + `hiredChar`;
  `dealTeamHand` + `S.teamHand`; the modifier sites sourcing `fx`; `biz.hire`/`fire`
  re-expressed against ids; `hireInfo`.
- **Sim (`tools/the-feed-sim.js`):** `nextHire` picks from the dealt hand.
- **Tests (`tools/the-feed-test.js`):** the hand deals 2–3, excludes filled roles, is
  stable within a week; hiring sets the id and applies the character's `fx`; firing
  clears it; payroll sums characters; a two-character role offers a real choice.
- **Chrome (`the-feed.html`):** the Team panel shows the dealt candidates + roster;
  `SAVE_VERSION` → 3.
- **Docs:** `the-feed-BACKLOG.md` note; `/privacy` unaffected (no new data leaves the
  device).

## Save

`SAVE_VERSION` **2 → 3**. The shape of `S.hires` changed (boolean → id) and
`S.teamHand` is new, so a v2 save can't be migrated safely — it fails `validSave`
and starts fresh, exactly as the version gate is for.

---

## Out of scope (Team 2b and beyond)

- **Drift-with-scale** — the roommate-editor drowns at 50K → level-up-or-let-go; the
  edgy designer's backlash *detonates* in Act II/III. **2b.**
- **Morale-as-flag** — stress on fumes+ for N weeks → the hired characters' quit /
  complaint events weighted up; firing thins/prices the pool for a while. **2b.**
- **Per-character portraits / new art.** 2a keeps role-keyed portraits.
- **More than 8 characters, or a re-roll economy.** Explicitly not.

---

## Verification

- **Engine/tests:** `npm test` grows — the hand deals 2–3 and never offers a filled
  role; it's identical on repeated reads within a week and changes across weeks;
  hiring `editor-pro` vs `editor-roommate` yields different stress/views; firing
  clears the role and drops payroll; a full team empties the hand.
- **Balance:** `npm run sim` on seeds 7/42/123 → 6/6 after tuning; record the hire mix
  vs. the pre-2a baseline.
- **Browser (`the-feed.html`):** the Team panel shows this week's candidates (not the
  six-role menu); hiring one fills the role and updates payroll/overhead; the panel
  varies week to week; a v2 save is discarded after the version bump (Continue
  absent), a v3 save resumes with the roster intact; no console errors. Mobile +
  desktop.

---

## Sequencing

1. **This sub-project (Team 2a).** Dealt cast + traits; `SAVE_VERSION` → 3.
2. **Team 2b — drift-with-scale + morale-as-flag.** Rides the consequence engine.
3. **The hall (5a)** — the last Step-1 sub-project; folds on the end-screen path line
   and the exit/character flags.
