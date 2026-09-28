# 80% of Your Comments Are Robots — design spec

Date: 2026-09-28. Source brief: `~/Downloads/twelve-weeks-build-brief.md` (not in repo).
This spec supersedes the brief wherever they differ; every difference is listed in §15.

## 1. What it is

**Name:** 80% of Your Comments Are Robots. **Tagline:** And they love you.
**URL / file prefix:** `/robot-comments`, `robot-comments-*`; Plausible events and Kit fields use
the `rc_` prefix, CSS tokens `--rc-`. (Working title in the brief was "Twelve Weeks".)

**The title is itself a bait card.** The 80% figure traces to van der Blom describing comments on
his own posts in an interview: an anecdote, not a study. The game says so rather than hiding it: the
intro screen carries a small unstamped circle next to the title, and the end screen stamps it
**Invented** with the why-line "One researcher, describing his own posts, in one interview. It
became a statistic. So did this title." Sources: `vdb` (podcast, 23:02) and `dhelin`.
(Confirmed by Jason 2026-09-28.)

A phone-first, single-page simulator of twelve weeks of LinkedIn posting decisions, at
`/robot-comments`. A brand asset first (something people finish and screenshot), a soft on-ramp to
the Building Value relaunch (Q4 2026) second. Its argument: separate what LinkedIn has published
from what vendors repeat. Every mechanic and card carries one of four evidence stamps (Proven /
Measured / Disputed / Invented), and every stamp resolves to a citation the player can open.

Success metrics, in order: completion (target 70%+ of starts), shares, replays, email opt-ins.

## 2. Non-negotiables (from the brief, kept)

1. End-screen disclosure, verbatim: "The structure of this model comes from LinkedIn's published
   engineering. The weights are ours. Anyone who tells you they have the weights is selling
   something."
2. Stamps are real. No tier is ever inflated. A test fails if any stamp lacks a source id.
3. Not a LinkedIn clone: no LinkedIn blue, no feed mimicry, no logo, no trade dress.
4. Phone-first, one hand, tap only, no typing in the game (the optional email field on the end
   screen is the only input). Every screen fits 390x844 and 360x780 without scrolling except the
   end screen. No horizontal scroll.
5. Deterministic: identical setup + choices = identical game.
6. No accounts, no leaderboard, no LinkedIn API, no claim of real reach prediction. Mid-game
   resume on the same device is in (§5a); nothing is saved server-side.

## 3. Architecture

Same pattern as The Feed.

| File | Job |
|---|---|
| `robot-comments.html` | Standalone page (does NOT load `nav.js`; inline Plausible snippet like `the-feed.html`). Markup, game-scoped CSS tokens, UI controller. Loads `colors_and_type.css` for DM Sans / DM Mono. |
| `robot-comments-engine.js` | Pure model, no DOM. Importable by Node. One `CONFIG` block; every coefficient is `{ value, stamp, source }` where `stamp ∈ {proven, measured, disputed, invented, ours}` and `source` is a `SOURCES` id (null only for `ours`). Exports `newGame(setup)`, `deal(state)`, `resolveWeek(state, choice)`, `resolveEvent(state)`, `finish(state)`. |
| `robot-comments-data.js` | Card pool, bait cards, events, archetype copy, why-line templates, `SOURCES` table. |
| `tools/robot-comments-sim.js` | Seeded policy runs + band derivation (§11). `npm run sim:rc`; exits non-zero if a target fails. |
| `tools/robot-comments-test.js` | Engine tests (§13). `npm run test:rc`. |
| `robot-comments-share.njk` | Eleventy, paginates over the six archetypes → `/robot-comments/r/<slug>/`. Each page: `noindex`, archetype OG/Twitter tags, meta-refresh + link to `/robot-comments`. |
| `tools/robot-comments-og/` | One HTML template + README; headless Chrome renders 7 JPGs (6 archetypes + default) exactly like `tools/burn-rate-og/`. |
| `tool-index/robot-comments.md` | `/experiments` card. |

Wiring: `_redirects` rewrite + 301 pair for `/robot-comments`; `.eleventy.js` passthrough for the
HTML, both JS files and the OG images; sitemap picks the page up via the tools collection; share
pages stay out of the sitemap. CLAUDE.md pages table gets a row.

