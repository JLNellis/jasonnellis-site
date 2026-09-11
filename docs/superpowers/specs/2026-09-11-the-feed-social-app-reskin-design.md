# The Feed — Sub-project C: Social-app reskin

*Design spec, 2026-09-11. Third of three sub-projects (A: core loop — shipped ·
B: event deck — shipped · C: social-app reskin). C is chrome only: it restyles
and re-lays-out `the-feed.html`. The engine (`the-feed-engine.js`) and the
30-card deck are **not** touched.*

## Why

The game plays as a desktop two-column dashboard styled in the site's Bolt OS
"operator" system. That aesthetic fights the fantasy — playing a creator should
*feel like an app*, not like reading a control room. Two concrete problems:

1. **It reads as generic / "corporate site component."** Sharing the main
   site's restrained palette makes the toy feel like a widget of the brand, not
   its own thing. (Jason's words: "too Claude-generated.")
2. **Mobile is second-class.** The board collapses at 860px and the backlog
   flags a stacking bug (move cards jump above the meters). A life-sim about
   phones should be phone-first.

C gives the game its own **committed visual world** — a phone-shaped social app
— that still threads back to Jason's identity, and makes the mobile layout the
*primary* layout so the stacking bug disappears by construction.

## Design goals

- **One opinionated look, fully committed.** The generic smell comes from safe
  defaults; the cure is commitment, not a new hue.
- **Same author, off the clock.** Keep one deliberate thread to the brand
  (signal green + DM Mono) so it reads as Jason's wink, not a random template.
- **One layout at every width.** The desktop view *is* the mobile view,
  centered. No separate responsive mode; the stacking bug cannot recur.
- **Engine untouched.** Pure presentation. Every engine call, effect-log
  contract, and balance number stays exactly as shipped in B.

## 1. Committed visual direction (all approved in brainstorm)

### Structure — "centered app column" (Concept C)
A single phone-width column (max-width ~440px) centered on the page, no
skeuomorphic device bezel. A persistent **bottom tab bar** (4 tabs). On desktop
it sits centered on the page background; on mobile it fills the width. There is
no second layout.

### Skin — "Sticker Feed"
Bold social-app pastiche: chunky 2px borders, hard offset shadows, sticker-like
pills. Committed token set (define in `the-feed.html`'s own `<style>`; these are
the game's tokens, layered over the base `colors_and_type.css` font faces):

```
--sf-bg:    #0B1E38   /* app ground (navy, the brand thread) */
--sf-bg-2:  #0a1830   /* page behind the column */
--sf-card:  #12264a   /* cards / sheets */
--sf-edge:  #00E676   /* signal green — brand thread; borders, evergreen, rep */
--sf-red:   #FF0033   /* YouTube red — PRIMARY pop + active state */
--sf-gold:  #FFCA4B   /* secondary accent (milestones, deal $) */
--sf-blue:  #5AA9FF   /* tertiary (trend, links) */
--sf-fg:    #FFFFFF   --sf-fg-2:#9FB3D0   --sf-fg-3:#6F86A8
```

Type: **Space Grotesk** (700/500) for display/headings and tab labels, loaded
via a Google Fonts `<link>` (the page is a real site page, no CSP limit);
**DM Mono** for labels/eyebrows/metrics; **DM Sans** for body — both already
loaded by `colors_and_type.css`. Borders 2px; radii 12–20px; a hard offset
shadow (`3px 3px 0 rgba(0,0,0,.35)`) is the signature, not a soft blur.

### Icons — bespoke **solid** set, **selective color**
Replace the structural emoji with ~19 hand-authored solid SVG glyphs, delivered
as an inline `<symbol>` sprite referenced by `<use>` and colored via CSS
`currentColor`. Selective-color rules:

- **Chrome** (tabs, business actions, content angles): monochrome — inactive
  `--sf-fg-3`, the **active tab in `--sf-red`**.
- **Platform icons**: each carries its existing engine color
  (`PLATFORMS[key].color` — longform green, short blue, micro slate, newsletter
  amber, live red). This is the one place polychrome earns its keep.
- **Meters**: semantic — stress amber→red as the band rises, reputation green.
- Offset-duo (a red hard-shadow ghost behind the green glyph) is an optional
  flourish reserved for the **large platform badges only**, never tab-bar size.

The glyph set (~19): **tabs (4)** home · alerts (bell) · inbox (DM bubble) ·
stats (bars) · **platforms (5)** longform · short · micro · newsletter · live ·
**angles (3)** trend · evergreen · personal · **business (5)** engage · deal ·
upgrade (gear) · membership (star) · team · **meters (2)** stress · reputation.
Plus a few utility glyphs (sound on/off, expand-platform, cross-post) styled to
match. Feed/event narrative emoji are **not** in this set (see §4).

## 2. Information architecture — the four tabs

The app column is: **header** (always visible) + **tab content** (swaps) +
**bottom tab bar** (always visible).

**Header (persistent):** channel avatar + name, week chip (`WK 14 / 52`), and a
compact **meter row** — Stress, Reputation, Bank (and Overhead on tap/expand).
Meters are thin sticker bars; Bank/Overhead are mono metrics. The header is
where the float-anchor elements live (see §5).

**Tab content:**
- **Home** = *this week*. The dealt content hand (`S.hand`) as sticker cards,
  the business actions, the slot pill (`2 content · 1 business`), and the
  **End the week** button. This is the default tab and the working surface.
- **Alerts** = *the feed*. `S.feed` rendered as notification rows with fake
  handles and comment styling (see §4).
- **Inbox** = *events as DMs*. When an event is pending it appears here as a DM
  thread; the choices are reply buttons (see §3). Otherwise shows a short
  history of resolved events / a quiet empty state.
- **Stats** = *sparklines*. Weekly history of followers, cash, stress, rep as
  inline-SVG sparklines (see §6).

Tabs badge when they have something new (Alerts on new feed items since last
viewed; Inbox when an event is waiting).

## 3. Flow — event as a DM (preserves the forced decision)

Current flow (unchanged in the engine): `endWeek()` → `settleWeek` →
`rollEvent`; if an event returns, `S.phase='event'` and the player must choose
before `advance()`.

Reskinned presentation:
- On an event, set `S.phase='event'`, **auto-switch the active tab to Inbox**,
  badge it, and render the event card as a **DM thread** — sender styled per
  event (a platform notice, a brand, a fan handle), the `title`/`text` as the
  message, and each `choice` as a reply button (`label` + `desc`, colored by
  its `t` tag: repair/neutral/escalate).
- Advancing stays **blocked** until a choice is made — the forced weekly
  decision is preserved exactly; only its costume changes.
- After `applyEventChoice`, the outcome posts back into the thread, the event
  clears, and the app returns to **Home** for the next week.

No change to `rollEvent`/`applyEventChoice`/`advance`; this is rendering only.

## 4. Feed as notifications (Alerts tab)

`S.feed` items (`{e, t, k}` — emoji, text, kind) render as notification rows:
a generated **@handle** + avatar chip, the engine's text **verbatim** as the
body, and the item's emoji kept as the row glyph. Kind drives styling: `good`/
`big` read as likes/hype (green/gold), `bad` as warnings (red). A small fixed
pool of fake handles supplies flavor; some rows render as "comments" for
texture. **The engine's feed text is the payload and is never rewritten.**

Scope note: the **per-line feed/event flavor emoji** (60+ one-off story beats)
**stay as emoji** — a fixed bespoke set can't cover them and they read as
authored content, not chrome. Replacing those is explicitly **out of C**; if
wanted, it's a separate project.

## 5. Contracts the reskin MUST preserve

These are load-bearing; breaking them silently breaks the game.

- **Float anchors.** `floatDelta` positions floating deltas over live DOM
  elements by id: `v-cash`, `v-rep`, `v-stress`, and `cc-<platformKey>`. The new
  header meters/metrics must keep ids `v-cash` / `v-rep` / `v-stress`, and each
  platform icon element must keep id `cc-<key>` — or `anchorId()`/`floatDelta`
  are updated in lockstep. (Simplest: keep the ids.)
- **Engine API.** All calls stay: `newState`, `buildHand`, `applyMove`,
  `biz[id]`, `settleWeek`, `rollEvent`, `applyEventChoice`, `advanceWeek`,
  `checkEndings`, plus the read helpers. No new engine exports.
- **Effect-log → feedback.** `applyLog` (floats + feed + bump + sound) stays;
  the `TONE` map may be remapped to Sticker Feed tokens but the log shape is
  unchanged.
- **Sound layer** (Kenney pack, Web Audio) is untouched, including the
  `thefeed_muted` localStorage key.
- **`noindex`** stays until launch; **Plausible** inline snippet stays;
  standalone page (does **not** load `nav.js`) stays.

## 6. Stats tab — sparklines (no engine change)

The engine tracks no weekly history. Add a **UI-side** `hist` array (closed over
in the page script, not in engine state), pushing a snapshot
`{week, followers, cash, stress, rep}` on each `advance()` (and once at
`newGame`). The Stats tab draws these as inline-SVG sparklines with an
emphasized endpoint and a faint baseline, one per metric. This is presentation
state only — it does not enter `S`, the engine, the sim, or the tests.

## 7. Start & end screens

Reskin both overlays into the Sticker Feed world: the start screen (name / niche
/ home-platform pickers) as an "create your account" sheet; the end screen
(ending emoji, title, blurb, stats, Substack CTA, "Run it back") as a "wrapped /
year in review" card. Same content and same Substack CTA target — the ending →
essay CTA remains a **separate** backlog item, still blocked on the essays, and
is not part of C.

## 8. Responsive

One column at every width. Below ~440px it fills the viewport with small padding
and a safe-area-aware bottom tab bar (`viewport-fit=cover` already set). Above
that it's the same column centered on `--sf-bg-2`. Because there is only one
layout, the mobile stacking bug (moves above meters) is resolved by construction
— there is no breakpoint that reorders anything.

## 9. Scope guardrails (YAGNI)

Explicitly **out** of C:
- No engine, mechanics, economy, or balance changes; no new engine exports.
- No replacement of the narrative feed/event emoji (§4).
- No ending → essay CTA wiring (still blocked on essays; separate item).
- No leaderboard (deferred until after C).
- No new sounds; no new game content.

## 10. Files touched

- `the-feed.html` — the only file. Rewrite its `<style>` block (Sticker Feed
  tokens + components) and its `<body>` structure (app column, tabs, sheets),
  add the inline SVG icon sprite, and adapt the render functions
  (`render`, `renderChannels`, `renderMoves`, `renderEvent`, `renderFeed`, plus
  new `renderInbox`/`renderStats`/tab routing) to the new DOM while honoring the
  §5 contracts. Add a Google Fonts `<link>` for Space Grotesk.
- `the-feed-BACKLOG.md` — mark C shipped at the end.

`the-feed-engine.js`, `tools/the-feed-sim.js`, `tools/the-feed-test.js`, and the
`the-feed-assets/` are **not** touched.
