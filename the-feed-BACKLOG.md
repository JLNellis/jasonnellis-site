# The Feed — project state & backlog

*The Feed* is a content-creator life-sim game on this site. This file is the
working memory for it: what's done, what's deferred, and enough detail to pick
the deferred work back up without re-deriving anything. (Not built by Eleventy —
listed in `.eleventyignore`.)

Live at **`/the-feed`** and **`thefeed.jasonnellis.com`**. Indexed and listed
on the `/experiments` page (via `tool-index/the-feed.md`) and the homepage Experiments
teaser since 2026-09-14; not a top-level nav item itself.

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
- **Sound** — eight Pixabay-licensed MP3 cues in `the-feed-assets/sfx/` (see
  `CREDITS.md`), mute persisted. Two old cue names alias onto shared files.
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
  views/week) · **Personal** (+rep, +6 stress, may overshare). Cadence is
  never punished; repeating the same angle on a platform is (see "cadence
  fatigue removed" below), and a second post on one platform in a week is
  diluted ×0.8.
- **Views → followers → money.** Posts produce views; followers = views ×
  conversion; ad revenue = views × per-view RPM. Followers **churn** (0.6%/wk
  base, trend cohort 1.2%, 2% when a platform is idle 3+ weeks) and hostile
  events cost followers.
- **Business** (one/week): Engage · Brand deal (base $150, scales with
  followers and rep, pays more at high rep; a Manager adds ×1.3) · Upgrade
  gear (3 tiers, +10% views each) · **Studios** (three sequential steps after
  the kit — the spare room $3K down + $600/wk ×1.5, the lease $12K + $3K/wk
  ×2.3 with a 3rd content slot, the building $35K + $8K/wk ×3.3 with room for
  six; **no follower gate** — each step needs the deposit plus 3 weeks of the
  new overhead in the bank) · Launch membership ($4/member/week, 2.5% new-
  follower conversion, 4% churn — 12% in a week you post nothing; recomputed
  weekly) · **Team** (Editor / Manager / Mod / Designer / Producer / Analyst;
  hire & fire; weekly payroll; cap 2, or 3/4/6 by studio).
- **Overhead** = $60 + $10/platform + payroll + lease. No hidden creep.
- Eight endings. Bankrupt floor is −$2,500. The growth endings read their
  thresholds from `CONFIG`: Niche Legend at 37K followers (rep ≥55), Viral
  Star at 70K, G.O.A.T. at 320K (raised from 200K when the Studio 3rd slot
  lifted late-game output — see below).

### Launched publicly (2026-09-14)
`noindex` removed, listed on `/experiments` and the homepage Experiments teaser, in
`sitemap.xml` via the `tools` collection. The start screen's footer links
back to `jasonnellis.com/experiments`.

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
  spans `1/-1`). *(Superseded 2026-09-14 — the strip now sits at the top of
  the right rail; see "laptop console" below.)* On phones it's the same horizontal, snap-scrolling row at the
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
  drive decisions: **Hot right now** (heat ≥52), **Tired of <angle> posts**
  (angle repetition ≥ `tiredAt`), **Idle Nw · churning** (≥ `CONFIG.idleWeeks`), **Proven**,
  else Steady.
- `channelSVG` and the `.chanmeta`/`.tierpill` CSS are gone. Float anchor
  `cc-<key>` is now the followers number in each card.

**Start screen (same day):** the name field is "Name your online persona"
(you end up with several channels); the first-platform picker is video only
(Longform · Short · Live — `['longform','shortform','live']` in `buildStart`,
no longer filtered on `unlock===0`; Microblog and Newsletter arrive as
expansions). A `.startfoot` under "Go live" credits Jason with a link, invites
replay ("every run ends differently") and carries a second "Get Building Value"
Substack link, same target as the end screen.

## Shipped: first art package (illustrations)

Seven editorial illustrations (OpenAI image gen, 2026-09-13, prompts in
`the-feed-assets/imgs/prompts.json`, credited in `CREDITS.md`): an opening
scene plus one per niche. Jason's call: **art stays off the content cards**
(the generated Anton thumbnails are the signature; six niche images would
repeat on every card of a run). Used instead where one image per run fits:

- **Start screen** — `.card.intro` is two-column at ≥900px (opening scene
  fills the left 46%, form on the right, max 940px); on phones a 150px 16:9
  banner at `object-position:58% 40%`, hidden below 700px viewport height.
  `<picture>` serves `opening-creator-1280/768.webp`.
