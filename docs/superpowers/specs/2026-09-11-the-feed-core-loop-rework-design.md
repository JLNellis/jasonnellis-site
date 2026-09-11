# The Feed — Sub-project A: Core loop rework

*Design spec, 2026-09-11. First of three sub-projects (A: core loop · B: event
deck expansion · C: social-app reskin). A must ship playable in the current UI.*

## Why

Playtesting and the balance simulator (`node tools/the-feed-sim.js 1200`)
show three structural problems:

1. **The dominant strategy is "don't play."** Energy recovers 5–11/week and a
   longform post costs 24, so a winning run rests ~30% of turns. The two
   strategies a new player naturally tries hard-fail by week ~8 with no warning
   (Grinder → Broke 94%, Viral Chaser → Burnout 84%).
2. **Money is solved by week ~10.** Paid membership is computed once and never
   recomputed; ~290 members × $6 trivialises rent forever. Cash has no sink
   after gear tier 3 ($1,700). Winning runs end with $80K+ and nothing to buy.
3. **Weeks 15–40 are the same sentence.** No content decisions exist (you
   never choose *what* to post), so the feed reads "Posted a deep-dive video —
   modest numbers" every week. Skill never matters. Rep caps at 100 and stays.

Realism gaps that matter for the educational goal: followers never go down;
followers ≠ views isn't modelled; revenue is a per-follower trickle rather than
views × RPM; rent creeps $3/week for no stated reason.

## Design goals

- **Keep it tight.** 52 weeks, 2–3 decisions per week, ~10 minutes a run.
  Replayability across the eight endings matters more than depth.
- Every failure state is **visible before it happens**.
- Every number on screen is **explainable in one sentence**.
- The feed reads as if the game was *written*, not generated.

## 1. Week loop

### Slots (replaces energy-as-currency)

Each week the player has **2 content slots + 1 business slot**. Any slot may be
left empty. "End week" is always enabled. The separate Rest button is removed —
leaving slots empty *is* resting.

State: `S.slots = { content: 2, business: 1 }`, reset in `advanceWeek`.
Taking a card/action decrements the matching slot; the engine refuses (returns
an empty log) when the slot is 0.

### Stress (replaces energy; 0–100, starts at 20)

Stress rises with work and falls with lighter weeks.

| Source | Stress |
|---|---|
| Micro post | +6 |
| Shortform post | +10 |
| Newsletter post | +14 |
| Longform post | +18 |
| Live stream | +20 |
| Personal angle | +6 on top of the platform cost |
| Cross-post | +4 |
| Launch platform | +8 |
| Engage | +5 |
| Brand deal | +4 |
| Hire / fire / upgrade / membership launch | 0 |
| Weekly recovery (`settleWeek`) | −12, and a further −8 per empty content slot |
| Editor hire | −8 on longform and live |
| Studio (gear tier 4) | −6 on every content card |

So two heavy posts net about +24/week; one light post nets about −10.

**Bands** (evaluated in `settleWeek` on the stress you ended the week's work
at — i.e. *before* weekly recovery is applied, otherwise redline could never
be reached; a feed message fires on every band change, so the trap is never
silent):

| Stress | Band | Effect |
|---|---|---|
| 0–49 | normal | — |
| 50–69 | *running hot* (amber) | feed warning |
| 70–89 | *on fumes* (red) | views ×0.85, feed warning |
| ≥90 | *redline* | counts toward burnout; feed warning |

**Burnout ending:** stress ≥ 90 at the end of **3 consecutive weeks**
(`S.redlineStreak`). The existing "haven't slept" event now triggers at
stress ≥ 60 instead of energy < 45, and its choices move stress instead of
energy.

## 2. Content cards

Each week `buildHand(S)` deals **4–5 cards**. A card is
`{ kind, pkey, angle, topic, mod, stress, special, ... }`.

### Dealing rules

1. Every active platform gets at least one post card.
2. Angle per card is chosen from state:
   - **Trend** when that platform's `heat ≥ 40`, or it was last week's hit.
   - **Personal** when `S.rep < 50` (at most one Personal card per hand).
   - **Evergreen** otherwise (the default fill).
   - If there is room for a 5th card, add a second angle for the strongest
     platform so the player usually has a Trend-vs-Evergreen choice.
3. **Ride** = a Trend card on last week's hit platform with `mod ×1.6` and
   `ride: true` (keeps the existing mechanic).
