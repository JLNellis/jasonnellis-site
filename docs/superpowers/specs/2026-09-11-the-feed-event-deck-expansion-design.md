# The Feed — Sub-project B: Event deck expansion

*Design spec, 2026-09-11. Second of three sub-projects (A: core loop — shipped ·
B: event deck expansion · C: social-app reskin). B is pure engine + content +
balance; no UI work (that is C).*

## Why

The shipped game draws from a **10-card event deck**, picked uniformly at random
with no memory. Two problems follow:

1. **The deck exhausts and repeats.** All ten cards are seen by ~week 15, and
   the same card fires repeatedly in one run (observed: "review-bombed" seven
   times in a single playthrough). Weeks 15–52 stop surprising the player.
2. **Cash is meaningless for non-Studio winners.** They end a run holding a dead
   ~$60–85K. There is no sink after gear tier 3 and the membership economy. The
   core-loop spec (A) explicitly deferred this: *"needs sinks from sub-project
   B's events, not more knobs."*

B fixes both by growing the deck to ~30 cards, adding non-repeat + phase gating,
and introducing **threat cash-sinks** that make cash a disaster buffer rather
than a scoreboard.

## Design goals

- **Keep it tight.** More variety, not more mechanics. No arc-state machine, no
  lingering multipliers, no new hire types.
- The deck **stays fresh to week 52** without exhausting or repeating story
  cards.
- **Cash earns its place**: hoarding should be punished by events you can't fully
  see coming, so keeping a buffer has a point.
- Every card reads as if it was *written*, not generated — medias res, no
  morals, no em dashes (matches the A copy pass).
- The existing **six balance targets stay green** in `npm run sim`.

## 1. Engine changes

Three additions to `the-feed-engine.js`. All are small and testable; the
`CONFIG` block stays the single source of truth for tunable numbers.

### a. Non-repeat tracking

- Every event gains a stable string `id` (e.g. `'viral-moment'`, `'tax-bill'`).
- Initial state gains `S.seenEvents = []`.
- `drawEvent(S)` excludes any event whose `id` is in `S.seenEvents`, **unless**
  the event is tagged `repeatable: true`.
- An event's `id` is pushed to `S.seenEvents` when the card is drawn (in
  `rollEvent`/`drawEvent`), so declining or dismissing it still consumes it.
- **Repeatable cards** (generic, recurring creator beats): viral moment,
  algorithm shift, troll swarm, the sleepless "Health" card. Everything else is
  once-per-run by default.
- `seenEvents` resets on new game (part of initial-state construction, so a
  fresh `newGame()` starts empty).

### b. Phase gating

- Optional `minWeek` / `maxWeek` fields on any event. `drawEvent` filters on them
  alongside the existing `cond(S)`.
- Phase bands are named in `CONFIG` for readability and reuse:
  `phases: { earlyEnd: 17, midEnd: 35 }` → early = weeks 2–17, mid = 18–35,
  late = 36–52. Cards reference weeks directly via `minWeek`/`maxWeek`; the
  band names document intent.
- Division of labour: `cond(S)` does **state** gating (has editor, owns studio,
  rep/followers thresholds); `minWeek`/`maxWeek` do **time** gating. A card may
  use either, both, or neither.

### c. Gross-earnings accumulator

- Add `S.grossEarned = 0` to initial state.
- In `settleWeek`, add the week's ad revenue + any deal income to `S.grossEarned`
  (accumulate the same figures already computed for `passive`/deals — no new
  economic model).