- **Niche picker** — tiles are `.pick.art` with the 320px niche image under a
  bottom scrim; square on phones (<480px) so the art shows above the caption.
- **Header** — `.hdr::before` paints the run's niche image at 20% opacity
  behind a left-to-right scrim (`--niche-art` set on `.app` in `newGame`).
- **Ending** — `#endArt` banner (16:6, masked fade) above the year-in-review.
- Overlay fix that came out of this: `.overlay` is flex + `.card{margin:auto}`
  so a card taller than the viewport top-aligns instead of clipping its top.
- Chip fix: a never-posted platform no longer reads "Idle 10w" at week 1.

Only WebP derivatives load (thumbs 9–41 KB, opening 66/137 KB); PNG originals
are archival. `NICHE_ART` in `the-feed.html` maps niche → file; more variants
are coming, so extend that table (and `art(k,w)`) rather than hard-coding.

**v2 library (same day, 38 images):** the PNG originals live in
`the-feed-assets/the-feed-art-library-v2/` — **gitignored and not deployed**
(`.eleventy.js` now passes through only `the-feed-assets/imgs`, `sfx` and
`CREDITS.md`; the v1 PNG duplicates in `imgs/` were hash-checked against the
library and removed). `imgs/manifest.json` (from the library, home paths
scrubbed) is the provenance record; the v1 `prompts.json` is gone. Derivatives
in `imgs/`: `thumbnail-<niche>-01..03-{320,640}`, `ending-<key>-{768,1280}`,
`studio-tier-0..4-{320,640}`, `avatar-<slug>-{64,128}`, opening 768/1280.
Wired in (`IMG`, `endingArt`, `studioArt`, `AVATAR`/`avatarHTML` in the
game file): **endings** — the end card banner is the ending's own scene
(3:2, niche art as fallback); **studio** — the desktop rail Setup card shows
`studio-tier-<S.gear>` (swaps on up/downgrade; `height:auto` matters because
the `<img height>` attribute otherwise beats `aspect-ratio`); **avatars** —
feed lines use a portrait for the six illustrated handles and a mono
letter tile for the other eight (kind colour stays on the left border; the
kind glyph is gone); **header backdrop rotates by phase** — `paintBackdrop()`
picks `thumbnail-<niche>-01/02/03` for early / mid / late (`CONFIG.phases`,
i.e. switches at weeks 18 and 36), so a run visibly ages. Jason chose this over
putting the variants on content cards (art stays off the Anton thumbnails).

## Shipped: feedback round (2026-09-13)

Six playtest notes from Jason, spec in
`docs/superpowers/specs/2026-09-13-the-feed-feedback-round-design.md`:

1. **Idle churn ramps (engine).** A platform idle 3+ weeks still churns a
   flat 2%, but once *nothing* has been posted anywhere for that long each
   further silent week adds `churnIdleRamp` (2.5 pts), capped at
   `churnIdleCap` (12%): weeks 3/4/5/6/7+ → 2/4.5/7/9.5/12%. Eight silent
   weeks now takes 10K → ~6K (was ~8.7K). Keyed on **account-wide** silence
   deliberately — a per-platform ramp sank the Optimizer's GOAT rate 22→10%
   and pushed the Diversifier to 95% Faded, because both spread across four
   platforms. New exports `silentWeeks`, `silentWeeksAll`, `idleChurnRate`;
   a sharper feed line past 7%; channel chip reads `Idle Nw · bleeding N%`
   from 5%. Tests 59/59; sim 6/6 on seeds 7/123 and identical to baseline on
   42 (Grinder 14w there is pre-existing).
2. **Stats rail → header trend row (desktop).** The four sparklines live
   under the meters (`.trendrow`, ≥980px only); followers is a weekly
   net-change bar chart with gold ticks on event weeks (`hist[].evt`, set
   from a UI-only `evtThisWeek` flag). `#tab-stats` is `display:none` on
   desktop and the rail is the Setup/Team panel alone. Mobile Stats tab
   unchanged.
3. **Team is a dialog.** The Team card carries a `Manage ▸` chip and opens
   `<dialog id="teamDlg">` (centred on desktop, bottom sheet on phones).
   Hire/fire closes it and renders the stub as before. `teamOpen` is gone.