4. **Cross-post** and **Launch platform** cards keep their current conditions.
   Cross-post costs +4 stress and a content slot. Launch costs +8 stress and a
   content slot.
5. The old "Revive" card is removed — the churn rule (§4) makes neglect
   visible on its own and the duplicate-card confusion goes away.

### Angle profiles

Multipliers applied inside `doPost` on top of the existing quality/heat/size/
luck math:

| Angle | Views | Follower conversion | Heat gain | Churn | Rep | Stress |
|---|---|---|---|---|---|---|
| **Trend** | ×1.6 | ×0.5 | large (+12–20 on hit) | followers gained are tagged as a *trend cohort* and churn at 2× | 4% chance of "aged badly": −3–8 rep | platform base |
| **Evergreen** | ×0.8 | ×1.3 | small (+4–8 on hit) | normal | — | platform base |
| **Personal** | ×1.0 | ×1.1 | medium | normal | +2–4 rep; 8% chance of "overshared": −6–12 rep | platform base +6 |

**Evergreen tail:** an Evergreen post adds an entry to `S.tails`
`{ pkey, views, weeksLeft: 4 }`. Each `settleWeek`, every tail yields 15% of
its original views (converted to followers and ad revenue at the normal rates,
logged as *"'<topic>' is still getting found — +N views this week"*), then
decrements. This is how evergreen "keeps earning" and is the main lesson of the
angle.

### Topic lines

Authored strings in engine data, `TOPICS[niche][angle] = [...]`, **5 per niche
per angle = 90 lines**. Written in the voice of an actual video/post title
("I got banned for this", "The complete beginner's guide to speedrunning").
`S.usedTopics` records `{ topic, week }`; a topic is excluded from dealing for
8 weeks after use. Claude drafts all 90; Jason edits.

### The feed line

The post log becomes:
*"'<topic>' did <views> views on <Platform> — +<followers> followers, +$<rev>."*
with the hit variant appending *"It took off."* (single terminal punctuation —
this also fixes the existing `!.` bug).

## 3. Views, followers, revenue

**Views** are the per-post output. `views = quality × heatF × sizeF ×
platform.viral × niche.viral × angle.views × mod × fatigueF × luck × postK ×
gearMult × studioMult × designerMult × stressMult`. Views are shown in the feed
and summed into `S.totalViews` for the end screen; they are not a persistent
per-platform meter.

**Followers gained** = `views × baseConv (0.02) × platform.loyal × angle.conv`.
Followers remain the persistent, displayed number.

**Ad revenue** = `views × platform.rpm` where `rpm` is now **per view**
(retuned: longform .0045, shortform .0006, micro .0003, newsletter .006,
live .003). The passive per-follower revenue in `settleWeek` is removed; passive
income now comes only from Evergreen tails and membership.

**Churn** (in `settleWeek`, per active platform):
- base 0.6% of followers per week;
- the platform's *trend cohort* (`p.trendFollowers`, decays as it churns)
  loses 1.2%;
- a platform not posted to for 3+ weeks loses 2% instead of 0.6%;
- the feed reports churn only when the weekly loss exceeds 1% of total
  followers, so it's noticed but not spammy.

**Hostile events cost followers.** Every choice in the hostile sub-deck whose
outcome is `bad` also removes 1–6% of the strongest platform's followers
(halved with a Mod hire, §5). The `fed()` helper gains an optional follower-loss
argument so this is one place to change.

## 4. Business layer

One business action per week.

| Action | Rule |
|---|---|
| **Engage** | unchanged: +2–5 rep, +1–4 heat everywhere, +5 stress |
| **Brand deal** | gated at 1K followers. `pay = (dealBase + followers × dealScale) × niche.deal × repMult` where `repMult = dealRepBase + rep/100` with `dealRepBase: 0.6` in CONFIG (rep 80 pays 1.4× rep 40; lower the base to widen the spread). Rep cost −4–9, +4 stress. Manager: pay ×1.3, rep cost ×0.6. |
| **Upgrade** | tiers 1–3 as today ($350 / $800 / $1,700), each **views ×1.10** (stacking multiplicatively). **Skill is removed** (no meter, no `grind`, no `skillCap`). |
| **The Studio (tier 4)** | see below |
| **Launch membership** | gated at 1.5K followers. Initial members = followers × 2–4.5%. **Recomputed weekly** in `settleWeek`: `members += newFollowersThisWeek × 0.025; members −= members × 0.03` (churn doubles to 6% in a week with no posts). Income `members × memberRate` unchanged. |
| **Hire / Fire** | see below |

