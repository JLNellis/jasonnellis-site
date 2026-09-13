# The Feed — feedback round (2026-09-13) design

Six items from Jason's playtest, decisions taken in conversation. Chrome
changes stay in `the-feed.html`; only item 1 touches the engine.

## 1. Idle churn ramps instead of flat-lining (engine)

Today a platform is idle after `idleWeeks` (3) silent weeks and churns a flat
`churnIdle` (2%) forever. Replace with a ramp, capped:

    rate = min(churnIdleCap, churnIdle + churnIdleRamp × (silentWeeks − idleWeeks))
    churnIdle 0.02 · churnIdleRamp 0.025 · churnIdleCap 0.12

so silent weeks 3/4/5/6/7+ churn 2 / 4.5 / 7 / 9.5 / 12 %. Applies to both the
base and trend cohorts of an idle platform (as today). New export
`idleChurnRate(S, p)` (0 when not idle) so the UI chip and feed line read the
same number. Feed line escalates: the existing "people left" line when loss
> 1%, a sharper "forgetting you exist" line once any platform's rate ≥ 7%.
Channel chip reads `Idle Nw · bleeding` once rate ≥ 5%. Tests: rate table +
cap; sim must stay 6/6 green across seeds.

## 2. Stats rail folds into the header (desktop)

At ≥980px the Stats rail is removed and a `.trendrow` under the meters shows
the same four series as compact sparklines (Followers · Bank · Stress ·
Reputation), each with current value and net change. Followers is a weekly
net-change bar chart (green up / red down) rather than a cumulative line.
Mobile keeps the Stats tab unchanged. The right rail becomes the Setup/Team
panel alone (item 5 gets the room).

## 3. Team opens a dialog

The Team business card gets a `Manage ▸` chip. Clicking opens a `<dialog>`
(centered on desktop, bottom sheet on phones) holding the existing roster
rows (hire / let go, cost, note). Hire/fire closes the dialog and renders the
result stub as today. `teamOpen` inline state is removed.

## 4. Copy pass — deadpan, specific

Rewrite player-facing strings (engine events/feed/endings/band messages, UI
card descriptions and hints) toward: deadpan, specific, the joke is in the
precision. No puns, no exclamation marks, no "lol". Mechanics and every
number in a string stay identical; test assertions on strings are updated
with the strings. Jason reviews the result in play; a string dump only if
needed afterwards.

## 5. Kit multiplier is the Setup card's headline

Setup card value becomes the live reach multiplier from gear (`1.1^tier`,
Studio ×2.3 on top). Under it a 5-step ladder: Tier 0 ×1.00 · Tier 1 ×1.10 ·
Tier 2 ×1.21 · Tier 3 ×1.33 · Studio ×3.06, current step highlighted, next
step shows its cost (or the Studio unlock threshold). Designer's ×1.15 shows
as a line when hired. The Studio sentence becomes a one-line footnote. The
upgrade business card reads "Views ×1.21 → ×1.33". No mechanics change.

## 6. Sounds from Pixabay

Replace the Kenney interface set with Pixabay sound effects (Pixabay Content
License: free, no attribution, commercial OK) and cut to ~5 sounds: tap,
post, notification/event, cash, big-moment sting, plus win/lose. Update
`CREDITS.md` with each source URL.