4. **Copy pass.** ~50 strings rewritten deadpan/specific (event outcomes,
   business results, band messages, card blurbs, empty states). No numbers
   changed; every phrase a test or the UI matches on is preserved.
5. **Kit multiplier ladder.** The Setup card headline is the live reach
   multiplier (`kitMult`: 1.1^tier, Studio ×2.3 on top) with a 5-step
   ladder and the next step's cost/unlock; the upgrade card reads
   "Views ×a → ×b".
6. **Sounds.** Kenney set replaced by eight Pixabay cues (see `CREDITS.md`),
   mono MP3, peak-normalised; `level`/`week` alias onto `hit`/`post`.
   Chosen on duration/loudness/author cohesion, not by ear — audition them.

## Shipped: lifestyle creep + tax accrual + team portrait slots (2026-09-13)

Follow-ups from Jason's read of the Overhead card and the Team card:

- **Lifestyle creep (engine).** `CONFIG.livingSteps` = `[[15000,150],
  [25000,400],[50000,800],[100000,1500]]`: living cost steps up with **peak**
  followers (`S.peakFollowers`, judged in `settleWeek` before churn) and never
  steps back down; each step is announced once (`LIFESTYLE_MSG`). This is the
  recurring late sink the "meaningless cash" note asked for: median end cash
  Sustainable $82K→$67K, Optimizer $133K→$84K, Diversifier $66K→$59K; the
  Minimalist (peak ~8K) is untouched. Tuning notes: a gentler ladder
  (120/250/500 at 10/50/100K) barely moved the hoard; the steeper ladder with
  a 10K first step tipped the Grinder to 14w on every seed (the few Grinder
  runs that cross 10K went Broke before Burnout), so the first step sits at
  15K. Sim 6/6 on seeds 7/123, seed 42 identical to baseline. Tests 61/61.
  New exports `livingStep`, `livingCost`, `taxOwed`; `overheadBreakdown`
  carries `livingStep`.
- **Tax accrual (UI).** The Overhead card and the phone helpline show "Owed in
  tax" = `taxOwed(S)` (35% of gross since the last tax event) so the bill is
  watched, not sprung. Read-only; the tax events still settle it.
- **Team portraits.** `hireAvatarHTML(role)` renders
  `avatar-hire-<role>-{64,128}.webp` in a 40px circle in the Team dialog and
  a 20px one on the Setup card roster chips; the `<img>` hides itself on error
  so the role glyph shows until the files exist (expect four 404s in the
  console until then). Prompts for the four images:
  `docs/the-feed-hire-avatar-prompts.md`. When the PNGs land in
  `the-feed-art-library-v2/avatars/`, derive 64/128 WebPs into `imgs/` and
  add them to `manifest.json`.

## Shipped: cadence fatigue removed (2026-09-13) — and the slot question

Jason's note: "platform fatigue with regards to content generation isn't
really a thing." Researched platform guidance + large-sample data (YouTube,
TikTok, Instagram/Mosseri, Twitch, newsletter benchmarks, Buffer/Socialinsider):
more posting → more total reach and growth; consistency beats bursts; a
missed week underperforms baseline; the only measured *audience* cost of
frequency is newsletter unsubscribes; "audience fatigue" in the literature
is about repetitive topics, not cadence. The old mechanic (fatigue +10–20 per
post, decaying only in weeks you didn't post, ×0.55 card mod past 52 plus a
views scale toward ×0.5) punished two posts a week on one platform at ~×0.28
from week 4 on — the opposite of the evidence, and a duplicate of stress.

Replaced with three things the data does support (`CONFIG` block
"Cadence is NOT punished"):
- **Same-week dilution** — each extra post on the same platform in the same
  week multiplies views by `sameWeekDilution` (0.8). `p.weekPosts` counts,
  reset in `advanceWeek`.
- **Repetition meter** — `p.fatigue` is now *angle repetition*: same angle
  as `p.lastAngle` on that platform +20, a different angle −20, every
  platform decays 8/week regardless of posting. Past `tiredAt` (52) only the
  same-angle card is ×`tiredViewsMult` (0.7) and carries `tired`; the feed
  announces the crossing once. Chip reads "Tired of trend posts"; card flag
  "Same angle again". Proven bonus is off while tired.
