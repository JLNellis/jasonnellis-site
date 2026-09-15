# The Feed — v2 evolution vision: from escalation sim to a roguelike with acts, builds, and a cast (2026-09-15, rev. 2)

**Status:** vision / direction, not a build plan. Nothing here is scoped, estimated,
or committed. It exists so Jason can sit with the shape of a "real game" version of
The Feed and decide whether — and how far — to pursue it. If we commit to a direction,
each pillar becomes its own scoped spec (with engine/chrome split and sim targets) the
way the shipped rework was.

**Rev. 2 (same day):** a review pass against the engine and the backlog. The diagnosis,
the fork, and the pillar order stand. What changed: the session-length target is now a
named decision rather than a guardrail; a short list of **fixed points** (save, eight
endings, no gated starts, the essay CTA) sits before the pillars; Act I is protected
rather than demoted; Pillar 2 gets a cap and a dealing mechanism; Pillar 3 gets a
cheaper, more honest first cut; Pillar 4 gets an actual mechanism; Pillar 5 is split
into a cheap half and the real fork; and there is now a **"how we'll know it worked"**
section so the stopping points are a staged bet with a checkpoint, not a taste choice.

---

## Where this came from

Three inputs stack up to this doc:

1. **The Reddit-feedback review** (`2026-09-15-the-feed-reddit-feedback-review.md`) read
   "shallow" as a **legibility** problem — decisions the engine already made that the
   player couldn't see — and we shipped fixes for exactly that (queue→reveal, stakes on
   events, per-card bet lines, glossary, next-target, etc.).