Data flow: setup → seed. Each decision week: `deal` derives the hand from the seed plus all
choices so far → player picks card + engagement → `resolveWeek` returns new state, one strip-chart
column, the dominant lever (for the why-line) and its stamp → UI animates what the engine
returned. Weeks 5 and 9 call `resolveEvent`. Reload resumes (§5a).

## 4. Setup (one screen, three taps)

| Archetype | Connections | Headline | `headline_fit` |
|---|---|---|---|
| Seed-stage founder | 800 | names the product category | 1.0 |
| Series B exec | 4,000 | title and a company | 0.8 |
| Second-time founder | 12,000 | vague mission statement | 0.6 |
| Fractional operator | 2,500 | lists four services | 0.5 |

Mechanism Proven (Danchev: author name, headline, company, industry are in every post's text);
the four values are ours.

Weekly budget: 1, 3 or 6 hours. Winnable at 3, hard at 1. Unused hours do not carry over.

## 5. Turn loop

Twelve weeks: ten decision weeks, events at weeks 5 and 9.

Decision week, one screen:
1. Hand of three post cards (stacked, overlapping vertically, all titles visible; tap lifts one).
2. Engagement: three-way segmented control — comment in your cluster (0.5h), comment on whatever
   is popular (0.5h), nothing.
3. **Post**, or the quieter "skip this week".
4. Card cost + engagement cost may not exceed the weekly budget; unaffordable cards and
   combinations are greyed with cost shown. Every hand contains at least one card affordable with
   no engagement.
5. Resolve: feed abstraction (~1.2s; instant under reduced motion), strip-chart column fills,
   why-line, stamp lands on the card. Tap a revealed stamp → source sheet. "Next week".

Target: under 40 s per turn, under 7 min per game.

## 5a. Resume after losing the page

Because the engine is deterministic, the save is only the inputs, never the state:
`{ v: ENGINE_VERSION, setup: {archetype, budget}, choices: [{card, engagement} | {skip: true} | {event: true}, ...] }`
in `localStorage` key `rc_run`, written after every resolved week (wrapped in try/catch; a failed
write never blocks play).

- On load, if a valid `rc_run` exists: a resume card replaces the setup screen — "Week 7 of 12,
  Series B exec, 3 hours" with **Resume** (primary) and **Start over**. Resume replays the choice
  list through the engine (instant, no animation) and lands on the next unplayed week with the
  strip chart already filled.
- Mid-resolve losses: the save is written only after a week resolves, so a player who closes during
  the animation resumes at the start of that same week with the same hand (the deal is derived from
  the seed + prior choices, so it is identical).
- `ENGINE_VERSION` is a hash of CONFIG plus the cards' mechanical fields, so any rebalance changes it automatically.
- `ENGINE_VERSION` mismatch or a replay that fails validation (unknown card id, over-budget choice)
  → discard silently and show normal setup. A shipped rebalance never resumes into a different game.
- On reaching the end screen, `rc_run` is replaced by `rc_last` = `{archetype, band, tax, slug}` so
  reopening the page offers "See your last result" alongside a new game. Replay/Start over clears
  both.
- Same device and browser only; no server, no account. Private windows and blocked storage simply
  lose resume. `/privacy` already covers on-device `localStorage`.

## 6. Cards

### Dimensions
- **Format / cost (h)**: text 1, image 1.5, document 3, short video 2, long video 4, poll 0.5,
  article 3, reshare 0.25.
- **Topic**: on-cluster, adjacent, off-cluster.
- **Hook**: claim-first, scene-setting, question-first, listicle.
- **Substance**: named specifics, generic advice, personal story with stakes, promotional.
- **CTA**: specific answerable question, none, link in body, link in first comment, engagement
  bait ("Comment YES if you agree").

### Pool
40 authored regular cards (each a fixed combination of the five dimensions + a title) plus 7 bait
cards. The same card id always reads the same. A game draws without replacement (10 hands × 3 =
30 of 47). Bait: one per hand with seeded probability 0.5, never more than one per hand; the
Interact card at most once per game.

### Bait cards (title promises a shortcut; stamp reveals only after play)

| Id | Card | Stamp | Mechanic |
|---|---|---|---|
| bait-precomment | Comment on three posts fifteen minutes before publishing (+21%) | Invented (figure untraceable per Dhélin) | +0.5h cost, no effect |
| bait-poll | Add a poll for 1.78x reach | Measured (AuthoredUp) | Poll format: reach up, per-impression contribution 0.21x, pipeline near zero |
| bait-pod | Join a pod of twelve peers who engage in the first hour | Proven policy (Jurka 2026), magnitude ours | This week: +50% displayed contributions that do not feed distribution. Next two decision weeks: suppression 0.5x |
| bait-firstcomment | Put the link in the first comment to dodge the 60% penalty | Invented (the 60%); link effect Disputed | Behaves as CTA "link in first comment" |
| bait-hashtags6 | Use six hashtags for discoverability | Measured direction (AuthoredUp), magnitude ours | Reach 0.85x |
| bait-thoughts | Ask "Thoughts?" at the end | Invented | No effect |
| bait-gatedgame | Build a gated game on your website to collect emails | Measured (Interact, vendor data: 40.1% start-to-lead, 100M+ leads) | Text post, link in body (dwell hit), 3h. Pipeline bonus = profile_visits × 0.05 (start rate, ours) × 0.401. Why-line says it works and that the source sells quizzes. |

`folklore_tax` = count of bait cards played, excluding gatedgame (it is the one that works; the
end screen notes whether you played it).

## 7. Model

All values below are `ours` unless stamped. Measured values are never tuned (§11).

### State
`anchor_reach`, `baseline_reach`, `coherence` (start 0.5, clamp [0,1]), `pipeline` (float),
`folklore_tax`, `weeks_silent`, `skips_total`, `suppression` (list of {week, factor}),
`bait_cta_weeks`, `history`, `totals` (impressions etc.).

### Per decision week

```
fit        = headline_fit[archetype] * (0.6 + 0.4 * coherence)
             * (0.9 if substance == personal and topic == off-cluster)
reach      = baseline_reach * fit * format_reach[fmt] * cadence_mult * suppression_this_week
             * cta_reach[cta] * modifier_reach * noise            noise ∈ [0.92, 1.08], seeded
click_p    = 0.03; link in body 0.08; link in first comment 0.05
dwell_p    = base_dwell(0.30) * format_dwell[fmt] * hook[h] * substance_dwell[s] * cta_dwell[cta]
             capped so dwell_p + click_p <= 0.95
scroll_p   = 1 - dwell_p - click_p
contrib_p  = base_contrib(0.02) * format_contrib[fmt] * hook[h] * substance_contrib[s]
             * cta_contrib[cta] * cta_dwell[cta]
```

Deviation from the brief: contribution takes the format effect from the measured per-impression
ratio (AuthoredUp engagement ÷ reach) instead of chaining through dwell, so the measured numbers
are not double-counted.

Displayed per week: impressions = reach; held attention = reach × dwell_p; contributions =
reach × contrib_p; profile visits; DMs.

### Distribution loop (for next week)
```
baseline_reach *= 1 + a*(dwell_p/base_dwell - 1) + b*(contrib_p/base_contrib - 1)   a,b ours (start 0.10/0.05)
baseline_reach  = clamp(baseline_reach, 0.5*anchor_reach, 2.0*anchor_reach)
anchor_reach    = connections * 0.12
```
Popular-post comments this week: next week's reach × 1.06 (lost if next week is an event week). Skip: baseline × 0.95.

### Pipeline
```
specific       = substance in {named, personal}
held           = reach * dwell_p
profile_visits = held * (0.07 + 0.10*specific + 0.07*(fmt == document))
                 * 1.10 if popular comments this week, * 1.05 if in-cluster comments
dms            = profile_visits * fit * 0.12
pipeline      += dms   (+ gatedgame bonus)
```
Displayed pipeline = pipeline rounded to one decimal; the band is computed on that same rounded value.

### Coherence (applied each week, decision or event)
```
on-cluster post +0.12 · adjacent +0.03 · off-cluster −0.15
in-cluster comments +0.05 · popular comments −0.05   (calibrated 2026-09-28; was −0.08)
skip: weeks_silent += 1; at every second consecutive silent week (2, 4, 6…), coherence −0.30; posting resets it
decay: coherence *= 0.90   (calibrated 2026-09-28; was 0.94, then 0.88)
```
Decay is ours, loosely motivated by FeedSR v1's 60-day training half-life (cited as v1 only).

### Cadence, suppression
- Cadence over the last two decision weeks: 2 posts → 1.0; 1 post → 0.9. Ours; the why-line quotes
  van der Blom's own "two to three posts a week".
- Engagement-bait CTA: reach 0.6x this week (Proven policy, magnitude ours). A second one within
  three weeks: 0.5x suppression on the next decision week.
- Suppressions multiply.

### Multiplier table

| Lever | Reach | Dwell | Contrib (per impression) | Stamp / source |
|---|---|---|---|---|
| text | 1.07 | 1.0 | 0.73 | Measured, AuthoredUp (1.07 / 0.78) |
| image | 1.20 | 1.0 | 1.11 | Measured, AuthoredUp (1.20 / 1.33) |
| document | 1.39 | 1.3 | 0.94 | Measured, AuthoredUp (1.39 / 1.30); dwell ours |
| short video | 0.83 | 0.9 | 1.08 | Measured, derived (all video 0.86, 0–30s 0.96× avg video; eng 0.93) |
| long video | 1.04 | 1.2 | 1.05 | Measured, derived (3+ min 1.21× avg video, eng 1.17×) |
| poll | 1.78 | 0.6 | 0.21 | Measured, AuthoredUp (1.78 / 0.37) |
| article | 0.69 | 1.1 | 0.64 | Measured, AuthoredUp (0.69 / 0.44) |
| reshare | 0.29 | 0.5 | 0.76 | Measured, AuthoredUp (0.29 / 0.22) |
| claim-first hook | – | 1.10 | 1.10 | Measured, Jason's 107 posts (engagement) |
| scene-setting hook | – | 0.90 | 0.90 | Measured, Jason's 107 posts |
| question-first / listicle | – | 0.95 / 1.0 | same | ours (n too small / confounded) |
| named specifics | – | 1.05 | 1.2 | Measured, Jason's posts (1.31× vs generic, flat in 2025–26); dwell ours |
| generic advice | – | 1.0 | 1.0 | baseline |
| personal story with stakes | – | 1.1 | 2.0 | Measured, Jason's posts (3–4.7× raw, capped for congratulation inflation) |
| promotional | – | 0.8 | 0.75 | Measured, Jason's posts (0.75×, n=52); dwell ours |
| specific question CTA | – | 1.0 | 1.5 | Measured, Jason's posts (1.6–1.85×, comments 9 vs 2, n=8) |
| link in body | 1.0 | 0.84 | – | Disputed (vdB −16%; Ordinal −26.5% / ≈0 personal; AuthoredUp conflicting) |
| link in first comment | 1.0 | 0.95 | – | Disputed |
| engagement bait CTA | 0.6 | 1.0 | 1.1 | Proven policy (Jurka 2026), magnitudes ours |
| hashtags ≥6 | 0.85 | – | – | Measured direction, magnitude ours |

Jason's-data levers: the source sheet states "one account, 107 posts, engagement not reach, single
coder". Labels live in the scratchpad only; the CSV never enters the repo.

Position bias: not modelled; the sim has no feed position (FeedSR v1 debiases position; cited v1
only). Saves: not modelled; absent from every published action list.

## 8. Events (weeks 5 and 9; two distinct, seeded)

Darker stock, torn edge, absurdist copy, tap through, then consequence + why-line + stamp.

| Event | Effect | Why-line basis |
|---|---|---|
| The swarm | Best post so far: event-week contributions display +40; held attention 0; no distribution effect | Proven: Jurka 2026 anti-automation section (LinkedIn limiting automated comments' effect). Not the "80% AI comments" anecdote. |
| The reset | No post this week (the card copy carries the 40% drop); baseline and anchor × 0.85 for the rest of the game | Measured: van der Blom, reach down ~60% over two years (author on record, report paid). Plus Proven: LinkedIn says it chose relevance over reach. Never "intentional narrowing". |
| Adjacent gravity | If coherence ≥ 0.5: next week reach × 1.08; else nothing | Proven mechanism (Danchev: semantic retrieval, world knowledge relates topics), magnitude ours |
| The audit | headline_fit ≤ 0.6 → coherence −0.10; headline_fit ≥ 0.8 → +0.05 | Proven mechanism (Danchev: headline in post text; cold-start from headline), magnitude ours |

Event weeks do not count as skips and do not break cadence.

## 9. Scoring and archetypes

Three numbers: **Pipeline** (number + band: cold / warm / working / hot), **Fingerprint clarity**
(final coherence as a word — <0.35 Blurred, <0.50 Faint, <0.65 Legible, ≥0.65 Sharp — plus its
strip-chart row), **Folklore tax** (named once, with a reframe that stays true for every bait
card: shortcuts you took on someone else's word. Not "traced to nothing": the poll and hashtag
cards are Measured).

Bands are per archetype (800 vs 12,000 connections cannot share a scale): cut points at the 25th /
60th / 85th percentile of a seeded random-policy population, stored in `CONFIG.bands`, regenerated
by `npm run sim:rc -- --bands`. Reach band = total impressions ÷ (anchor × 10), same percentile
method; "top" = top quartile.

Archetype, first rule that matches:
1. **The Pod Casualty** — folklore_tax ≥ 3
2. **The Ghost** — skips_total ≥ 2
3. **The Generalist** — coherence < 0.35
4. **The Broadcaster** — reach top quartile and pipeline cold or warm
5. **The Fingerprinted Founder** — coherence ≥ 0.65 and pipeline hot
6. **The Control Group** — everything else. Tagline: "Every experiment needs one."

Each: ~60 words of flat, sourced diagnosis + one absurdist tagline. The Overdrawn is v1.1.

## 10. End screen

Above the fold (screenshot target): archetype name, pipeline number + band, tagline, strip chart,
disclosure line. Below, in order:
1. Share: `navigator.share` on mobile, copy-link fallback. Text: "<Archetype> · pipeline: <band> ·
   folklore tax: <n>" + `https://jasonnellis.com/robot-comments/r/<slug>`. No LinkedIn-specific copy.
2. Replay.
3. Email (optional, one field): Building Value framing only, e.g. "Get notified when Building
   Value relaunches." No playbook, no gate, no blur. Posts via `fetch(..., {mode:'no-cors'})` to
   Kit form 9920578 (`SITE_CONFIG.newsletterPost`, field `email_address`) plus custom fields
   `fields[rc_archetype]`, `fields[rc_budget]`, `fields[rc_tax]`, `fields[rc_headline]`. Player
   stays on the page; inline "Check your inbox to confirm."
4. Podcast paragraph in Jason's voice (this game ran twelve weeks; Building Value runs whole
   careers; Q4 2026), one link to `/building-value`.
5. Sources: every citation used, grouped by tier, with links.

## 11. Calibration

Step 1 (done 2026-09-28): Jason's-data multipliers re-derived from the 107-post CSV (§7 table).

Step 2 (build gate), 200 seeded runs per population. Only `ours` coefficients may be tuned.
The sensible and reach players take their second-best card in about 20% of decision weeks (never a
card they refuse), so a population is 200 different games, not four.
- **Sensible founder** (on-cluster, claim-first, document every third decision week, no bait,
  in-cluster comments when affordable but skipped in ~20% of weeks, 3h): ≥ 80% land working or hot;
  The Fingerprinted Founder 40–60%. Also tracked: median final coherence, aim 0.70–0.90.
- **Sensible founder at 1h**: ≤ 40% land working or hot (hard at 1).
- **Vendor playbook** (polls, pod, six hashtags, link in body, popular comments, always take bait):
  ≥ 80% land The Broadcaster or The Pod Casualty.
- **Reach chaser** (on-cluster first, then the highest measured format reach; generic over named;
  no bait cards, no bait CTA; popular comments when affordable on on-cluster posts; never skips;
  3h): ≥ 25% land The Broadcaster.
- **Reachability**: every archetype reaches ≥ 3% in at least one population (sensible 3h, sensible
  1h, vendor 3h, reach 3h, random at 1h, 3h and 6h). The sim prints the best population for each.

Calibrated 2026-09-28 (commit 2d49439): sensible 3h working/hot 97.5%, Fingerprinted Founder 56.0%
(median final coherence 0.71); sensible 1h working/hot 15.5%; vendor Broadcaster/Pod Casualty 97.5%;
**reach chaser Broadcaster 11.5% (below the 25% target; open for Jason, not forced)**. Reachability
all pass: Pod Casualty 90.0% (vendor 3h), Ghost 8.0% (random 6h), Generalist 36.5% (reach 3h),
Broadcaster 11.5% (reach 3h), Fingerprinted Founder 56.0% (sensible 3h), Control Group 80.5%
(sensible 1h). Knobs moved: coherence decay 0.94 → 0.88 → 0.90; popular-comment coherence
−0.08 → −0.05.

Why the reach target resists: pipeline follows held attention (reach × dwell), and the high-reach
formats (document, image) are also high-dwell, so a reach chaser's pipeline rises with its reach.
Of 200 reach-chaser runs, 73 end as The Generalist (coherence < 0.35 is checked first), and 83 of
the remaining 127 reach the top quartile with a working or hot pipeline. Cutting generic visits and generic
dwell (visitsBase 0.07 → 0.02, visitsSpecific 0.10 → 0.15, generic dwell 1.0 → 0.8) moves it one
point. Closing the gap needs a structural decision, not a coefficient: for example, a pipeline term
that depends on coherence or specificity rather than held attention, or a Broadcaster rule tied to
the player's own reach-to-pipeline ratio.

Step 3 (v1.1): friends' exports.

## 12. Visual system (lab notebook)

- Site navy background; the game on a paper panel (game tokens: `--rc-paper`, `--rc-rule`,
  `--rc-ink`, `--rc-margin` red, and four stamp inks). Faint grey rules, thin red margin, no blue.
- DM Sans for titles/copy; every number DM Mono tabular on a fixed grid.
- Post card: index-card proportion, red top rule, title, hours top-right, five dimension tags along
  the bottom, dashed empty circle top-left where the stamp lands.
- Stamps: circular double ring, tier word in capitals, seeded rotation (same card, same angle),
  SVG turbulence filter for ink grain. Inks: Proven deep green, Measured ochre, Disputed plum,
  Invented red. Word always printed (colour-blind safe). The most screenshot-legible element.
- Event card: charcoal stock, torn top edge (SVG mask), translucent tape strip.
- Feed abstraction: narrow column of grey rounded blocks, your block outlined Signal Green (the only
  site-accent use in the game); a soft light band travels down, lingers on your block for dwell or
  slides past; contribution ticks stack beside it. No avatars, no text.
- Strip chart: 6 rows (impressions, held attention, contributions, profile visits, DMs,
  fingerprint) × 12 columns, shaded ink squares scaled per row, event columns hatched; tap a column
  for its numbers.
- Motion < 400 ms per transition; stamp press-in ~280 ms from 1.3x with a settle; reduced motion →
  fades. No generated imagery, no audio.

## 13. Testing

Engine (`npm run test:rc`): determinism (same inputs → identical state and results across two
runs); resume (replaying a saved choice list at every week 1–12 reproduces the live state
exactly; version mismatch and corrupted saves are discarded); budget enforcement; every hand has an affordable card at 1h; every `CONFIG` entry and card
stamp resolves to a `SOURCES` id or is `ours`; archetype rule order; reach clamp; no card repeats
within a game; bait rate and one-per-hand cap; Interact at most once.
Sim (`npm run sim:rc`): §11 targets.
Browser: 390x844 and 360x780 with no scroll on setup/week/event screens, no horizontal scroll
anywhere, reduced motion, Plausible events firing, share fallback, email post shape.

## 14. Integration

- Plausible custom events: `rc_start`, `rc_setup_complete` {archetype, budget},
  `rc_turn_resolved` {week, card, stamp, engagement}, `rc_event_shown` {event},
  `rc_completed` {archetype, band, tax}, `rc_share`, `rc_replay`, `rc_email`, `rc_resume` {week}. Jason adds the
  goals in the Plausible dashboard. `rc_turn_resolved` fires 10× per game (counts toward quota).
- Kit: create the four custom fields via the Kit connector (with Jason's OK), then one test
  subscription with an address Jason supplies to confirm the fields land. Fallback if Kit ignores
  form-posted fields: drop the fields, keep the plain subscribe.
- `/privacy`: one sentence in "Podcast updates" noting the game's box also sends archetype, budget,
  folklore tax and headline type; bump "Last updated". Game state never leaves the browser.
- `/experiments` card, `_redirects`, passthrough, sitemap, CLAUDE.md row (§3).

## 15. Differences from the brief

| Brief | Spec | Why |
|---|---|---|
| Email: "written playbook for your archetype" | Building Value notify | Site convention; no playbooks exist |
| Five archetypes | Six (+ The Control Group) | Rules left a gap; six OG images |
| Kit tags | Kit custom fields | Plain form post; no API key or function |
| "Six predicted actions", "react" | "actions such as…", "like" | FeedSR lists are open; Dhélin overstates |
| 60-day half-life, position bias Proven | Cited as FeedSR **v1** only | Removed in v2/v3 |
| "~1,000-post memory" | "~1,000 recent impressions" | FeedSR §4.2.1 |
| "LinkedIn describes the narrowing as intentional" | "LinkedIn says it chose relevance over reach" | Unsupported; Jurka 2026 says the reverse |
| "Thoughts?" Proven policy | Invented; "Comment YES" carries Proven | Jurka quotes "Comment 'Yes'", not "Thoughts?" |
| Swarm: 80% AI comments, Measured | Jurka anti-automation, Proven | vdB figure is an anecdote |
| Text = 1.0 baseline | text 1.07 / 0.78 | Baseline is the profile median |
| Short video 0.86, long video 1.05 | 0.83 / 1.04, derived | 0.86 is all video; 1.05 unsourced |
| Hashtags 0.97 / 0.85 Measured | direction Measured, magnitude ours | Figures not in source |
| Link in body −18.8% | −16% | vdB public newsletter, Jul 2026 |
| Interact 80M, 59.1% | 100M+, (59.1% unused) | Report updated Sep 2026 |
| Saywhat as Disputed evidence | dropped | Secondary only, contradicted by vdB 2026 |
| Cadence 2–4/wk Measured | ours, quotes vdB's 2–3 | 2–4 was the host |
| Skip-week coherence Measured | ours | Unnamed secondary source |
| 1.44 / 6.60 / 24.42% Invented | Disputed | Conflicting vendor measurements |
| "March 2026 Authenticity Update" | event Proven, label folklore | Jurka post is real |
| Jason's multipliers 1.25/0.8/1.3/1.5/1.2 | 1.10/0.90/1.2/2.0/1.5 | Re-derived from the CSV |
| contrib_p = dwell_p × … | format term from measured eng ÷ reach | Avoid double-counting |
| Title "Twelve Weeks" | "80% of Your Comments Are Robots" / "And they love you"; `/robot-comments` | Jason, 2026-09-28; title self-stamped (§1) |
| "No saving progress" | Same-device resume via replayed choice list | Jason, 2026-09-28 |
| Distribution loop on absolute probabilities | normalised to base dwell/contribution; scroll term dropped | Absolute form shrank reach for 39 of 47 cards and made the contribution term inert |
| DM rate 0.04, integer pipeline | 0.12, one decimal | Integer rounding showed 0 or 1 for small archetypes |
| profile_visits = reach × (…) | held attention × (…) | Brief's formula made the poll bait raise pipeline, contradicting its own "pipeline near zero" |
| Tax reframe "traced to nothing" | "shortcuts you took on someone else's word"; gatedgame excluded | Poll/hashtag bait is Measured; gatedgame works |

## 16. Sources

**Proven**
- `feedsr` Hertel, Srivastava et al., *An Industrial-Scale Sequential Recommender for LinkedIn Feed
  Ranking*, arXiv 2602.12354 (v1 Feb 2026; v3 Sep 2026, CIKM 2026). https://arxiv.org/abs/2602.12354
  · v1-only claims: https://arxiv.org/abs/2602.12354v1
- `danchev` Danchev, *Engineering the next generation of LinkedIn's Feed*, LinkedIn Engineering,
  12 Mar 2026. https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed
- `jurka26` Jurka, *Updates to The LinkedIn Feed Focusing on Authentic, Relevant Conversations*,
  12 Mar 2026. https://www.linkedin.com/pulse/updates-linkedin-feed-focusing-authentic-relevant-tim-jurka-umwnc
- `jurka24` Jurka, 28 Feb 2024. https://www.linkedin.com/pulse/how-linkedin-focused-surfacing-right-content-worlds-tim-jurka-bvzhc
- `dwell2020` Dangi et al., *Understanding dwell time to improve LinkedIn feed ranking*, 2020.
  https://www.linkedin.com/blog/engineering/feed/understanding-feed-dwell-time
- `lirank` Borisyuk et al., *LiRank*, KDD 2024. https://arxiv.org/abs/2402.06859
- `brew360` Firooz et al., *360Brew*, arXiv 2501.16450 (withdrawn; self-described pre-production).
  https://arxiv.org/abs/2501.16450

**Measured** (all vendor or tool-customer biased; the source sheet says so)
- `authoredup` AuthoredUp, *Best Performing Content on LinkedIn*, 3M+ posts, personal profiles,
  Mar 2025–Feb 2026. https://authoredup.com/blog/best-performing-content-on-linkedin ·
  https://authoredup.com/blog/linkedin-trends
- `vdb` van der Blom, *Algorithm Insights 2026* (paid). Author on record:
  https://podcast.creatorscience.com/richard-van-der-blom-2/ · public link data: his LinkedIn
  newsletter, 26 Jul 2026 · https://richardvanderblom.com/
- `interact` Interact, *Quiz Conversion Rate Report* (updated 8 Sep 2026).
  https://tryinteract.com/blog/quiz-conversion-rate-report/
- `jason107` Jason Nellis, 107-post analysis, Jul 2026; re-derived 28 Sep 2026. One account,
  engagement not reach, single coder.

**Disputed** (link effect): `vdb`, `ordinal` (Ordinal link study, vendor, unpublished method:
https://www.tryordinal.com/blog/linkedin-link-penalty-study), `authoredup`.

**Invented** (cited as examples of the folklore, not evidence)
- `dataslayer` https://www.dataslayer.ai/blog/linkedin-algorithm-february-2026-whats-working-now
  (60% link penalty, 0.07% polls, "360Brew" replaced ranking, "Authenticity Update" label)
- `digitalapplied` https://www.digitalapplied.com/blog/linkedin-algorithm-2026-engagement-strategy-guide
  (60% link penalty, Depth Score)
- `linkboost` https://www.linkboost.co/blog/what-content-performs-best-linkedin-2026/ (Depth Score,
  1.2%→15.6% dwell buckets)
- `nosource` No primary source or study found (checked Sep 2026); LinkedIn's bait examples don't include it. Used by the "Thoughts?" card.
- `dhelin` Dhélin, *The LinkedIn Algorithm 2026: what is proven, what is measured, what is
  invented*, Fast Growth Advisors, Jul 2026 (tiering method; names +21% pre-commenting and dwell
  buckets untraceable). https://fast-growth.fr/en/white-paper/linkedin-algorithm-2026/

## 17. v1 scope

Ships: everything above. Deferred to v1.1: fatigue debt + The Overdrawn, friends' calibration
data, Kit bridge sequence, desktop polish, extra bait cards, more OG variety.

## 18. Open items before launch

- Copy: I draft all game copy (47 card titles, why-line templates, 4 events, 6 diagnoses +
  taglines, intro, podcast paragraph) to the brief's house rules; Jason edits before launch.
- Jason: Plausible goals.
- Jason's OK: Kit custom-field creation and one test subscription.
