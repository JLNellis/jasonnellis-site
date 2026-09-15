# The Feed — Reddit playtest feedback review (2026-09-15)

**Status:** analysis only. Nothing here is shipped. Jason to pick which fixes
to run; each is scoped below with its engine/chrome split and sim/test impact.

## The feedback

A Reddit user said the game is **"shallow"** and that **some interface
elements weren't intuitive**. The actual comment text was not available to
this session, so what follows is a ranked set of hypotheses, ordered by how
likely a first-time player is to hit each one. If the thread link turns up,
re-rank against it before building anything.

## What was checked

- Played weeks 1–3 in the browser at the desktop console width (three-column
  layout) and at 375px phone width (tabbed layout), including one event
  (`crypto-dm`) on the phone.
- Read `the-feed-engine.js` (`CONFIG`, `buildHand`, `doPost`, `applyMove`,
  `checkEndings`, the event deck) and the play loop in `the-feed.html`
  (`takeMove`, `endWeek`, `advance`, `renderHomeWaiting`, the feed handles).
- Cross-checked against the prior review decisions in `the-feed-BACKLOG.md`
  (notably: select-then-publish and cash runway were rejected 2026-09-12).

## Hypotheses — "shallow"

Ranked. Each has the evidence and where it lives.

1. **The hand equals the slots.** On one platform `buildHand` deals two
   cards (the platform's default angle plus the opposite angle on the
   strongest platform) for two content slots. After a post, a replacement is
   dealt for the remaining slot, always on the same platform. The "which
   posts?" scarcity the core-loop spec is built on only exists with 3+
   platforms or when stress makes resting attractive. Weeks 1–10 are: tap,
   tap, Engage, End the week.
2. **Topic titles are flavour.** The title is the most prominent thing on a
   card and the thing a player reads as "the choice", but `doPost` never
   reads it. Views = base × heat × size × platform × niche × angle × luck
   (`rnd(.55, 1.6)`) × gear. Players work out within a few weeks that which
   video they pick doesn't matter. That is what "shallow" means to a gamer.
3. **No commit → reveal beat.** `takeMove` applies the post and shows the
   full result the instant a card is tapped. `endWeek` only runs
   `settleWeek` (churn, overhead, tails) and maybe an event. There is nothing
   to wait for, so the loop reads as data entry.