- **Newsletter over-send** — two issues in one week churn
  `newsletterOverSendChurn` (3%) of readers and
  `newsletterOverSendMemberChurn` (4%) of members, with a feed line.

Retune: removing the penalty tripled growth (Sustainable 60K→140K, Optimizer
190K→650K). `viewsK` 160→**70** restores the old curve almost exactly
(Sustainable 61K, Optimizer 187–203K, cash ≈ before) — sweep at 70/85/100/115
showed 70 is the only value where all six targets hold. **Sim 6/6 on seeds
7/42/123 at 600** (the seed-42 Grinder now makes 15w too). Tests 65/65. Side
effect worth knowing: focus is now rewarded over spread (Diversifier 43K→31K,
Chaos Gremlin studio rate 75%→47%) — that is the real-world shape.

**Slots: keep 2 content + 1 business, 3 content with the Studio.** Tested the
alternatives at viewsK 70, seed 7, 400 games:

| Variant | Result |
|---|---|
| 2 base · 3 Studio (current) | 6/6 |
| 3 base · 4 Studio | Grinder burns out at **5w** (3 heavy posts = 39 stress vs 23 recovery); Sustainable drifts to Star (Legend 33%); GOAT 49% |
| 3 base · 3 Studio | same Grinder/Sustainable failures; Studio loses its capacity identity |
| 2 base · 2 Studio | GOAT **3%** (need 10–25); Optimizer cash halves — the Studio stops paying for itself |

A third base slot would need the whole stress economy re-derived and would
make "post everything" the default; without the Studio's third slot the top
ending is effectively unreachable. The current split is the only one that
keeps the rest decision *and* a reason to buy the Studio.

## Shipped: views + money, platform picker, free cross-post, endings gallery (2026-09-13)

- **Lifetime views** is a header metric beside Followers, in the week-recap
  line, and a fifth desktop trend cell (weekly bars). **Money** replaces the
  Overhead card: earned this week so far (live), last week's earned + net,
  then overhead and its breakdown, then tax owed. The Bank trend cell is now
  weekly net bars. UI only — `hist` snapshots carry `views` and `gross`.
- **Platform picker.** `buildHand` deals ONE expansion card with
  `options` (every inactive platform whose follower threshold is met) and
  `pkey:null`; the card opens `#chanDlg`, which lists all five platforms
  with a plain-words personality line (reach/loyalty/pays/stress from
  `PLATFORMS`) and a **niche fit line** (`NICHE_FIT`, two per niche, words
  only, no mechanics), locked ones greyed with their unlock number.
  `takeMove(i, pkey)` fills the choice; `applyMove` falls back to
  `options[0]` so the sim's old behaviour is unchanged.
- **Cross-posting is a free follow-up**, not a card: after a post, its stub
  offers "Cross-post to <platform>" chips (`E.crossOptions`), once a week
  (`S.crossUsed`, reset in `advanceWeek`), +2 stress, lift halved
  (`crossLift` 1–3% of the source × heat), destination heat +6 and its idle
  clock reset. The Optimizer persona uses it every week it can; the runner
  treats `{cross}` as slot-free. That added ~10% to Optimizer output, so
  `goatAt` 320K→**340K**. Sim 6/6 on seeds 7/42/123 at 600; tests 67/67.
- **Endings gallery** on the end screen: "There are 7 other endings. You've
  found N of 8", eight tiles in a fixed order (faded → cancelled), the run's
  ending marked, previously found ones showing their art, every tile carrying
  an honest one-line hint (`ENDING_HINT` / `E.endingHint`, thresholds filled
  from CONFIG). Found endings persist per browser in
  `localStorage.thefeed_endings`. This replaces the leaderboard idea.

## Assessed, not adopted — Studio unlock by lifetime views (2026-09-13)

Question: should a comparable number of lifetime views open the Studio, in
addition to (or instead of) 25K followers? Instrumented the sim
(`unlockViews`/`unlockWeek` probe, printed per persona) to measure "comparable":

| Persona (home) | Reaches 25K | Median week | Lifetime views at that moment |
|---|---|---|---|
| Optimizer (longform) | 100% | 25 | ~960K |
| Sustainable (longform) | 99% | 28 | ~1.1M |
| Diversifier (5 platforms) | 75% | 38 | ~310K |
| Minimalist (micro) | <1% | — | ~1.4M by week 52 at ~10K followers |

