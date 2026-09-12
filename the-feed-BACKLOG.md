# The Feed — project state & backlog

*The Feed* is a content-creator life-sim game on this site. This file is the
working memory for it: what's done, what's deferred, and enough detail to pick
the deferred work back up without re-deriving anything. (Not built by Eleventy —
listed in `.eleventyignore`.)

Live at **`/the-feed`** and **`thefeed.jasonnellis.com`**. Currently `noindex`
and not in the nav (deliberately unlisted while in progress).

The rework was three sub-projects, specced in `docs/superpowers/specs/` — all
shipped: **A. core loop** · **B. event deck** · **C. social-app reskin** (see
each below). Remaining open work: the ending → essay CTA (blocked on essays) and
the deferred leaderboard.

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

- **52 weeks.** Each week: **2 content slots + 1 business slot** (the Studio
  raises content to **3** — see "Studio 3rd content slot" below). Leaving a
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
  $3,000/wk lease, views ×2.3, −6 stress/post, +1 content slot (2→3), needed
  for >2 hires; unlocks at tier 3 + 25K followers) · Launch membership ($4/member/week, 2.5% new-
  follower conversion, 4% churn — 12% in a week you post nothing; recomputed
  weekly) · **Team** (Editor / Manager / Mod / Designer; hire & fire; weekly
  payroll).
- **Overhead** = $60 + $10/platform + payroll + lease. No hidden creep.
- Eight endings. Bankrupt floor is −$2,500. The growth endings read their
  thresholds from `CONFIG`: Niche Legend at 37K followers (rep ≥55), Viral
  Star at 70K, G.O.A.T. at 320K (raised from 200K when the Studio 3rd slot
  lifted late-game output — see below).

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

## Shipped: sub-project C — social-app reskin

The game now *looks like being a creator*: a **phone-width "Sticker Feed" app
column** (one layout at every width — the desktop view is the mobile view
centered, so the old mobile stacking bug is gone by construction). Four tabs:
**Home** (this week's cards) · **Alerts** (the feed as notifications with fake
@handles, engine text kept verbatim) · **Inbox** (events arrive as DMs, choices
as reply chips — the forced weekly decision is preserved) · **Stats** (four
sparklines off a UI-only weekly-history array). Emoji-as-icons replaced by a
**bespoke solid SVG icon set** (~19 glyphs, selective color: mono chrome +
red-active, platform icons in their engine colors, semantic meters). Skin is
Jason's own brand let loose — navy #0B1E38 base, signal green #00E676 thread,
**YouTube red #FF0033** as the pop/active, gold + blue, Space Grotesk + DM Mono,
2px borders + hard offset shadows. Start + end overlays reskinned to match
("create account" / "year in review"); the ending Substack CTA target is
unchanged.

Chrome only — `the-feed-engine.js`, the sim, and the tests were **not** touched
(engine tests stay 58/58). The float-anchor contract (`v-cash`/`v-rep`/
`v-stress`/`cc-<key>`), the Kenney sound layer, `noindex`, and Plausible are all
preserved. The per-line feed/event **narrative emoji stay** (out of scope). The
game still doesn't load `nav.js`. Spec + plan:
`docs/superpowers/{specs,plans}/2026-09-11-the-feed-social-app-reskin*`.

The **OpenMoji** entry in `the-feed-assets/CREDITS.md` can now be deleted — the
reskin removed emoji as the icon system (see "Dropped — OpenMoji" below).

---

## Shipped: desktop console (responsive multi-pane)

The old reskin was one 440px phone column centered at **every** width, so
desktop wasted the horizontal space and forced scrolling + tab-hopping —
worst right after a week settled, when results flooded Alerts and you had to
hop Home→Alerts→Stats to connect what you did to what happened.

Fixed with a **pure chrome/CSS layer** (engine, sim, tests, float anchors,
sound, `noindex`, Plausible all untouched — engine tests stay 58/58). At
**≥ 980px** the phone frame opens into a framed console (max-width 1180px,
same 2px border + shadow): full-width header on top, then three
independently-scrolling columns — **This Week** (cards + business) · **Live
Feed** (Alerts, always visible) · a right **rail** stacking **Inbox** over
**Stats**. The bottom tab bar is hidden. Below 980px it's **byte-for-byte
today's build**: single column, four tabs, tab bar — so the mobile-stacking
bug C killed stays killed.

How it's wired, for future edits (`the-feed.html` only):
- Inbox + Stats are wrapped in a `<div class="rail">`. On phone widths
  `.rail{display:contents}` makes it transparent to layout (panes stack in
  the tab flow as before); at ≥980px it becomes the third grid column.