4. **Event replies are pre-graded and hide the stakes.** `CHOICE_ICON` colours
   escalate red and repair green; the sub-line is an adjective ("Cash now.
   Your audience won't forget." / "Fans respect the integrity."). The actual
   numbers make it a real dilemma — Take the bag pays `rnd(900, 2400)`
   against a week-2 bank of ~$870, at rep −12..22 and 1–3% followers — but
   the player can't see them.
5. **One strategy, threshold endings.** Focus one platform, post both cards,
   Engage until deals unlock at 1K, buy gear, buy the studio. The sim's
   Optimizer is exactly this. Legend / Star / GOAT differ by follower count;
   the four fail endings need deliberate bad play. Run two is run one.
6. **Business is locked or obvious for two months.** Week 1–8 offers Engage
   or Upgrade. Deal (1K) and Membership (1.5K) show as locked; Team needs
   cash. Reputation goes up and nothing says what it buys (deal pricing,
   the Legend gate, the Cancelled floor).

## Hypotheses — "not intuitive"

1. **Tap posts immediately.** Players tap a card to read it and it fires.
   The `.loophint` only renders on week 1 and scrolls off. Strongest single
   guess for the specific complaint.
2. **End the week is buried on phones.** Below three content cards and five
   business cards, ~2.5 screens down. The button resting requires is styled
   `.idle` (outlined) and reads "2 posts and 1 business move unused", so
   resting looks like an unfinished turn.
3. **Stage scroll doesn't reset after a week.** Confirmed on desktop: after
   End the week the workspace still shows last week's business list with the
   new cards above the fold. `advance()` calls `render()` and never touches
   `scrollTop`; on phones the same happens whenever no event fires (an event
   switches tabs, which incidentally resets the scroll).
4. **Undefined vocabulary, no tooltips.** Proven · Steady · primed to pop · in
   a good spot · Ride the wave · Hot right now · kit tier 0 of 3 · Amateur →
   Scrappy · "angles are bets, not grades". Five `title=` attributes in the
   whole page. The stress bar has no marks at 50/70/90, so "on fumes" is a
   surprise.
5. **"Add a channel" silently spends a post slot.** `applyMove` calls
   `useSlot(S,'content')` for `kind:'start'`; the card lists "+platform" and
   "+8 stress" but not the slot.
6. **Two message tabs, one look.** Alerts narrates results through
   `handleFor()` — a rotating list of 14 fake handles — while Inbox holds the
   real decisions. Once the player notices @doomscroll and @lurkr are the
   same narrator, the feed reads as noise.
7. **Thumbnail big words truncate to nonsense.** `thumbHTML` takes the first
   2–3 words: EVERY SETTING YOU · THIS GAME IS · A BEGINNER BUILD. Reads as a
   bug, not YouTube pastiche.
8. **Week-1 dead space.** The desktop trend row says "From week 2" five
   times; the phone Stats tab is empty; header shows "0 views".

Smaller nits seen on the way: "Locked until 1K total" (total what?); the
event header shows "Sponsor" twice (label + badge); the stage still says
"Week 2" while you resolve week 2's event, then jumps to "Week 3".

## Fixes, ranked by leverage

None add a system. They make the decisions the engine already has legible,
which is the fix for "shallow" that stays inside Jason's "10 minutes, a
conversation starter" framing.

| # | Fix | Where | Sim/tests |
|---|---|---|---|
| 1 | **Queue on tap, resolve on End the week.** A tap marks the card *Scheduled*; tapping again unschedules. `endWeek` applies the queued moves (`applyMove` in order, then `settleWeek`) and the results drop into the feed as a short roll. Cross-post chips move onto the scheduled stub. Fixes tap-to-post *and* gives the loop a reveal at zero extra taps. | `the-feed.html` only if moves are queued UI-side and applied in `endWeek`; engine untouched | none (same calls, later) |
| 2 | **Print the stakes on event replies.** A `stakes` string per choice ("+$900–2,400 · rep −12 to −22 · −1–3% followers" / "rep +6–12"), rendered under the label instead of the adjective. Drop the red/green button coding so the answer isn't graded in advance. | engine (`EVENTS[].choices[].stakes`, ranges are already literals in each `apply`) + chrome | tests: none of the matched strings change |
| 3 | **Show the bet on each card.** One line under the thumbnail: "~1–3K views · ~+40 followers", computed from `doPost`'s formula at luck 0.55 and 1.6. Needs an engine helper `previewPost(S, card)` so the UI doesn't duplicate the math. | engine helper (pure, read-only) + chrome | none |
| 4 | **Phone layout.** Sticky End the week above the tab bar (desktop already has `.stagefoot`); business collapses to one card that opens a sheet; `advance()` resets `window.scrollTo(0,0)` and `.tabbody`/`#stagebody` `scrollTop`; unused-slot copy becomes "End the week · resting 1 slot (−18 stress)" in a neutral style. | chrome | none |
| 5 | **Deal three cards for two slots from week 1.** With one platform, deal Trend + Evergreen + Personal on it (Personal is currently only dealt when rep < 50). "Which two?" exists from the first week. | engine (`buildHand`) | **sim rerun required** — Personal every week changes stress/rep for the Sustainable and Grinder personas |
| 6 | **A visible next target.** Header/Stats line: "Brand deals unlock at 1K followers", later "Niche Legend: 37K followers + rep 55 · you're at 457". `endingHint()` already has the copy. | chrome | none |
| 7 | **Glossary on tap + stress ticks.** Chips (Proven, Hot, Tired, Steady) open a one-line popover; three tick marks on the stress bar labelled hot / fumes / redline. | chrome | none |
| 8 | **Label the channel card; author thumb words.** "Uses a post slot" flag on Add a channel. Hand-write a `thumb` string per topic line (90 strings, one-off) instead of truncating the first three words. | chrome + a `thumb` field in `TOPICS` (engine data, no logic) | none |

**Prior decisions this touches.** Select-then-publish was rejected on
2026-09-12 as "slows a 10-minute game, needs engine staging". Fix 1 is the
same idea reframed: the tap count is unchanged (you still tap the cards, then
End the week), only the resolve moves, and it can be staged UI-side with no
engine change. The Reddit note is the first external evidence on this; worth
revisiting. Cash runway was also rejected then; it is *not* proposed here.

## Additional ideas (beyond the chat summary)

Grouped by what they buy. Each is cheap unless marked.

**Depth without new systems**
- **Choices that echo.** Events are one-shot today. Use `S.seenEvents` (and
  a small `S.flags` set) in the `cond` of existing events so a choice has a
  memory: Take the bag → `sponsor-clawback` becomes very likely within 8
  weeks and its text names the crypto sponsor; Roast them publicly →
  `receipts-account` more likely; Push through it → the next `body-invoice`
  arrives sooner. No new cards, just `cond` wiring plus one line of copy each.
  Turns the event deck from a quiz into consequences.
- **Rest as a card.** A "Take the week off" card in the content deck
  (−18 stress, shows what it costs: "idle churn starts after 3 silent
  weeks"). Resting becomes a thing you choose, not a thing you omit. Chrome
  only: it just leaves the slot empty.
- **Make heat's clock visible.** The engine already gives heat a shelf life.
  Put it on the card: "Hot · fades next week" turns *when* to post into a
  tempo decision the player can feel.
- **One discard a week.** Swap one dealt card for a fresh topic on the same
  angle, once per week. Cheap agency over the hand; near-zero balance impact
  because topic is cosmetic. Only worth it if fix 3 (visible bet) lands,
  otherwise it's agency over nothing.
- **Personal angle availability.** Today it's only dealt at rep < 50, so most
  players never see the +rep / overshare trade. Fold into fix 5.

**Payoff and replay**
- **"How you got here" on the end screen.** `endStats` shows totals; add the
  path: top platform, deals taken, weeks rested (empty slots), peak stress,
  events faced. All derivable from `S` and the UI `hist`. Makes the eight
  endings feel earned by a route rather than by a number.
- **Share card.** A copy-to-clipboard line ("Niche Legend · 41K followers ·
  Gaming · burned out once, never sold out — thefeed.jasonnellis.com") on the
  end screen. No backend, no image generation. The game is a conversation
  starter; give it a sentence people can paste. Pairs with the blocked
  essay CTA.
- **The "same again" test.** If a "Repeat last week" button would be pressed
  most weeks, that's the depth problem measured, not a feature to ship. Use
  it as a diagnostic during playtests, don't add it.

**Interface**
- **Narrator handles by kind.** One consistent voice per message kind
  (@the_algorithm for results, @your_bank for money, @your_body for stress,
  @the_comments for rep/hostile) instead of `handleFor()`'s rotation. A
  stable voice is parseable; random handles are noise.
- **Header diet on phones.** Seven numbers in the phone header (followers,
  views, bank, overhead, stress, rep, week). Views and overhead can live in
  Stats; followers, bank, stress, rep, week stay.
- **Drop the "Steady" chip.** A chip that says nothing trains players to
  ignore chips, which kills Hot / Tired / Idle when they matter.
- **Onboarding as a guided week 1**, not a hint box: deal the cards one at a
  time with the hint pointing at the live card, and pulse End the week once
  the slots are used. Week 1 only.
- **Peek the math.** Hover / long-press on a card shows the multiplier stack
  (heat ×1.35 · same-week ×0.8 · gear ×1.10). Cheap once fix 3's helper
  exists.
- **Week-1 empty states.** Trend cells show the starting value as a single
  point instead of "From week 2" ×5.
- **Copy nits.** "1K total" → "1K followers"; one "Sponsor" on the event
  header; "End of week 2" as the stage title while an event resolves.

**Measurement**
- **Plausible custom events funnel.** `plausible('start')`, `week:10`,
  `week:26`, `week:40`, `end:<key>`, `share`. Custom events are cookieless
  and nothing is used today. Answers "where do people quit?" which no
  amount of playing it ourselves can. Check the wording of `/privacy`
  ("what I collect") before shipping; it likely already covers page-level
  analytics but say so explicitly.

## What not to do

Jason's framing (memory + backlog): a conversation starter, 52 weeks, 2–3
decisions a week, ~10 minutes, replay across eight endings beats depth.
So: no skill stat, no more platforms, no rivals system, no leaderboard, no
longer runs, no difficulty modes. Every fix above is a legibility or
consequence change to what exists. If a fix needs a new stat, it's out.

## Suggested sequencing

1. **Pass 1 — chrome only, ships in one session.** Fixes 4, 6, 7, 8 (flag
   only), narrator handles, Steady chip, copy nits, scroll reset. Verify both
   widths in the browser. Tests/sim untouched.
2. **Pass 2 — the loop.** Fix 1 (queue → reveal), fix 2 (stakes), fix 3
   (visible bet). Fix 2 and 3 add engine data/helpers; `npm test` must stay
   green, sim unchanged since no numbers move. Brainstorm fix 1's reveal
   pacing first (how long the roll is, whether events land before or after).
3. **Pass 3 — hand and consequences.** Fix 5 (three-card hand) and "choices
   that echo". Both need `npm run sim` reruns on seeds 7/42/123 and the six
   targets green. Author the 90 thumb strings here too.
4. **Then** the end-screen path summary, share card, and the Plausible
   funnel, so the next round of feedback comes with numbers.

## How to know it worked

- Three people, unprompted, play week 1 on a phone while you watch. Note the
  first mis-tap and the first "what does this mean?" Anything that survives
  pass 1 goes to the top of pass 2.
- After the funnel ships: the share of starts that reach week 26, and which
  ending distribution real players land on versus the sim's personas.