Views per follower is platform-shaped: ~44 on longform, ~140 on microblog.
So an OR rule at ~1M views opens the Studio at ~7–10K followers for a
micro/short creator versus ~23K for longform. Ran the OR rule at 1M and 500K
(`CONFIG.studioUnlockViews`, an engine knob, `null` = off): all six targets
unchanged; the only movement is the Chaos Gremlin buying the Studio a little
more (48→55%) and going Broke a little more (34→37%).

Why not adopt it: the Studio is a $3,000/wk lease and the creators the rule
would help are exactly the ones who can't pay it — microblog rpm is $0.0003
(1.4M lifetime views ≈ $400 of ad revenue all year) and deals scale on
followers, not views. A views-based unlock is a trap for the archetype it
opens for. If views should matter to the Studio decision, the honest route is
to make views matter to *money* first (brand deals priced on reach, like real
CPM sponsorships) so a reach-heavy creator can afford the lease the normal
way — that's a separate rebalance. Knob left in CONFIG, off.

## Shipped: studio tiers + runway gate, two more hires (2026-09-13)

Jason: a studio IRL is the creator deciding this is the job, often before the
numbers justify it — a follower gate had the audience deciding instead. So:

- **No follower gate.** `upgradeInfo` gates a studio step on money only: the
  deposit plus `studioRunwayWeeks` (3) of the *new* weekly overhead in the bank
  (`overheadAt(S, tier)` — living + platforms + payroll + the new lease). The
  reason string says exactly what's short. The `studioUnlockViews` experiment
  knob is gone with the gate it modified.
- **Three studio tiers** (`STUDIOS`, gear 4/5/6, sequential after the kit):

  | Step | Down | Weekly | Views | Slots | Team | Stress relief |
  |---|---|---|---|---|---|---|
  | The spare room | $3,000 | $600 | ×1.5 | 2 | 3 | −3 |
  | The lease (the old Studio) | $12,000 | $3,000 | ×2.3 | 3 | 4 | −6 |
  | The building | $35,000 | $8,000 | ×3.3 | 3 | 6 | −10 |

  Content stays capped at 3 (the slot analysis stands). "Falling apart" is
  mostly emergent (a big lease turns any bad-money event into a countdown)
  plus two building-only events: `rent-hike` and `building-outage`.
- **Two new hires** to fill the building: **Producer** (evergreen tails earn
  2 weeks longer; one site, `doPost`) and **Analyst** (heat keeps 0.9/wk
  instead of 0.82; one site, `settleWeek`).