### The Studio (gear tier 4)

The game's first *risky* purchase — a fixed cost that can bankrupt you if your
numbers slide.

- **Unlock:** gear tier 3 owned **and** ≥ 25K total followers (lands in the
  week 25–40 stretch).
- **Cost:** $12,000 up front, **+$350/week lease** added to overhead.
- **Payoff:** views ×1.3 on every post; every content card −6 stress; **required
  to hold more than two hires**.
- **Feed:** a `big` card on purchase; the overhead jump is visible that week.
- Balance target: the Optimizer persona buys it in most runs, and it should be
  the *cause* of most Broke endings among otherwise-competent personas.

### Hires

`S.hires = { editor: bool, manager: bool, mod: bool, designer: bool }`.

| Role | Sign | Weekly | Effect |
|---|---|---|---|
| Editor | $600 | $110 | longform/live stress −8; views ×1.05 on those two |
| Manager | $500 | $90 | deal pay ×1.3; deal rep cost ×0.6 |
| Community mod | $400 | $60 | hostile-event *bad* outcomes: follower loss ×0.5, rep loss ×0.67; +0.5 rep/week |
| Designer | $800 | $140 | views ×1.15 everywhere |

- Hiring takes the business slot and the signing cost. **At most 2 hires
  without the Studio, 4 with it.**
- Firing is free, immediate, takes the business slot, and logs a feed line
  ("You let your editor go. Payroll −$110/week.").
- Each effect is applied at exactly one site in the engine (a small
  `mult(S, key)` helper) so roles stay one-liners.

### Overhead (replaces `rent`)

`overhead(S) = 140 + 10 × activePlatforms + payroll + (studio ? 350 : 0)`.
No silent weekly creep. The engine exposes `overheadBreakdown(S)` returning the
parts so the UI can show them on hover/help.

## 5. Endings

Same eight keys, same copy except:

- **Burnout** trigger → stress ≥ 90 for 3 consecutive weeks. Blurb uses the
  actual platform count ("Feeding N platforms at once…").
- `legendAt`, `starAt`, `goatAt`, `bankruptFloor` are retuned against the sim
  until the balance targets below hold. Starting guesses: legend 40K, star
  300K, goat 1.2M, bankrupt −1,500.
- End screen gains **Total views** and **Peak overhead** stats (cheap, and
  "views vs followers" is the lesson).

**Balance targets** (all must hold in a 1200-run sim before A is done):

1. "Fill every slot with heavy posts, never hire" → still Burnout, but median
   survival ≥ 15 weeks (the warnings had time to land).