- `render()` branches on `isWide()` (a `matchMedia('(min-width:980px)')`).
  Narrow = the old one-pane-at-a-time behavior. Wide = **every** pane is
  filled each render and all `hidden` flags cleared (the tab loop only fills
  the *active* pane, so showing all panes needs the JS branch, not just CSS).
- A `wideMQ` change listener re-renders when you cross the breakpoint.
- Start/end overlays stay phone-width centered dialogs at all sizes.

**Follow-up — decision-first rebalance.** The first console gave the *feed* the
widest column and squeezed the *decision* (content + business + end-week) into
the narrow 296px left lane: measured 1,407px of content in a 643px viewport,
with the "End the week" button 744px below the fold. Inverted IA — the thing
you interact with every turn had the least room. Reworked (desktop only): the
decision is now the widest column with **content and business side by side**
(`.decks`, an auto-fit 2-col grid inside `#tab-home`), the channel strip goes
horizontal (`.chanrow` row), and **"End the week" is a sticky footer**
(`.stagefoot`) so it's always visible. Feed + inbox/stats became rails
(`minmax(0,1fr) 320px 300px`). Scroll dropped from ~764px to ~264px and the
end button never leaves view. Mobile unchanged (decks are plain stacked blocks,
footer static).

**Follow-up — events use the workspace too.** With the decision now the widest
column, a pending event that stayed in the 300px rail meant the *forced choice*
sat in the narrowest lane while the wide workspace showed only a "Hold on"
card — idle prime space, eye-travel to the far right. Now on desktop the event
DM renders straight into the workspace (`renderEventDM(target)` takes a
container; `render()` passes `#stagebody` when wide + event, capped at 460px so
it reads as a chat), the rail inbox is hidden and Stats fills the rail. The old
`.rail.evt` expand-the-rail approach was removed. Mobile still shows events in
the Inbox tab exactly as before.

## Shipped: experience polish pass

A design/UX review after the console. Four fixes, all chrome-only (engine/sim/
tests untouched), verified both widths:

- **End-screen CTA hierarchy (#1).** The essay/Substack CTA is now the primary
  red action (value prop + arrow); "Run it back" is a `.btn.ghost`. The one
  action the game exists for finally wins the eye. Added `.btn.ghost` +
  `:focus-visible` rings. Sets up the blocked ending→essay link cleanly.
- **Desktop event moment (#2).** The left column no longer says "open your
  inbox" while the inbox is visible in the rail — on desktop it points right
  ("…on the right →"). A pending decision gets `.rail.evt`, which expands the
  inbox so its reply chips are never clipped by the old 46% cap (Stats shrink
  below). `render()` toggles `.evt` on `S.phase==='event'`.
- **Week-recap payoff (#3).** After each settle, a line pins to the top of the
  Live Feed — `WEEK N · WRAPPED · +X followers · +$Y · stress A→B`. Deltas from
  the UI-only `hist` snapshots via new `lastRecap`/`computeRecap()`;
  `recapCard()` prepends it in `renderFeed`. Desktop feed column + mobile
  Alerts tab.
- **Header meters (#5).** On wide desktop the Stress/Reputation bars stretched
  half the header; now a left-aligned instrument cluster (200px gauges +
  Bank/Overhead), no dead centre. Mobile unchanged.

Two more review findings, now also shipped (engine text only — mechanics
untouched, tests stay 58/58, sim 6/6):
- **#4 feed repetition (fixed).** A post's evergreen tail earns for 4 weeks, so
  its "still getting found" line stacked in the feed. Two-part fix: the engine
  now emits **one summary line per week** for all tails (`settleWeek` —
  "‘topic’ is still getting found" for one, "N older posts are still earning"
  for several) instead of one per tail; and `renderFeed` keeps only the **most
  recent** tail line in the view, so the same headline never stacks across
  weeks. Mechanics identical (each tail still pays out).
- **#6 burnout ending copy (fixed).** The burnout blurb read "Feeding N
  platform(s) at once…" (spread-too-thin) but fired at 1 platform, where it was
  singular-awkward and logically backwards. Added a `blurb1` variant on the
  burnout ending; `endingText` uses it when `activePlats === 1` ("You kept
  posting through it, week after week, until there was nothing left to post
  with"). The n≥2 template is unchanged (the test still asserts "Feeding 2
  platforms").

## Shipped: Studio 3rd content slot + Team/Studio rail panel

Two linked changes so a built-out operation *feels* like one.

**Studio unlocks a 3rd content slot (2→3).** Previously the whole game was
locked to 2 content + 1 business no matter how much you'd built — a full
studio + four staff shipped the same two posts as a broke beginner, which
broke the fiction. Now the Studio (tier 4) is the capacity gate: it already
raised the hire cap 2→4, so it also raises weekly content 2→3. Business stays
1. Capped at 3 (not more) so the forced "which posts?" scarcity — the point of
the game — survives; the 3rd post still costs (reduced) stress, so it's a real
decision, not free output.

- Engine (`the-feed-engine.js`): `CONFIG.slotsContentStudio: 3`, a
  `contentSlots(S)` helper (`hasStudio(S) ? 3 : 2`), used by `advanceWeek` and
  exported. Studio purchase feed line now mentions the extra slot.
- Balance: the 3rd slot ~doubled studio-player output (growth is **super-**
  linear at that scale, not near-linear as the old note assumed), sending
  Optimizer GOAT 21→61%. Re-tuned two knobs: `studioViewsMult` 2.8→2.3 (studio
  still a clear net boost — Optimizer median 129K→**203K** — via volume) and
  `goatAt` 200K→**320K** (if creators produce more, "biggest on the planet" is
  a higher bar). Final: **all 6 `npm run sim` targets green across seeds
  7/42/123/999 + unseeded**; Optimizer GOAT 17–22%, Star ~70%. Non-studio
  paths untouched (Sustainable Legend 56%, Grinder burnout 15w). Engine tests
  58/58.
- Sim: The Optimizer persona now fills up to `E.contentSlots(S)` (was hardcoded
  to 2) — without this the sim wouldn't exercise the 3rd slot at all.
- UI (`the-feed.html`, chrome only): content deck label + slot pill read from
  `contentSlots(S)`; studio purchase card advertises "+1 content slot".

**Team/Studio rail panel replaces the dead desktop Inbox box.** After the
console rework, the rail Inbox could never show anything on desktop (events
render into the workspace, so it always read "No messages"). `renderInbox()`
now renders a live **Studio panel** (`renderStudio`) when wide + no event:
setup/studio status (incl. the slot count it buys), team roster + payroll,
overhead breakdown, and the week's remaining capacity. Mobile Inbox tab
unchanged (events still land there). Verified both states live in the browser.

## Shipped: UI review pass (2026-09-12) — thumbnails + readability

Jason's read: the game "felt too AI-esque". Two reviews agreed on the tells —
every surface the same bordered card, 8–10px mono-uppercase eyebrows as the
only structural device, emoji next to flat SVG, nothing ever big, none of the
creator world's own visual language on screen. Five chrome-only changes
(`the-feed.html`; engine/sim/tests untouched, tests 58/58):

1. **Verbs + copy.** Content cards carry a `Post ▸` / `Open ▸` / `Cross-post ▸`
   chip; a week-1 `.loophint` says a tap posts immediately and an empty slot
   is a rest. Header/end-screen "following" → "followers". Stress band reads
   "Stress · on fumes" in sentence case.
2. **Type floor + labels.** Nothing below 11px (thumb chrome excepted);
   mono-uppercase eyebrows retired everywhere — labels are sentence-case DM
   Sans 600, mono is reserved for numbers and @handles. Stress sparkline is
   coloured by band (gold / red) and each stat shows its net change since
   week 1 (`.statd`).
3. **Informed End-the-week + a11y.** The button reads what's unused
   ("1 post and 1 business move unused · an empty post slot is a rest") and is
   outlined (`.idle`) until the week's work is out, then filled red. Start
   pickers are real `<button role="radio">` groups with roving tabindex and
   arrow keys.
4. **Results in place.** A UI-only `weekLog` (cleared in `advance()`) records
   each move's deltas (views / followers / cash / rep / stress / members,
   computed from `capture()` before/after) and `renderMoves` prepends a
   `.posted` stub above the deck — so on mobile the result never lives in
   another tab. Business moves get the same stub.
5. **Thumbnail cards + one icon language.** `thumbHTML(m)` generates a fake
   16:9 thumbnail per content card from the topic string: platform-colour
   wash, angle-specific overlay (trend stripes / evergreen glow / personal
   gold), the first 2–3 words huge in **Anton** (sized in `cqw` to fit),
   angle sticker, duration/`LIVE`/`POST`/`ISSUE` badge, platform glyph. Posted
   stubs reuse the thumb desaturated with a green "Posted" sticker. Mobile:
   thumb-left rows (YouTube list). Desktop ≥980px: decks stack and content is
   a 2-up grid of stacked thumbs (`.moves.vgrid`), business a 2-up row grid.
   Every emoji in the chrome is gone: niche glyphs (`i-niche-*`), feed lines
   by kind (`FEED_ICON`), event DMs + reply chips (`CHOICE_ICON`), endings
   (`END_ICON`), flags. The engine's emoji fields are still emitted, just not
   rendered. `CREDITS.md` updated (OpenMoji stub removed; Anton/Space Grotesk
   listed).

Rejected from the second review: select-then-publish (slows a 10-minute game,
needs engine staging), cash runway, a strictly semantic palette (that is the
dashboard look), collapsing the channel card.

**Follow-up pass (same day), from the second review's next five:**

- **No duplicate completed actions.** A business move made this week hides
  its disabled twin (`bizCards` filters on `weekLog[].id`); its `.posted`
  stub carries a green check. **Engine (one line, `postCard`):** the
  keep-the-topic-you-saw rule now skips topics in `S.usedTopics` for the
  current week, so a just-posted topic is never re-dealt. Tests 58/58, sim
  6/6 unchanged.
- **Business collapses once the move is spent.** `noBiz` renders the done
  stub plus a `<details class="bizmore">` ("Other business options · N · back
  next week"); open state is UI-only (`bizMoreOpen`, reset in `advance()`).
- **Phone header.** Followers is a two-line metric so the channel name gets
  room (name clamps to 2 lines, niche line hidden on phones). Overhead is a
  button (`#ovbtn`) that toggles the breakdown line (`.app.ovh`). Scrolling
  past 56px adds `.app.compact` (smaller avatar, tighter padding); the
  listener watches both `window` and `.tabbody` because on phones the
  document scrolls, on desktop the panes do.
- **Desktop.** `.chancard` capped at 250px so one platform doesn't balloon;
  the Stats rail shows current values from week 1 ("Trend from week 2")
  instead of an empty-state line.
- **Action vs outcome colour.** Action chips (`.go`) are white-outlined,
  hover is white; green is reserved for outcomes (Posted sticker, check,
  followers, rep). "Open ▸" → "Add channel ▸". Posted stubs lost the green
  left bar (quieter `--sf-line-2` border).
- **Precision.** Float pops round to whole numbers (`roundFloat`) so they
  agree with the in-place stub and the header.

## Shipped: channel strip — each platform in its own format

Jason's note after the thumbnail pass: channels stacked in the left column
pushed decisions down as platforms were added, and the tier "rectangles and
dots" meant nothing. Both fixed, chrome-only plus one engine export.

- **Layout.** `#chanstrip` is a full-width first row above the three desktop
  columns (`.tabbody` gets `grid-template-rows:auto minmax(0,1fr)`; the strip
  spans `1/-1`). On phones it's the same horizontal, snap-scrolling row at the
  top of Home (`hidden` toggled with the tab). Decisions no longer move as
  platforms are added.
- **Cards are the platform's own artifact**, built from real state
  (`channelCard` / `channelArt`): Longform = a shelf of three 16:9 videos;
  Short Video = three 9:16 clips; Microblog = the latest post as a post with
  @handle; Newsletter = an inbox of numbered issues with "opens"; Live = a
  stream tile that reads LIVE (pulsing) the week you stream, OFFLINE after.
  Each tile shows that post's topic (Anton big words, `cqw`-sized) and views.
  Empty slots are dashed placeholders with platform-specific empty copy.
- **Data.** A UI-only `postLog[pkey]` (last 3 `{topic, views, week, hit}`
  per platform, written in `takeMove`, reset in `newGame`) feeds the art.
  Never enters `S`/engine/sim/tests.
- **Rectangles + dots replaced by things that mean something:** followers
  with the platform's noun (subscribers / followers), the tier as a text
  badge, a **progress bar to the next tier** with "N more posts to X" (tiers
  cut on `platPolish` = posts×3 + gear×9 — now exported from the engine so
  the UI doesn't duplicate the formula), and up to two status chips that
  drive decisions: **Hot right now** (heat ≥52), **Audience tired**
  (fatigue ≥52), **Idle Nw · churning** (≥ `CONFIG.idleWeeks`), **Proven**,
  else Steady.
- `channelSVG` and the `.chanmeta`/`.tierpill` CSS are gone. Float anchor
  `cc-<key>` is now the followers number in each card.

**Start screen (same day):** the name field is "Name your online persona"
(you end up with several channels); the first-platform picker is video only
(Longform · Short · Live — `['longform','shortform','live']` in `buildStart`,
no longer filtered on `unlock===0`; Microblog and Newsletter arrive as
expansions). A `.startfoot` under "Go live" credits Jason with a link, invites
replay ("every run ends differently") and carries a second "Get The Long Yes"
Substack link, same target as the end screen.

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

- Growth is **super-linear** at studio scale (confirmed while balancing the
  Studio 3rd slot — a ~50% output bump nearly doubled follower totals and sent
  GOAT 21→61% before re-tuning). Any large late-game follower injection still
  balloons GOAT; `goatAt` (now 320K) is the release valve.
- The Optimizer persona spreads across four platforms, which the engine
  currently punishes.
- Grinder median survival sits exactly on the 15-week target floor.

## Other noted ideas (not committed to)
- Inline email capture — no; Substack link-out is the right GDPR/maintenance call.
- Rivals / a shifting platform meta as a persistent system (B may cover this with events first).