- **UI.** The upgrade card names the step, shows deposit + weekly, and an
  **affordability read** from `hist` gross deltas ("You've averaged $X/wk
  over the last 4 weeks. This costs $Y/wk all-in. Runway after signing: N
  weeks."). The Setup ladder shows Tier 0–3 + "Studios ×1.5–3.3" before a
  studio, then Kit + room/lease/building. Studio art maps room→`studio-tier-
  room`, lease→the existing `studio-tier-4`, building→`studio-tier-building`,
  with `onerror` fallback to the nearest existing scene until the new ones
  are generated. Hire portraits for producer/analyst fall back to glyphs the
  same way.
- **Balance.** Sim 6/6 on seeds 7/42/123 at 600 with **no retune**: the
  Optimizer signs its first space at week 21 (was 25 under the follower
  gate), tops out at the lease in the median run and reaches the building in
  a minority (its GOAT path), 18–22% GOAT; the random persona signs far more
  often (48→80%) and goes Broke *less* (34→15%) because the runway gate stops
  it signing what it can't carry. Tests 68/68.
- **Assets still needed** (see the session notes / prompts doc): two hire
  portraits (`avatar-hire-producer`, `avatar-hire-analyst`) and two Setup
  scenes (`studio-tier-room`, `studio-tier-building`).

## Shipped: laptop console — channels into the rail (2026-09-14)

External playtest on a laptop (viewport ≈ 1440×790), spec in
`docs/superpowers/specs/2026-09-14-the-feed-laptop-console-design.md`. The
tester's three layout notes — "didn't know what action to take, it's behind
a scroll", "Channels feels like wasted space", "the bottom-left panel is where
everything happens but it's tiny" — had one cause: the full-width channel
strip. Measured: header 226px + strip 272px = 498px before the decision
column started, leaving it 253px (93 of that the sticky footer) for ~1,220px
of content; on week 1 the cards were entirely below the fold.

Fix (chrome only, `the-feed.html`): at ≥980px the strip is the **top of the
right rail**, above Setup/Team, and the rail scrolls as one column. Channel
cards keep their artifact format, stacked at the rail width. The `.tabbody`
grid is a single row again. `placeStrip()` moves the `#chanstrip` node into
`.rail` when wide and back before `#tab-home` when narrow (on load and on the
980px `matchMedia` change), so the phone DOM/CSS is exactly as before.
Result at 1440×790: workspace 253 → 524px, week-1 prompt + both content
cards visible above End the week; at 1280×650 workspace 384px with the first
card row still visible. Mobile 375px verified unchanged. Engine tests 68/68.

Two other notes from the same tester, no change: the Team card staying
clickable while broke (they retracted — seeing the cost is the point, and a
brief overdraft to hire is allowed); "Setup could go in the top row" (skipped,
the header is the one area already tight and the multiplier is on the upgrade
card when it matters).

## Priority item — ending → essay CTA (blocked on content)

Each ending's Substack CTA should link to a specific essay on that ending's
theme (Burnout → an essay on creator burnout, Sellout → one on brand trust,
etc.). **Blocked until the essays exist.** When they do: add an `essay` URL
per `ENDINGS` entry in the engine and swap the end-screen CTA copy/link.
This is the whole reason the game exists — do not let it slip.

## Dropped — high-score leaderboard (Netlify Blobs)

Replaced by the endings gallery (2026-09-13): the end screen now sells the
other seven endings with hints instead of a score. Original notes kept below
in case a board ever comes back.

Defer until after C. Client-submitted scores are spoofable (acceptable for a
toy board with clamping + rate-limits). Score should be a composite (followers,
rep, weeks survived, ending), not raw followers. Plan when picked up: `npm i
@netlify/blobs`, `netlify/functions/submit-score.mjs` + `top-scores.mjs`,
board UI on the end screen. Display name only, never email.

## Dropped — OpenMoji

Consistent emoji would polish the exact thing the reskin removes (emoji as the
icon system). Not doing it. The OpenMoji entry in `CREDITS.md` can be deleted
when C ships.

## Open — Reddit playtest feedback (2026-09-15)

A Reddit player called the game **"shallow"** with some **unintuitive
interface elements**. Analysed (played weeks 1–3 desktop + phone, engine
read) in `docs/superpowers/specs/2026-09-15-the-feed-reddit-feedback-review.md`
— ranked hypotheses, eight fixes with engine/chrome split and sim impact,
further ideas, a three-pass sequence. Headlines: on one platform the dealt
hand equals the slots so nothing is chosen; topic titles have no mechanical
effect; posts resolve on tap so End-the-week has no reveal; event replies
telegraph the answer and hide the stakes. UI: tap-posts-immediately, End the
week ~2.5 screens down on phones, no scroll reset after `advance()`,
undefined chip vocabulary, "Add a channel" silently spends a post slot.
Top fixes: queue-on-tap → resolve on End the week (select-then-publish
reframed; rejected 2026-09-12, now with external evidence), stakes printed
on event replies, an expected-range line per card, sticky End button + scroll
reset on phones.

**Shipped 2026-09-15 — the full spec, all three passes + the payoff/measurement batch:**
- *Pass 2 (the loop):* queue-on-tap → reveal on End the week; `stakes` string on every
  event choice (70) with the red/green grading dropped; `previewPost()` expected-range
  "bet" line on each content card.
- *Pass 1 (intuitiveness):* sticky End-the-week + phone business sheet + scroll reset;
  a visible next-target line; tap-to-explain glossary popovers + stress-bar ticks;
  "uses a post slot" flag; four stable feed narrator voices; Steady chip dropped; copy nits.
- *Pass 3 (hand + consequences):* single-platform three-angle hand (Personal ungated there);
  "choices that echo" via `S.flags` + weighted `priority` events (incl. the named
  `crypto-fallout`); the 90 authored `THUMBS` thumbnail strings.
- *Payoff + measurement:* end-screen "how you got here" path line; copy-to-clipboard share
  card; Plausible custom-event funnel (`start`/`week:N`/`end:<key>`/`share`) with `/privacy`
  updated to match.
`npm test` 71/71; `npm run sim` 6/6 (seeds 7/42/123). Only the leaderboard stays deferred;
the essay-ending CTA stays blocked on the essays existing.

## Step 1 of the v2 evolution (spec: `docs/superpowers/specs/2026-09-15-the-feed-v2-evolution-vision.md`)

The vision doc's "Step 1" (kill the flatline: acts + team-as-characters + a hall),
decomposed into ordered sub-projects, each its own spec+plan under
`docs/superpowers/{specs,plans}/`.

### Shipped: mid-run save (sub-project 1)
Persist the run to `localStorage.thefeed_save` (`{v, ts, S, ui}`) on every
`advance()`; **Continue** on the start screen restores the full run; cleared on
ending and on a fresh run; a `SAVE_VERSION` gate silently discards corrupt /
future-version / unknown-niche saves (never crashes). `the-feed.html` +
`privacy.html` only; engine/sim/tests untouched. The clock reposition was
deliberately deferred to Acts (saving doesn't lengthen a run).

### Shipped: Acts 2a — structure, transitions, late-act decks (sub-project 2, part a)
The flatline fix's structural half. **Engine:** `act(S)` + `ACTS` labels (three
acts on the existing `CONFIG.phases` boundaries, 1–17/18–35/36–52); a
`concentrated` flag set in `settleWeek` for a creator who bet on one platform by
the business act, harvested by the new **`platform-turns`** card (the platform you
built on turns on you, biting hardest when concentrated); **9 new act-gated event
cards** (Act III ceiling/audience/reinvent + Act II texture) — the four
Diversifier-picked growth branches scale proportionally to audience (capped 45K)
so the spread player isn't starved without inflating the big personas (keeps target
6). **Chrome (`the-feed.html`):** guaranteed **act-transition beats** (Act II "This
is a job now.", Act III "The easy growth is behind you.") shown once at the
boundary, driven by `E.act(S)` not the random roll, with a `beatsSeen` array
persisted in the save; `SAVE_VERSION` bumped **1→2** (v1 saves retire cleanly).
**Clock copy** repositioned to "about twenty minutes" across the six surfaces
(meta/og/twitter/kicker, `tools.njk`, `tool-index/the-feed.md`), to be trued-up
against the Plausible `start`→`end` median. `npm test` 75/75; `npm run sim` 6/6 on
seeds 7/42/123. Card **copy is a draft pending Jason's voice pass.**

### Shipped: Acts 2b — the Act III exit decision (sub-project 2, part b) — completes Pillar 1
The marquee decision. A single forced event **`the-exit`** (`cond: () => false` so
it's never in the random deck) surfaced once at **`CONFIG.exitWeek` (46)** by a
pre-empt at the top of `rollEvent`. Three choices, ending the run early with a
**steered *existing* ending**: **Sell the channel** → a buyout (`followers × 3`)
banked, then `sellout`; **Go independent** → `legend` if you own an audience
(`members > 0 || plats.writing.active`) with `rep ≥ 50`, else `faded`; **Keep
climbing** → a feed line only, **zero state change**, play the year out. The whole
steering mechanism is a **one-line guard** at the top of `checkEndings`:
`if (S.over && S.endKey) return S.endKey;`. The **sim declines the exit**
(`resolveEvent` special-case picks Keep climbing), so it's a pure player choice that
leaves the 6 balance targets untouched — **no retune, no new ending, no
`SAVE_VERSION` bump** (`S.flags.exitOffered`/`exitChoice` are absent-means-default).
End screen gains one path-line clause ("took the buyout / went independent in week
46"). `npm test` 83/83; `npm run sim` 6/6 on seeds 7/42/123. Verified end-to-end in
the browser (exit fires at 46; Sell → Sold-out screen with the buyout in Bank + the
path clause). Card copy is a draft pending Jason's voice pass. **Pillar 1 (Acts) is
complete.**

### Shipped: Team-as-characters 2a — the dealt cast + traits (Pillar 2, part a)
The fix for the playtester's "hires are safe bets with no trade-offs." The six
always-available role modifiers became an **8-character cast dealt as a weekly
roguelike shop**. **Engine:** `CHARACTERS` (keyed by id; editor + designer each
offer an in-role bet — loyal-cheap roommate vs pricey pro, steady vs edgy — the
other four roles are one hire each) + `hiredChar(S, role)`; **`S.hires[role]`
went boolean → character id** and the ~8 modifier sites (`viewsMult`,
`stressCost`, `repHit`, `loseFollowers`, `settleWeek` heat, `doPost` tail,
`biz.deal`, `payroll`) now read magnitudes from the hired character's `fx`;
`dealTeamHand` fills a weekly `S.teamHand` (2–3 candidates, never a filled role,
fixed within the week); `biz.hire(S, id)` / `hireInfo(S, id)` take a candidate id,
`biz.fire(S, role)` a role. The edgy designer is **not** a strict upgrade — cheaper
+ more reach but its `edgy` flag makes hostile-event rep hits bite harder.
**Sim:** `nextHire` picks from the dealt hand by a per-persona id-preference list —
6/6 on seeds 7/42/123 **with no cast retune** (the `fx` mapped cleanly to the old
flat modifiers). **Chrome:** the Team panel shows "On offer this week" (candidate
cards: name, role, trait, sign + weekly, Hire) + "Your team" (roster with Let go);
`SAVE_VERSION` bumped **2 → 3** (the `S.hires` shape changed). `npm test` 85/85;
verified end-to-end in the browser (dealt candidates, hire fills the role + payroll,
offer varies week to week, v2 saves discarded). Character copy is a draft pending
Jason's voice pass.

### Shipped: Team-as-characters 2b — drift + morale (Pillar 2, part b) — completes Pillar 2
The cast's relationships. Three flagged events on the consequence engine + the 2a
cast: **`roommate-drift`** (the `editor-roommate` past `CONFIG.roommateScale`
40K followers → level them up for cash, or let them go for a rep hit — fires once
via `S.flags.roommateDrift`); **`edgy-detonation`** (the `designer-edgy` in act 2+ →
the backlash lands; stand by them and eat it, or rein it in and lose the edge — once
via `S.flags.edgyDetonated`); **`team-fraying`** (morale). Morale is a **hidden
`S.hiStressStreak` counter** in `settleWeek` (consecutive fumes+ weeks, reset on a
calm week — never displayed) that sets `S.flags.morale` at `CONFIG.moraleStreak`
(3) when you have a hire → an overworked hire threatens to walk (talk them down for
cash + rest, or let them go). **Firing thins the pool:** `biz.fire` (and every "let
them go") sets `S.flags.firedRecently`; `dealTeamHand` caps the offer at 2 for
`CONFIG.firedWindow` (4) weeks — word gets around. `npm test` 93/93; `npm run sim`
6/6 on seeds 7/42/123 **with no retune** (the event costs were well-calibrated). No
`SAVE_VERSION` bump (all new state is absent-means-default). `the-feed.html`
untouched — engine only. Character/event copy is a draft pending Jason's voice pass.
**Pillar 2 complete.**

### Shipped: the hall (5a) — "Creators you've been" — completes Step 1
Chrome-only. On a run ending, `endGame` appends a compact bio
(`{name, niche, home, endKey, followers, exitChoice, ts}`) to a new
`localStorage.thefeed_hall` key, capped at 12; the end screen grows a **"Creators
you've been"** shelf below the endings gallery — each past run one line (name,
ending kicker + icon, followers, niche-on-platform, the Acts-2b exit clause when
set). Uses the run's ending/path facts now; upgrades to Pillar 4's audience-memory
sketch later without a migration. Own key, separate from `thefeed_save`/
`thefeed_endings`; no engine/sim/test change, no `SAVE_VERSION` interaction. One
`/privacy` clause (+ date bump). `npm test` unchanged (88/88 on its branch; 93/93
on main with Team-2b). Verified end-to-end in the browser (finished run stored +
the shelf renders past runs, newest first). Copy here is minimal (bios), no voice
pass needed. The optional start-screen shelf peek was left out (deferrable).

**STEP 1 OF THE V2 EVOLUTION IS COMPLETE** — save + Acts (Pillar 1) +
Team-as-characters (Pillar 2) + the hall, all merged and live. The next move per
the vision doc is **not more building** but **reading the Plausible numbers**: the
flatline drop between `week:26` and `week:40`, and the replay rate
(`end:<key>`→`start`). Those decide whether/how far to pursue **Steps 2–4**
(owned-audience insurance + audience memory · niche/platform builds · the 5b "Big
Bet" of archetype unlocks / New Game+). Outstanding: **voice passes** on the
Acts/exit/character/drift copy (all live as drafts).

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