2. "One or two light posts a week, never hire, never deal" → mostly Faded, not
   Broke. Broke requires overspending (payroll/lease you can't cover).
3. Sustainable persona → Niche Legend 50–70%.
4. Optimizer → Star ≥ 50%, GOAT 10–25%. Pooled GOAT ≤ 5%.
5. No *strategic* persona funnels > 85% into one ending. (The Grinder and
   the Minimalist are deterministic by design — target 1 *requires* the
   Grinder to burn out — so they're exempt.)
6. Studio-buying personas account for the majority of Broke endings among
   personas that survive past week 20.

### Balance outcome (Task 10, 2026-09-11)

The numbers above were design starting points; the tuned values live in
`CONFIG` and are the source of truth. Where the tuned game differs
materially from the text above:

- **Stress** (after a second, stress-only pass): weekly recovery **23** (not
  12), **+18 per empty content slot** (not 8); longform/newsletter/live cost
  13/12/16; Engage costs 1 (`engageStress`), deals 4 (`dealStress`). Two
  heavy posts every week with no rest: *hot* at week 3, *fumes* week 9,
  *redline* week 16, Burnout week 18. One lighter week every 4th week keeps
  you in *normal* indefinitely. Stress bites sustained maximum output and
  nothing else; an Editor nearly removes it for longform. Bands are judged
  on the stress you ended the week's work at, before recovery.
- **Overhead:** base $60/week (not $140). Needed so a one-light-post-a-week
  creator can limp to week 52 and Fade instead of going Broke.
- **The Studio:** lease **$3,000/week** (not $350) and views **×2.8** (not
  ×1.3). At the spec's numbers it was never a bet — membership income
  covered it trivially. It is now the game's one real gamble: ~64% of late
  Broke endings are Studio owners.
- **Money:** `memberRate` 4, `memberChurn` 4%, idle churn 12%, `dealBase`
  150. Non-Studio winners still end with ~$60–85K, which is meaningless;
  this is a known open item (see §"Open items after A").
- **Ending thresholds:** Legend 37K · Star 70K · GOAT 200K. The follower
  curve is roughly linear (views saturate via `sizeF`), so p90 ≈ 2× p50 for
  every persona and a wider Star→GOAT gap is not available without
  reshaping growth. Ending copy now reads the thresholds from CONFIG.
- **Optimizer** (best persona) median: ~104K followers, 136K views/week,
  Star 54% / GOAT 15%.

### Open items after A (for B/C or a later balance pass)
- Cash is still meaningless for non-Studio winners — needs another sink
  (B's events: tax bill, editor quitting, etc.) rather than more knob work.
- Star→GOAT gap is only ~2.9×; consider late-game compounding (a
  "breakout" mechanic) if the top ending should feel rarer.
- The Optimizer persona spreads posts across four platforms, which the
  engine punishes (split `sizeF`, low-loyalty platforms); a concentrating
  optimizer would score higher. Persona design, not a balance bug.

## 6. Simulator

`tools/the-feed-sim.js`:

- Personas rewritten for slots. Each persona's `act(S)` returns a sequence of
  `{card:i}` / `{biz:'…'}` per week; the runner enforces slot counts exactly as
  the browser does.
- New/renamed personas: **The Grinder** (2 heavy posts every week, never hires),
  **The Minimalist** (1 light post, never hires or deals — target #2),
  **The Diversifier**, **The Hustler**, **The Sustainable**, **The Chaos
  Gremlin**, **The Optimizer** (hires when cash > 4× signing cost, buys the
  Studio when unlocked and cash > $20K).
- Report adds median **views/week**, **hires at end**, **bought studio %**, and
  the auto-flag checks encode the six balance targets above.
- Same CLI: `node tools/the-feed-sim.js [N] [report.html]`.

## 7. UI wiring (current skin, minimal — replaced in C)

`the-feed.html`:

- Energy meter → **Stress** meter; bar colour follows band (green / amber /
  red); band label appears next to the value ("running hot").
- Skill meter and "Study the craft" button removed.
- Stage header shows the slot counter: *"2 content · 1 business left"*.
- Hand cards render an **angle badge** (Trend / Evergreen / Personal, coloured
  distinctly but *not* good/bad — they're trade-offs) and the topic line as the
  card title; the platform becomes the subtitle.
- Business grid: Engage · Brand deal · Upgrade/Studio · Membership · **Team**
  (opens an inline roster panel with hire/fire buttons, salary, and the
  2-hire cap message when no Studio).
- Rest button removed. "End the week" stays.
- "Weekly costs" stat → **Overhead**, with the breakdown in the help line.
- Feed shows views lines, churn lines, stress-band lines, tail lines.
- End screen: Total views + Peak overhead stats.

## 8. Testing

- Engine gets an injectable RNG: `FeedEngine.setRng(fn)` (defaults to
  `Math.random`). The sim and tests seed it for reproducibility.
- `tools/the-feed-test.js` (plain Node asserts, run via `npm test`):
  slot accounting and refusal; stress band transitions and burnout streak;
  membership recompute (growth and no-post churn); hire cap with/without
  Studio; fire clears payroll; overhead breakdown sums to `overhead(S)`;
  topic non-repeat window; evergreen tail decrement; trend cohort churn;
  hostile-event follower loss halved by Mod.
- The sim remains the balance oracle; the six targets are its exit criteria.

## 9. Docs

- `the-feed-BACKLOG.md`: summarise A's shipped design; queue B (event deck)
  and C (reskin) with one-paragraph briefs; promote **ending → essay CTA** to a
  named priority item (blocked on essays existing); mark leaderboard *deferred
  until after C* and OpenMoji *dropped* (reason: emoji-as-icons is the thing
  the reskin removes).
- `CLAUDE.md` Feed section: note slots/stress replace energy/skill, and that
  `npm test` exists.

## Out of scope for A

New events (B). Any visual redesign beyond the wiring above (C). Leaderboard.
Ending-specific Substack CTA (needs essays). Collab mechanics (B, as events).
