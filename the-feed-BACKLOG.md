# The Feed — project state & backlog

*The Feed* is a content-creator life-sim game on this site. This file is the
working memory for it: what's done, what's deferred, and enough detail to pick
the deferred work back up without re-deriving anything. (Not built by Eleventy —
listed in `.eleventyignore`.)

Live at **`/the-feed`** and **`thefeed.jasonnellis.com`**. Currently `noindex`
and not in the nav (deliberately unlisted while in progress).

---

## Architecture (already shipped)

- **`the-feed.html`** — the game page. Standalone (does not load `nav.js`),
  styled in the site's Bolt OS system via `/colors_and_type.css` tokens
  (navy + Signal-Green, DM Sans / DM Mono). Contains rendering, input, the
  sound layer, and the Substack end-screen CTA.
- **`the-feed-engine.js`** — the **single source of truth** for all mechanics,
  economy, events, and balance (`CONFIG` block at top). Pure/UMD. Imported by
  **both** the game (`<script src="/the-feed-engine.js">`) and the simulator,
  so they can't drift. State-mutating actions return an effect-log
  `{floats, feed, bump}` the browser animates and the sim ignores.
- **`tools/the-feed-sim.js`** — headless balance simulator. `require`s the
  engine, adds player personas + a runner. Run: `node tools/the-feed-sim.js 1200`
  (optional 2nd arg = HTML report path). **To rebalance: edit `CONFIG` in the
  engine and re-run — both game and sim move together.**
- **Sound** — Kenney CC0 interface pack in `the-feed-assets/sfx/`, Web Audio
  manager in the game, mute toggle persisted to `localStorage`.
- **Capture** — end-screen CTA links to Substack (*The Long Yes*); Substack is
  the data controller (opt-in, consent, unsubscribe all handled there). No
  email touches the game — the GDPR-safe pattern.
- **Analytics** — Plausible, site-wide (cookieless, no consent banner). NOTE:
  the game carries the Plausible snippet **inline** (it doesn't load `nav.js`);
  normal pages get it from `nav.js`.
- **Assets/licenses** — `the-feed-assets/CREDITS.md`.
- **Eleventy wiring** — passthrough copy for `the-feed.html`,
  `the-feed-engine.js`, `the-feed-assets`; clean-URL + subdomain rules in
  `_redirects`; `the-feed-assets` is in `.eleventyignore`.

### When ready to launch publicly
1. Remove `<meta name="robots" content="noindex">` from `the-feed.html`.
2. Add a nav entry (`NAV_LINKS` in `nav.js`) or link it from `/lens` / a tools page.
3. Consider adding it to `sitemap.njk`.

---

## Deferred build 1 — High-score leaderboard (Netlify Blobs)

**Status:** not started. No plumbing exists yet (`netlify/functions/` dir absent,
`@netlify/blobs` not in `package.json`).

**Plan:**
1. `npm i @netlify/blobs`. Create `netlify/functions/`. Add to `netlify.toml`:
   `[functions]\n  directory = "netlify/functions"`.
2. **`submit-score`** (POST) — body `{ name, followers, ending, week }`.
   Validate + clamp (reject absurd `followers`, cap string lengths), basic
   rate-limit. Write to a Blobs store: `getStore('the-feed-scores')`. Keep a
   capped "top" list (e.g. read list, insert, sort desc by followers, slice
   top 100, write back) or store per-entry keys and compute top on read.
3. **`top-scores`** (GET) — return top N `{ name, followers, ending }`.
4. **Game integration** (`the-feed.html`): on the end screen, "Add your run to
   the board" → POST the channel **display name** (already typed by the player)
   + total followers + ending key. Then GET + render the board in the overlay.
5. **Privacy:** name is a display handle, NOT PII; never collect email here.
6. **Caveat to state in UI/code:** client-submitted scores are spoofable. Fine
   for a toy board (clamp + rate-limit). True anti-cheat would need
   server-authoritative simulation — not worth it here.

**Files:** `package.json`, `netlify.toml`, `netlify/functions/*.mjs`,
`the-feed.html` (submit + board UI). Engine unchanged (maybe export an ending
label helper).

---

## Deferred build 2 — OpenMoji (consistent emoji everywhere)

**Status:** not started. CREDITS.md already has the OpenMoji entry staged.
License: **CC BY-SA 4.0** (attribution + share-alike required — keep the credit
visible).

**Why it's non-trivial:** emoji are used as inline text in ~50 places, including
*inside* feed message strings and in engine data — so a find-replace won't do it.
Do it as a Twemoji-style runtime swap.

**Plan:**
1. Vendor the ~50 needed color SVGs into `the-feed-assets/openmoji/` from
   `github.com/hfg-gmuend/openmoji` (`color/svg/<HEX>.svg`). The emoji set spans:
   niches (🎮💄📚🤡💪🎧🎥), platforms (🎬📱💬📰🔴), meters/actions
   (⚡💚🎬🔥😌🛠️🤝⭐📣🧰📈🎓😴🌊🔁🔗✨), every event + choice emoji, and the
   8 ending glyphs (📛💸🕯️🤑🌟👑🏆🌫️). Grep the engine + game for the full list.
2. Keep engine emoji as **unicode** (source of truth; the sim must stay text).
   Convert to `<img>` only at display time, in the browser.
3. Add a small parser: walk text nodes under the game root and replace emoji
   runs with `<img class="oe" alt="<emoji>" src="/the-feed-assets/openmoji/<HEX>.svg">`.
   Run it after each `render()` (or via a MutationObserver on the game container).
   CSS: `.oe{height:1em;width:1em;vertical-align:-0.15em}`.
4. Passthrough-copy `the-feed-assets/openmoji` (already covered — the whole
   `the-feed-assets` dir is passthrough-copied).
5. Keep the OpenMoji credit link visible (CREDITS.md + maybe a small footer note
   on the game, per CC BY-SA).

**Files:** `the-feed-assets/openmoji/*.svg` (new), `the-feed.html` (parser + CSS),
`the-feed-assets/CREDITS.md` (already staged).

---

## Other noted ideas (not committed to)
- Ending-personalized Substack CTA (e.g. "You're a Niche Legend — here's an essay
  on exactly that").
- Inline email capture instead of link-out (more work; needs consent UI + ESP API).
- Mid-game depth for weeks ~20–40 if playtesting shows a sag (rival creators, a
  shifting platform meta).