2. **The playtester then elaborated**, and meant something different by "shallow":

   > "Shallow meaning it was the same events over and over and I think once you kind of
   > get a handle on the mechanics around day 20 it's just kind of more of the same from
   > there on out. It'd be great if the pattern expanded or more wrinkles were added.
   > Having said that the base formula is fun. I genuinely enjoyed it."

   Plus two concrete asks: **multi-channel is undermotivated and opaque** ("how helpful it
   is to expand… how the different channels play off of each other"), and **hires are
   safe bets with no trade-offs** ("I never really had the need to fire somebody in order
   to bring somebody else on urgently"), with a stretch idea that **staff should drift with
   scale** ("hire your college roommate as an editor early on, but they flounder as the
   channel gets bigger… a social media influencer who is super edgy early on, but maybe it
   causes more of a backlash later on… some of those patterns are already in the game,
   they're just very low stakes").

3. **Jason's question:** *pretend it's not a promo tool — how would we evolve it into
   something with legs?* This doc answers that, with the promo-tool budget constraint
   removed.

**The honest reframe:** the legibility work was real and worth doing, but it does not
touch the player's actual complaint. Their "shallow" is **structural repetition** — the
back half of a run plays like the front half. That is the problem this doc is built to
solve.

Read the quote once more before building anything: **the first twenty days were the fun
part.** The flatline is what comes *after* mastery, not the opening. Whatever v2 does,
the opening stays the best-feeling stretch of the game (see Pillar 1).

---

## The core diagnosis

The Feed is currently a **numbers-escalation sim wearing a roguelike's clothes.** Across
52 weeks the *quantities* grow — followers, overhead, team size, studio tier — but the
**kind of decision** you make in week 40 is the same one you made in week 8: pick two
content angles, make one business move, answer an event. Escalating numbers is not the
same as evolving decisions. That gap is the flatline.

The cure is to make the **decisions themselves transform** as the run progresses, and to
make the **opening choices** (niche, platform) lead to genuinely different games. Depth
through *variety and hard trade-offs*, not through length and more menus.

---

## The fork — and the pick

There are two honest directions, and they are different games:

- **A. Tight roguelike** (Balatro / FTL / Slay the Spire): one sitting, huge run-to-run
  variety, brutal trade-offs, high replay. Depth lives in *builds* and *decisions*, not
  in simulation fidelity.
- **B. Management sim** (Game Dev Tycoon / Two Point): 45+ minutes, deep systems, menus,
  spreadsheets-you-enjoy, fewer but longer sessions.

**Recommendation: A, decisively.** The Feed's best qualities are its tightness and its
voice. A management sim would dilute both and compete in a crowded, content-hungry genre.
A *tight creator-life roguelike* is a lane almost nobody occupies, and it's the version
that keeps everything good about what exists. **Every proposal below is disciplined by
this choice: if it adds minutes or menu depth without adding a real decision, it's out.**

---

## The thesis / through-line

> **The Feed is a game about what kind of creator you become.**

Every system should feed one legible identity question — reach vs. integrity vs.
sustainability — and the run should read as a *story you authored*, not a number you
maximized. The writing is the game's superpower; the systems should generate situations
worth writing about, and the player should finish a run with a *character*, not a score.

---

## What we can build on (today's bones)

Encouragingly, most of this is **deepening existing structures**, not rewriting:

- **Phases already exist.** `CONFIG.phases = { earlyEnd: 17, midEnd: 35 }` already cuts
  the run into early / mid / late — today it swaps backdrop art and gates a few events.
  That's the seam for Acts.
- **A consequence engine now exists.** `S.flags` + `priority` events + weighted
  `drawEvent` (shipped last round) is exactly the machine for arcs, drift, and memory.
- **Per-platform state** (heat, fatigue, loyalty, rpm, followers) and **cross-posting**
  (`crossOptions`/`crosspost`) are the seed of a real funnel — if we want one (Pillar 3).
- **Hires** (`HIRES`, `hireCap`, `biz.fire`, the `editor-quits` event) are one-line
  modifiers today, but the fire path and a hire-drama event already exist to build on.
- **Niches** carry multipliers and flavor; **endings** already gesture at the
  reach/integrity/sustainability spine (sellout / burnout / legend / GOAT).
- **State is plain JSON.** `newState` builds a flat object with no functions in it; the
  pending event lives in UI state. A mid-run save is `JSON.stringify(S)` plus the UI's
  `hist`/`weekLog`/`postLog` — cheap, and it becomes necessary (see Fixed points).
- **Light meta-progression already exists.** Found endings persist per browser in
  `localStorage.thefeed_endings`, and the gallery sells the other seven with honest
  hints. The end screen already prints a "how you got here" path line. Pillar 5's cheap
  half is a small extension of these, not a new system.

So the lift is evolution, not a rebuild.

---

## Fixed points — decided before any pillar

These are the constraints every pillar is designed inside. They're listed first because
the rev. 1 draft either buried them as guardrails or contradicted them by example.

1. **The clock: hold near twelve minutes.** Every surface says "a year as a creator, in
   about ten minutes" — the meta description, the OG tags, the start-screen kicker, the
   core-loop spec. Rev. 1 quietly targeted 15–25 minutes; that is a *repositioning*, not
   a tightening, and it would need the copy, the share card and the Plausible funnel
   re-thought. **Decision: ~12 minutes, a little longer than today, not double.** Depth
   comes from what the slots *mean* per act, never from more slots. The week loop stays
   2 content + 1 business (3 content with the studio) — that analysis stands. If a pillar
   can't deliver its decision inside that budget, the pillar is wrong, not the budget.
2. **Mid-run save is a prerequisite, not a feature.** A run that is even slightly longer,
   with acts that build toward a payoff, cannot be lost to a closed tab. Save `S` and the
   UI arrays to `localStorage` on every `advance()`; offer "Continue" on the start screen;
   clear on ending. `/privacy` already covers on-device `localStorage`; the wording needs
   one clause about an in-progress run. **This ships before or with Pillar 1.**
3. **Eight endings stay eight.** The gallery, the hints, the sim's six targets and the
   share card are all built on that set, and the gallery shipped two days ago as the
   deliberate replay hook. Nothing in v2 adds a ninth ending or removes one. What changes
   is that the **hints read as paths** ("the creator who took every deal and kept the
   audience anyway") rather than thresholds, and the path line on the end screen becomes
   a character sketch (Pillar 4). Act III's exit decision (Pillar 1) *steers* which of
   the eight you land on; it does not create new ones.
4. **Never gate a niche or a platform.** Run #1 gets the whole start screen. Anything
   meta-progression unlocks is an *archetype* (a starting perk/handicap), never a niche,
   a platform, or an act. Rev. 1's "start with Gaming-on-Longform" example is exactly the
   "run #1 feels like a demo" failure it warned about in the same section.
5. **The essay CTA stays the payoff.** The backlog calls the ending→essay link "the whole
   reason the game exists." v2 doesn't compete with that; it strengthens it. A player who
   finishes with a *character* is a better reader for the essay about that character than
   one who finishes with a number. When the essays exist, each ending's essay is that
   creator's epilogue. Nothing here parks the CTA.
6. **Honest to the real world.** The cadence-fatigue removal set the precedent: when a
   mechanic contradicts what creator data actually shows, the mechanic loses. Every
   pillar below is checked against that (it bites hardest in Pillar 3).

---

## The five pillars

Ordered by impact-per-effort. Each notes the idea, why it matters, how it maps to what
exists, the rough cost/risk, and what it explicitly is *not*.

### Pillar 1 — Acts that change the rules, not just the numbers  *(the fix)*

Split the 52 weeks into three acts that each **unlock new mechanics and new event decks
and transform old ones**, using the phase boundaries that already exist (1–17 / 18–35 /
36–52):

- **Act I — "Nobody's watching" (wk 1–17).** Discovery. Which platform, which angle,
  which topics land. The question is *who are you?* **This is already the best part of
  the game and it stays that way.** Act I is not a tutorial and not "low stakes." It is
  where the seeds get planted: the platform you commit to, the angle identity you fall
  into, the first hire, the first deal — every one of those is something Act II and III
  will hold you to. Forgiving in *consequence timing* (the bill comes later), not in
  meaning.
- **Act II — "The business" (wk 18–35).** You're an operation now. Team, taxes, sponsors,
  the studio commitment come to the fore; the Act I seeds start to sprout (the roommate
  editor drowns, the edgy hire's first backlash, the audience notices what you've become).
  The question shifts to *can you sustain this?*
- **Act III — "The ceiling" (wk 36–52).** The pressures of *success*: algorithm
  dependency, an audience whose expectations have calcified, burnout-at-scale, platform
  risk, reinvent-or-coast — and an **exit decision**: sell the channel, go independent,
  pivot the brand. The exit is a **priority event chain** whose outcome steers you toward
  one of the existing eight endings (sell with low rep → Sold out; go independent on an
  owned audience → Niche legend; pivot and lose the room → Faded), never a new one. Late-
  only decks mean "the same after week 20" becomes structurally impossible. The question
  is *what did it cost, and what's next?*

**The rule that makes acts work: every act plants seeds the next act harvests.** An act
that only has its own deck is a difficulty tier with a new backdrop. An act whose events
*reference and condition on* what you did in the previous one is a story. Pillar 2's
drift is the model; apply it to platforms (the one you built on is the one the algorithm
turns on), deals (the sponsor you took is the one that claws back), and rep (the roast
is the receipts thread).

**Why:** this is the direct antidote to the flatline. The decision *type* changes across
the run, so mastery in Act I doesn't trivialize Act III.

**Maps to:** `CONFIG.phases` (already the boundaries); the event system gains
act-gated decks (`minWeek`/`maxWeek` already supported); `S.flags` + `priority` carry the
seeds; a few mechanics flip on per act.

**Cost/risk:** medium. Two risks. (a) Act transitions feel like difficulty spikes rather
than new texture — needs telegraphing (an "end of Act I" beat that resets the mental
model). (b) **Act I gets flattened into onboarding** because it's "the easy act" — guard
this in review; if Act I loses a real decision, the spec is wrong.

**Not this:** not "harder numbers in act 3." New *decisions*, or it fails. Not a ninth
ending.

### Pillar 2 — Team as characters, not stat sticks  *(the player's sharpest note, elevated)*

Hires stop being permanent one-line modifiers and become a **small cast with traits and
drift**, delivered through the consequence engine:

- **Hires are dealt, not shopped.** Today Team is a menu: six roles, always available,
  always the same. In v2, opening Team shows **two or three candidates** drawn from a pool
  — role × character × price. You don't always get the safe one. Sometimes the only editor
  on offer is the expensive pro; sometimes it's your roommate; sometimes the edgy one is
  the only growth lever in the room. This fixes "hires are safe bets" *structurally*, the
  way a roguelike shop does, without a personality sim.
- **A capped cast.** **Eight to ten characters total** across the six roles, each with
  **one trait and one signature event**. Not "a roommate and a pro *per role*" (that's
  twelve-plus arcs and a writing project). Some roles have one character, some two. The
  pool is authored, the draw is random.
- **Traits.** The loyal-but-limited roommate; the expensive pro; the edgy hire who juices
  growth and courts backlash. Each is a bet, not a strict upgrade.
- **Drift with scale** (the player's exact idea). The roommate-editor is great at 5K and
  **drowns at 50K** → a scale-gated event: *level them up (cash + a beat)* or *let them go
  (lose the modifier, eat the rep hit)*. The edgy hire's backlash *detonates* in Act
  II/III, long after you hired them for the Act I growth.
- **Morale is a flag, not a meter.** Rev. 1 described morale as a per-hire stat that
  stress spills into — which is exactly the continuous-stat this pillar's own "not this"
  forbids. Instead: *stress on fumes or worse for N consecutive weeks* sets a flag; the
  flag makes that hire's quit/complaint event eligible and weighted up. Firing sets a
  flag too (they talk — the next candidate pool is thinner or pricier for a while). No
  bar on screen; the player *feels* it through what happens.

**Why:** it's the trade-off the player is begging for, it's a *new decision axis* that
plays directly to the game's writing strength, and it turns the roster from a shopping
list into relationships.

**Maps to:** `HIRES` becomes a character pool with `role`/`trait`/`sign`/`weekly`; the
Team dialog deals from it; `S.flags` + `priority` events carry the arcs (this is what that
engine was built for); `hireCap` + `biz.fire` already force and price roster churn; the
sim's `nextHire` needs to handle a dealt hand instead of a fixed order.

**Cost/risk:** medium; **high creative payoff**. Risk is scope creep into a full
personality sim — the cap (8–10 characters, one trait, one event each) is the fence.

**Not this:** not a continuous "staff XP" or morale stat. Drift is delivered as *discrete
flagged events*, not a leveling bar. Not more than ten characters in the first cut.

### Pillar 3 — Asymmetric identity: niche + platform as real builds  *(the replay engine)*

Make the two opening choices create **genuinely different games**, not just different
multipliers. Three parts, in the order to build them — the first is cheap and honest,
the last is the expensive one rev. 1 led with.

- **3a. Owned audience as platform-risk insurance** *(first cut — answers "why expand?")*
  The real reason a creator expands is not a funnel; it's that a rented audience can be
  taken away. Wire that: Act III's platform-risk deck (algo shift at scale, demonetization,
  a platform's reach collapsing, a policy change) hits **rented** audiences — longform,
  shorts, micro, live — hard, and the **owned** audience — newsletter subscribers,
  members — is the hedge. A creator who reached Act III with nothing owned faces the
  ceiling naked; one who built the newsletter in Act II has a floor. That is a *reason*
  to expand, it's true to the world, it costs no new post math, and it feeds Pillar 4's
  sustainability axis directly. A handful of teaching events make the interplay legible
  (the player's other ask).
- **3b. Niche signature mechanics.** Comedy = high viral ceiling but *cancellation risk is
  the core loop*; Education = slow-compounding loyalty that snowballs late; Beauty = the
  brand-deal economy *is* the main game; Music = a "label" arc (chase the deal, or stay
  independent). Each niche should reward a different strategy and feel different to pilot.
  Delivered mostly as niche-gated event chains and one multiplier tweak each, not as six
  new subsystems.
- **3c. The platform flywheel** *(only if 3a isn't enough)*. Shorts *feed* Longform *feed*
  Newsletter; cross-posting graduates from a free nibble into a mid-game engine. **Be
  honest about what this reverses:** the cadence rework found that *focus beats spread*
  and called that "the real-world shape" — the Diversifier persona dropped and stayed
  dropped. A mechanical funnel makes multi-platform *the* strategy, which is a design
  fiction on top of a game that has so far tried to be true to creator economics. It may
  still be the right call for replay variety — but it's a deliberate choice, it needs the
  Optimizer/Diversifier targets rewritten, and it's the balance-heaviest thing in this
  doc. Reach for it last.

**Why:** replayability in roguelikes comes from *builds*. Today there's roughly one
dominant line (focus a platform, ride hits, buy the studio, aim Star/GOAT). Asymmetry is
what makes a second run feel new — and 3a gives the Act III decision a reason to exist.

**Maps to:** 3a = late-deck events + a `owned`/`rented` split on `PLATFORMS` that the
platform-risk events read; 3b = `NICHES` gains a signature chain each; 3c = `PLATFORMS` +
`crossOptions`/`crosspost` become the funnel.

**Cost/risk:** 3a low, 3b medium, 3c **the balance-heavy one** — every change there needs
`npm run sim` reruns and new personas/targets. Sequence 3b/3c *after* Acts have shape.

**Not this:** not more than five platforms (keep the "which posts?" scarcity). Asymmetry
comes from *behavior*, not from adding channels. Not a funnel before the insurance.

### Pillar 4 — The spine: what kind of creator are you?  *(the soul)*

Make **Reach ↔ Integrity ↔ Sustainability** (pick two, roughly) the explicit backbone
everything feeds. Commitments that *lock in*; an audience that *holds you to who you've
been*; an identity that hardens over the run. The eight endings stop being a checklist to
collect and become *the path you authored*.

**The mechanism — audience memory.** Rev. 1 called this pillar "framing and wiring" and
named nothing; a soul with no mechanism is a paragraph. So: the run keeps a short,
*derived* list of **what your audience knows you for**, computed from flags and counters
that already exist — took the crypto bag, roasted someone, personal-post share, deal
count, weeks rested, which platform you built on, whether you own any audience. It is
never a meter and never a number on screen. It does three things:

1. **Events condition on it and quote it.** Act II/III cards read the memory: the sponsor
   who calls you names your last deal; the audience that "expected the personal stuff"
   turns on a trend run; the roast comes back as receipts. This is `S.flags` in `cond`
   and `priority`, plus authored copy — the machinery from the last round, pointed at
   identity.
2. **Commitments lock.** Past a threshold, some doors close *by the audience's hand*, not
   by rule: six deals with low rep and the clean brand stops calling; a year of personal
   posts and the audience punishes a pivot harder. The player feels the lock through what
   stops being offered.
3. **The end screen writes the character.** The existing "how you got here" path line
   becomes a one-paragraph sketch generated from the memory — which is also what the
   Pillar 5 hall stores.

**Why:** this is where a systems game earns a *meaning*. It also unifies the other
pillars — acts, team choices, and niche builds all become expressions of the same
tension, so the game reads as coherent rather than as a bag of mechanics.

**Maps to:** `S.flags` + counters already in `S` (`deals`, `rep`, per-platform posts,
`usedTopics`, the existing `soldOut`/`roasted`/`pushedThrough` flags); a pure
`audienceMemory(S)` helper the events and the end screen both read; `ENDING_HINT` rewritten
as paths.

**Cost/risk:** low-to-medium and **high coherence payoff.** Risk is preachiness — the
game's dry voice is the antidote; state the trade, don't moralize it.

**Not this:** not an explicit alignment meter with numbers on screen. The player should
*feel* the commitment through what locks and what the audience remembers. Not a rewrite of
the endings gallery.

### Pillar 5 — Meta-progression: a cheap half and the Big Bet  *(the "why replay")*

Rev. 1 treated this as one fork. It's two very different things and they're priced very
differently.

**5a — "Creators you've been" hall** *(cheap; ships with Pillars 1+2)*. Past runs persist
as short generated bios — name, niche, platform, ending, the Pillar 4 character sketch —
in the same `localStorage` the endings gallery already uses. The end screen grows a shelf.
It gates nothing, changes no balance, adds no new kind of stored data, and it makes the
"story you authored" thesis visible across runs. About a day's work once Pillar 4's sketch
exists. **This is not the fork; do it.**

**5b — Unlocks and New Game+** *(the Big Bet; the real fork)*.
- **Archetype unlocks.** Earn **creator archetypes** (starting perks/handicaps — "the
  burnout," "the sellout who wants redemption," "the slow-and-loyal educator") by hitting
  certain endings. Per Fixed point 4: archetypes only. Niches, platforms and acts are never
  locked.
- **New Game+ (the deep version).** Your *previous* audience's expectations carry over —
  the creator who sold out last run starts with a skeptical audience; the legend starts
  beloved but boxed in. This is the most ambitious and the most "legs"-generating idea in
  the doc.

**Why 5b is a genuine fork, not a free add:** it changes the game's *identity*. Right now
The Feed is a **clean single-serving** — start, one sitting, an ending, done. Unlocks and
NG+ make it a **collection/return** game. That is a real philosophical shift with real
costs:
- **Balance surface explodes.** Archetype starts and NG+ multiply the states the sim must
  keep fair; the six-target harness would need real expansion.
- **It can undercut the purity.** Part of what makes the current game clean is that every
  run is equal and self-contained. Gating content behind grind is the opposite instinct,
  and done carelessly it makes run #1 feel like a demo — which is why Fixed point 4 exists.
- **Persistence edge cases.** Corruption, "clear my data," the save from Fixed point 2 —
  all already paid for by 5a and the save, so this is a smaller cost than rev. 1 implied.

**Recommendation:** 5a with the first spec. 5b *only if Pillars 1–4 prove the core loop
earns repeat sessions* (see "How we'll know"). If we ever ship 5b, archetype unlocks are
the low-risk on-ramp; NG+ with inherited audience expectations is the high-ceiling,
high-cost version to reach for only if the game is genuinely earning repeat play.

**Maps to:** `localStorage` (already persists found endings); archetypes are `newState`
presets; NG+ is a starting-state seed derived from a prior run's `endKey`/memory.

**Not this:** not a live leaderboard, not accounts, not a backend. Meta stays
**on-device**, cookieless, and privacy-clean — same principles as everything else on the
site. Not a locked start screen.

---

## Sequencing — the first domino

If we commit, build in this order:

0. **Fixed points 1 and 2** — confirm the ~12-minute clock and ship the mid-run save.
   Small; do it first so nothing later is built on a run that can be lost.
1. **Pillars 1 + 2 + 5a together (Acts + Team-as-characters + the hall).** Highest impact
   for the least *new* machinery — the first two ride the consequence engine that already
   exists and directly kill the flatline; the hall is a day on top and makes the payoff
   visible. This is the first spec. **Then stop and read the numbers** (see below).
2. **Pillar 3a (owned-audience insurance) + Pillar 4's audience memory.** Together, because
   both are "events that read `S.flags`" work and both give Act III its reason. Low balance
   risk. Pillar 4's "identity & commitments" design pass happens here, before any build
   asymmetry, so the builds express a coherent tension.
3. **Pillar 3b (niche signatures), then 3c (the funnel) only if 3a didn't answer "why
   expand."** The balance-heavy work, once the acts give the run a shape to balance
   *within*. Needs sim work and probably new personas.
4. **Pillar 5b (the Big Bet)** only after 1–4 land and the loop has demonstrably earned
   repeat play. Archetypes first; NG+ last.

---

## How we'll know it worked

The sim is the contract for *balance*. Nothing today is the contract for the *complaint*.
So, before the first spec ships, set targets for the thing the player actually said:

- **The flatline.** Plausible already fires `week:10` / `week:26` / `week:40` / `end:<key>`.
  Today's drop between `week:26` and `week:40` is the flatline in numbers. Baseline it now
  (a week or two of live traffic), then set a target for step 1 — the honest bar is
  "materially fewer people quit between 26 and 40," and we pick the figure once we have
  the baseline rather than inventing one.
- **Replay.** `end:<key>` followed by `start` in the same session (and the hall's run count
  on device) is the replay rate. It should rise after step 1 and rise again after step 2.
  If it doesn't move after step 2, 5b is off the table — there's no return to build on.
- **The playtester.** Send them the build. If the person who said "same after day 20"
  plays past day 20 twice, step 1 worked. That's a real signal, not a vanity one.
- **The clock.** Median `start`→`end` time on a completed run stays under ~14 minutes. If
  a pillar pushes past that, it's over budget.

These turn Open question 2 from a taste choice into a staged bet with a checkpoint.

---

## Design discipline (the guardrails, updated for v2)

The old guardrails ("no skill stat, no rivals, no leaderboard, no longer runs") were
promo-tool-era. For a real game they relax — but into *principles*, not a free-for-all:

- **Protect the clock.** ~12 minutes (Fixed point 1). Every addition must add a
  *decision*, not a chore. If it adds minutes without adding a choice, cut it. The slot
  budget doesn't move.
- **Every act plants seeds the next act harvests.** An act with only its own deck is a
  difficulty tier. Events must reference and condition on what came before.
- **Depth via variety and trade-offs, not simulation fidelity.** We are making a
  roguelike, not a tycoon.
- **The voice is the product.** Systems exist to generate situations worth the writing.
  Keep the dry, specific, no-filler tone; never let mechanics get louder than character.
- **Deliver feelings through characters and consequences, not raw stats.** The player's
  "staff level up" becomes flagged arcs; "rivals" becomes named recurring characters in
  the deck, not a rivalry subsystem; morale and alignment become what locks and what the
  audience remembers, not on-screen meters.
- **Honest to the real world.** When a mechanic contradicts what the data says creators
  actually experience, the mechanic loses (the cadence precedent). Name it when a design
  choice knowingly departs from that (Pillar 3c).
- **Eight endings, no gated starts, the essay is the payoff.** Fixed points 3–5.
- **Stay honest and on-device.** No backend, no accounts, cookieless, `/privacy` stays
  exactly true — even for meta-progression and the save.
- **The sim is the contract for balance; the funnel is the contract for the complaint.**
  Any balance-touching change reruns `npm run sim` (seeds 7/42/123) and keeps the targets
  green; new systems get new targets. Any depth-touching change is judged against the
  "How we'll know" numbers.

---

## Open questions for Jason (the decisions this doc is really asking)

1. **Is it Direction A (tight roguelike)?** Everything above assumes yes. If you'd rather
   it be a deeper management sim, the pillars change shape.
2. **Confirm the clock.** ~12 minutes is the recommendation. If you'd rather commit to a
   genuinely longer sitting (15–25), say so — it's a repositioning and the copy, share
   card and funnel milestones all move with it.
3. **How far — as a staged bet, not a size.**
   - **Step 1** (Acts + Team-as-characters + the hall, on top of the save) is the
     checkpoint: it delivers everything the player concretely asked for, it's the
     cheapest step, and it produces the numbers that decide the rest. **Recommendation:
     commit to step 1 now; decide steps 2–4 on the data.**
   - **Steps 2–3** (insurance + memory, then builds) make it a genuinely different,
     replayable roguelike.
   - **Step 4** (5b) makes it a game people return to for weeks — and changes what it is.
4. **Does 5b's identity shift appeal or repel?** Clean single-serving vs. collection/
   return game is a taste call only you can make — and it only needs answering if step 2
   moves the replay number.
5. **What's the bar for "worth it"?** Even un-caged from "it's a promo tool," your time is
   finite. Naming the threshold ("I'd invest if it could plausibly stand on its own as a
   small released game" vs. "only if it stays a weekend's work") decides how much of this
   we pursue. Step 1 is roughly a weekend-plus; the rest is not.

Nothing here needs an answer today — that's the point. Sit with it.
