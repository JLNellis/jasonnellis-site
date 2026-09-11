# The Feed — project state & backlog

*The Feed* is a content-creator life-sim game on this site. This file is the
working memory for it: what's done, what's deferred, and enough detail to pick
the deferred work back up without re-deriving anything. (Not built by Eleventy —
listed in `.eleventyignore`.)

Live at **`/the-feed`** and **`thefeed.jasonnellis.com`**. Currently `noindex`
and not in the nav (deliberately unlisted while in progress).

The rework is three sub-projects, specced in `docs/superpowers/specs/`:
**A. core loop** (shipped) · **B. event deck** (shipped — see below) ·
**C. social-app reskin** (next). The spec + plan for C get written when it starts.

---

## Architecture (shipped)

- **`the-feed.html`** — the game page. Standalone (does not load `nav.js`),
  styled in the site's Bolt OS system via `/colors_and_type.css` tokens.
  Contains rendering, input, the sound layer, and the Substack end-screen CTA.
- **`the-feed-engine.js`** — the **single source of truth** for all mechanics,
  economy, events, and balance (`CONFIG` block at top). Pure/UMD. Imported by
  the game, the simulator and the tests, so they can't drift. State-mutating
  actions (including `settleWeek`) return an effect-log `{floats, feed, bump}`
  the browser animates and the sim ignores. RNG is injectable (`setRng`).
- **`tools/the-feed-sim.js`** — headless balance simulator with seven player
  personas. `npm run sim` (or `node tools/the-feed-sim.js 1200 report.html`).
  Its **⚑ BALANCE TARGETS** block encodes the spec's six exit criteria and the
  process exits non-zero if any fail. **To rebalance: edit `CONFIG`, re-run.**