- The tax sink bills a percentage of `grossEarned` accrued since the last tax
  event, so the bill scales with what the player actually made. Resets its
  running base after each tax card fires (track via a `S.taxedThrough` marker or
  by zeroing a dedicated accumulator — implementer's choice, documented in code).

### `drawEvent` filter (final shape)

```
deck = EVENTS.filter(e =>
     (!e.cond || e.cond(S))
  && (e.minWeek == null || S.week >= e.minWeek)
  && (e.maxWeek == null || S.week <= e.maxWeek)
  && (e.repeatable || !S.seenEvents.includes(e.id))
)
```

`rollEvent` is unchanged except that it records the drawn card's `id`.

## 2. The deck: 10 → ~30 cards

Keep the current 10 cards. The only edits to them: add an `id` and add
`repeatable: true` to the four generic beats named above. No copy changes to
existing cards.

Add ~20 new cards, distributed across phase and `kind`. Each new card follows
the existing structure exactly:
`{ id, kind, emoji, title, badge, cond?, minWeek?, maxWeek?, repeatable?, text, choices:[{ t, ci, label, desc, apply }] }`
with `t ∈ repair | neutral | escalate` (personas pick by this tag, so every new
card must offer a coherent spread the sim can choose from).

### Threat / cash-sink cards (the balance fix)

| id | phase / gate | Effect summary |
|---|---|---|
| `tax-bill` | mid + late (fires ~once each) | Bills a % of `grossEarned` since last tax event. Can't cover → penalty (extra fee) + rep/stress hit. |
| `demonetization` | mid/late | Ad revenue frozen for a short stretch; an income gap the player absorbs. Implemented as immediate cash effect, not a lingering flag. |
| `gear-dies` | cond: owns upgraded gear | Pay to replace, or take a lasting views penalty (revert a gear tier). |
| `sponsor-clawback` | cond: `S.deals > 0` | A past sponsor demands money back after a scandal. Direct cash hit. |
| `surprise-expense` | any; studio-gated variant | Stolen laptop / medical bill / (if studio) a flood. One-time cash hit. |

Sink magnitudes are tuned in balance (§3), not fixed here.

### Growth & variety cards

| id | phase / gate | Effect summary |
|---|---|---|
| `collab-offer` | early/mid | The #1 real growth lever; asymmetric by creator size (bigger boost when small). |
| `platform-beta` | early | Beta invite → heat/reach boost on one platform. |
| `press-feature` | mid | Rep + followers bump. |
| `copycat` | any (hostile) | Someone clones your format; rep/heat decision. |
| `editor-quits` | cond: has editor hire | Lose the editor, stress spike, choice to re-hire or cope. |
| `sponsor-pullout` | cond: `S.deals > 0` (hostile) | Sponsor pulls out after a scandal; expected income vanishes, rep. |
| `cpm-q4` | late (weeks ~45–52) | Seasonal CPM windfall — immediate cash upside. |
| `cpm-summer` | mid | Summer ad slump — immediate cash downside. |
| `awards-nod` | late (min ~45) | Awards nomination — rep/reflection beat. Standalone, **not** sequenced. |
| `annual-reckoning` | late (min ~45) | Year-end review of the run — rep/stress, sets the end-of-year tone. |

Remaining slots to reach ~30 are filled from the same candidate pool
(additional collab/press/community beats) during authoring; the table above is
the committed spine, not an exhaustive list. All new copy is drafted by Claude
in Jason's voice and reviewed by Jason as one batch before ship (§4).

### Deck freshness math

~30 cards, non-repeating story cards + 4 repeatables, at `eventChance: 0.55`
over 52 weeks ≈ 28 events fired. The deck stays fresh to the end without
exhausting; once the non-repeatable pool is spent late, only the four generic
beats recur — acceptable and rare.

## 3. Balance & tests

### Deterministic tests (`tools/the-feed-test.js`, `npm test`)

- **Non-repeat:** drawing repeatedly across a run never returns a
  non-`repeatable` card twice; `seenEvents` grows monotonically.
- **Phase gating:** no card fires before its `minWeek` or after its `maxWeek`
  (assert across all weeks with a fixed RNG).
- **Cash sinks bite:** applying each threat card's paying choice reduces
  `S.cash` (and `tax-bill` scales with `grossEarned`).
- **Reset:** `newGame()` starts with `seenEvents == []` and `grossEarned == 0`.
- **Structural:** every event has a unique `id`; every choice has a valid `t`.

### Balance simulator (`tools/the-feed-sim.js`, `npm run sim`)

- **The existing six balance targets must stay green.** Re-run after each tuning
  pass; the process must exit zero.
- Tune sink magnitudes until non-Studio winners end in a "spent it fighting
  fires" range instead of hoarding a dead $60–85K.
- If verifying that outcome needs a **new** soft target (e.g. median end-cash for
  a non-Studio winner below a threshold), surface it to Jason before editing the
  `⚑ BALANCE TARGETS` block — do not silently change the six.

## 4. Copy

Claude drafts all ~20 new cards in Jason's voice:

- **Medias res** — open inside the moment, not with setup.
- **No morals** — the card states what happened; it doesn't teach a lesson.
- **No em dashes** anywhere in card copy.
- Choice `label`/`desc` stay terse and action-first, matching existing cards.

Jason does one review pass on the full batch before it ships. Copy is the last
thing wired in, after mechanics and balance are green.

## 5. Docs

Update `the-feed-BACKLOG.md`:

- Move sub-project B from "Next" to shipped, with a one-paragraph summary
  mirroring the A entry.
- Fold the resolved open item (meaningless cash) into the changelog; note the
  sink mechanic.
- Leave sub-project C, the essay-CTA priority note, the leaderboard defer, and
  the remaining open balance items (Star→GOAT gap, Optimizer persona, Grinder
  floor) intact.

## Scope guardrails (YAGNI)

Explicitly **out** of B:

- No multi-week arc sequencing or arc-state tracking (awards arc is standalone
  late cards).
- No lingering RPM/views multipliers held in state (seasonal CPM is immediate).
- No new hire types, platforms, or angles.
- No UI, reskin, or icon work — that is sub-project C.
- No leaderboard — deferred until after C.

## Files touched

- `the-feed-engine.js` — `CONFIG.phases`, `seenEvents`/`grossEarned` state,
  `drawEvent`/`rollEvent` filter, ids + `repeatable` on existing cards, ~20 new
  `EVENTS` entries.
- `tools/the-feed-test.js` — new deterministic tests.
- `tools/the-feed-sim.js` — re-run only; edited only if a new balance target is
  approved.
- `the-feed-BACKLOG.md` — status + changelog update.

`the-feed.html` is **not** touched (no UI changes in B).