- **`tools/the-feed-test.js`** — deterministic engine tests. `npm test`.
- **Sound** — Kenney CC0 pack in `the-feed-assets/sfx/`, mute persisted.
- **Capture** — end-screen CTA links to Substack; no email touches the game.
- **Analytics** — Plausible, inline snippet (page doesn't load `nav.js`).
- **Assets/licenses** — `the-feed-assets/CREDITS.md`.

## The game, mechanically (after sub-project A)

- **52 weeks.** Each week: **2 content slots + 1 business slot**. Leaving a
  slot empty is how you rest.
- **Stress** (0–100) replaces energy. Bands: <50 normal · 50–69 running hot ·
  70–89 on fumes (views −15%) · ≥90 redline. Three redline weeks = Burnout.
  Every band change is announced in the feed. Recovery is 23/week plus 18 per
  empty content slot; bands are judged on the stress you ended the week's work
  at, before that recovery is applied. Post costs: longform 13, shortform 10,
  micro 6, newsletter 12, live 16 — Personal angle adds +6, Engage costs +1,
  a brand deal costs +4.
- **Content cards** are dealt each week: platform × **angle** × authored topic
  line (`TOPICS` in the engine, 5 per niche per angle, 8-week cooldown).
  Angles: **Trend** (×1.6 views, ×0.5 conversion, cohort churns 2×, may age
  badly) · **Evergreen** (×0.8 views, ×1.3 conversion, 4-week tail of 15%
  views/week) · **Personal** (+rep, +6 stress, may overshare).
- **Views → followers → money.** Posts produce views; followers = views ×
  conversion; ad revenue = views × per-view RPM. Followers **churn** (0.6%/wk
  base, trend cohort 1.2%, 2% when a platform is idle 3+ weeks) and hostile
  events cost followers.
- **Business** (one/week): Engage · Brand deal (base $150, scales with
  followers and rep, pays more at high rep; a Manager adds ×1.3) · Upgrade
  gear (3 tiers, +10% views each) · **The Studio** (tier 4: $12,000 up front +
  $3,000/wk lease, views ×2.8, −6 stress/post, needed for >2 hires; unlocks at
  tier 3 + 25K followers) · Launch membership ($4/member/week, 2.5% new-
  follower conversion, 4% churn — 12% in a week you post nothing; recomputed
  weekly) · **Team** (Editor / Manager / Mod / Designer; hire & fire; weekly
  payroll).
- **Overhead** = $60 + $10/platform + payroll + lease. No hidden creep.
- Eight endings. Bankrupt floor is −$2,500. The growth endings read their
  thresholds from `CONFIG`: Niche Legend at 37K followers (rep ≥55), Viral
  Star at 70K, G.O.A.T. at 200K.

### When ready to launch publicly
1. Remove `<meta name="robots" content="noindex">` from `the-feed.html`.
2. Add a nav entry (`NAV_LINKS` in `nav.js`) or link it from a tools page.
3. Consider adding it to `sitemap.njk`.

---

## Shipped: sub-project B — event deck expansion

Deck grown **10 → 30 cards** with per-run non-repeat tracking (`S.seenEvents`;
four generic beats stay `repeatable`) and phase gating (`minWeek`/`maxWeek`
against `CONFIG.phases`), so a run stays fresh to week 52 without the old
review-bomb repetition. Added a **threat cash-sink sub-deck** — tax bills
(scaled to `S.grossEarned` since the last one, via `CONFIG.taxRate`),
demonetization, gear failure, sponsor clawback, surprise life expense — plus a
growth/variety sub-deck (collab offers, platform beta, press, copycat, editor
quitting, sponsor pullout, seasonal CPM, awards nod, annual reckoning, brand
inbound, milestone). Sinks are **progressive**: each is capped at a fraction of
cash-on-hand (`bite` helper), so they drain hoarders hard but never bankrupt a
lean player. Deterministic tests cover non-repeat, phase gating, gross
accumulation and sink mechanics; **all six `npm run sim` balance targets stay
green** across seeds. No arc sequencing, no lingering multipliers, no UI change
(that's C) — the browser was untouched.

**Resolved open item — meaningless cash:** the threat sinks make cash matter
*during* a run (a tax bill or demonetization you must absorb; a buffer worth
keeping). End-of-run hoard for non-Studio winners dropped from ~$85–99K to
~$64–72K. It is reduced, not eliminated — winners still keep earning in the
final weeks after the last tax event. Draining further would need a recurring
late sink (more mechanics); left as-is deliberately. No 7th balance target was
added.

## Next: sub-project C — social-app reskin

Make the game *look like being a creator*: a phone-shaped fake social app
(Home = this week's cards, Notifications = the feed with fake usernames and
comments, Inbox = events arrive as DMs, Stats = sparklines), Bolt OS tokens
only for the chrome. Drop emoji-as-icons for a small bespoke icon set. Fix the
mobile stacking order (moves above meters). Ship the engine's data as-is.

---

## Priority item — ending → essay CTA (blocked on content)

Each ending's Substack CTA should link to a specific essay on that ending's
theme (Burnout → an essay on creator burnout, Sellout → one on brand trust,
etc.). **Blocked until the essays exist.** When they do: add an `essay` URL
per `ENDINGS` entry in the engine and swap the end-screen CTA copy/link.
This is the whole reason the game exists — do not let it slip.

## Deferred — high-score leaderboard (Netlify Blobs)

Defer until after C. Client-submitted scores are spoofable (acceptable for a
toy board with clamping + rate-limits). Score should be a composite (followers,
rep, weeks survived, ending), not raw followers. Plan when picked up: `npm i
@netlify/blobs`, `netlify/functions/submit-score.mjs` + `top-scores.mjs`,
board UI on the end screen. Display name only, never email.

## Dropped — OpenMoji

Consistent emoji would polish the exact thing the reskin removes (emoji as the
icon system). Not doing it. The OpenMoji entry in `CREDITS.md` can be deleted
when C ships.

## Open items

Notes from the latest balance pass, not yet actioned:

- The Star → GOAT gap is only ~2.9× because growth is near-linear. (B's growth
  cards were tuned down specifically to keep Optimizer GOAT ≤25% — the near-
  linear growth is sensitive to any large follower injection.)
- The Optimizer persona spreads across four platforms, which the engine
  currently punishes.
- Grinder median survival sits exactly on the 15-week target floor.

## Other noted ideas (not committed to)
- Inline email capture — no; Substack link-out is the right GDPR/maintenance call.
- Rivals / a shifting platform meta as a persistent system (B may cover this with events first).
