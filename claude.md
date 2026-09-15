# CLAUDE.md — jasonnellis.com

Context file for Claude Code sessions on this repo. Read this first.

---

## What this site is

Jason Nellis's personal site. Purpose: thought leadership and audience
building — **not** job seeking. Jason is a strategist, writer, and media
executive (Director of Innovation at BoltOS; co-founder Akaeon Corp;
hosts the *Building Value* podcast). Based near Cannes, France.

The site positions him as "Strategist · Operator · Speaker." Tone is direct,
confident, no filler.

---

## Stack & deployment

- Mostly static HTML/CSS/JS, hand-authored, no templating — **except** the
  essay archive (`/blog` + individual essays), the individual talk pages
  (`/speaking/<slug>`), and the generated feeds, which are built by
  **Eleventy** (11ty). See "Writing archive (Eleventy)" below before
  touching anything under `essays/`, `talks/`, `blog.njk`, `index.njk`,
  `sitemap.njk`, `feed.njk`, or `_includes/`.
- Hosted on **Netlify**, connected to this **GitHub** repo.
- Netlify build command is `npm install && npx @11ty/eleventy` (see
  `netlify.toml`), publishing the generated `_site/` directory. Pushing to
  main triggers this build automatically. A broken Eleventy build (bad
  front matter, template syntax error, etc.) will fail the deploy — check
  the Netlify deploy log if a push doesn't go live.
- The hand-authored static pages (`bio.html`, `contact.html`,
  `speaking.html`, `advisory.html`, `ascii.html`, `press-kit.html`) plus `404.html` are
  plain HTML — Eleventy copies them through byte-for-byte
  (`addPassthroughCopy` in `.eleventy.js`), no templating applied. Edit
  them exactly as before.
- **`index.html` no longer exists** — the homepage is now `index.njk`,
  Nunjucks-templated so its "recent writing" teaser can pull live from the
  essay collection. It still emits `/index.html` and is otherwise plain
  hand-authored HTML; edit it like the others, just mind the `{%- for ... %}`
  block in the writing teaser.
- Email: `hello@jasonnellis.com` → forwards to Jason's Gmail via ImprovMX
  (DNS configured in GoDaddy — not part of this repo).

---

## Architecture — READ THIS BEFORE EDITING NAV/FOOTER

Navigation and footer are **not** duplicated across pages. They live in a
single file: **`nav.js`**, using Web Components (`<site-header>` and
`<site-footer>` custom elements).

- Every page includes `<script src="nav.js"></script>` in `<head>`, and
  `<site-header></site-header>` / `<site-footer></site-footer>` in `<body>`.
- `nav.js` builds the nav links from a `NAV_LINKS` array and the footer from
  a `SITE_CONFIG` object, both at the top of the file.
- **To add/remove/reorder a nav item: edit `NAV_LINKS` in `nav.js` only.**
  Do not add header/footer markup to individual HTML files.
- **Legal/utility links (privacy policy, future terms, etc.) live in
  `LEGAL_LINKS` in `nav.js`** and render in the footer bottom bar next to the
  copyright line. Every page that includes `nav.js` gets them automatically;
  never hand-link `/privacy` in page markup.
- `SITE_CONFIG` holds: newsletter URLs (Kit), "last updated" date, LinkedIn,
  Twitter/X, podcast link, contact email. Update these in one place.
- Active-page highlighting (`aria-current="page"`) is computed automatically
  from the URL — no per-page configuration needed.

If a future page needs nav, just add the two tags + script include and an
entry in `NAV_LINKS`. Never hand-roll header/footer HTML again. For the
page's clean URL, see "URL structure" below.

---

## URL structure — clean URLs (no `.html`)

All pages are served at clean paths without file extensions (e.g.
`https://jasonnellis.com/blog`, not `/blog.html`). This is handled by the
**`_redirects`** file at the repo root (Netlify reads this automatically):

- **200 rewrites** serve each clean path from its underlying `.html` file
  (e.g. `/blog` → `blog.html`) while keeping the clean URL in the browser.
- **301 redirects** send old `/*.html` URLs to the clean path, so any
  existing links/bookmarks/search results still resolve.

`bio.html` is the one exception to "slug matches filename" — it's served at
`/about` (matching the nav label), not `/bio`. The filename stays `bio.html`.

**Internal links must always use the clean path** (`/blog`, `/about`,
`/contact`, etc.), never `*.html`. `nav.js` (`NAV_LINKS` hrefs and
`activePage()`) is already built around clean paths.

**Adding a new page:** add an entry to `NAV_LINKS` in `nav.js` (if it needs
nav) *and* add a rewrite + redirect pair to `_redirects` following the
existing pattern.

`/blog` is the one exception to the rewrite pattern above — it's generated
directly at `_site/blog/index.html` by Eleventy, so it needs no `_redirects`
entry (Netlify serves a directory's `index.html` natively). Same for every
essay under `/blog/<slug>/`.

---

## Writing archive (Eleventy)

Essays live as individual Markdown files in `essays/*.md`, one file per
essay, each with front matter:

```markdown
---
title: "Essay title"
description: "One-sentence description, used for meta/OG/JSON-LD."
date: 2025-02-10
category: "Creator Economy"
readTime: "5 min"
originalDate: "Feb 2025"
originalUrl: "https://www.linkedin.com/posts/..."
---
Body content in Markdown — plain paragraphs, `> blockquote`, `### h3`.
```

**To publish a new essay:** add a new `.md` file to `essays/`. That's it —
`essays/essays.json` supplies the shared layout and permalink pattern
(`/blog/<filename-without-extension>/`), so the file name becomes the URL
slug. The `/blog` index, `sitemap.xml`, and the featured-post slot on the
index all update automatically from the same collection — nothing else
needs to be touched by hand.

- `_includes/essay-layout.njk` is the shared per-essay template (head
  boilerplate, GA snippet, OG/Twitter tags, canonical, `Article` JSON-LD,
  the `.post-body` styling). Edit this once to change how every essay page
  looks — don't hand-edit individual essay output.
- `blog.njk` is the `/blog` index template — hero, Substack subscribe
  banner, category filter bar, featured post, and the full post list. Loops
  over `collections.essays` (defined in `.eleventy.js`, sorted newest
  first).
- `sitemap.njk` generates `sitemap.xml` from the essay and talk collections
  plus the static pages — don't hand-maintain a separate sitemap file.
- `feed.njk` generates the Atom feed at `/feed.xml` from the same essay
  collection (newest first), summary-level using each essay's `description`.
  It's linked for autodiscovery in the `<head>` of the homepage, `/blog`,
  and every essay, and from the footer via `nav.js`. Nothing to maintain by
  hand — new essays appear in the feed automatically.
- Experiments index: `/experiments` is generated by `tools.njk` from the `tools`
  collection — one `tool-index/<slug>.md` per tool (front matter: `title`,
  `kind`, `tagline`, `url`, `cta`, `time`, `released`, `order`; body = card
  description). The tool pages themselves stay standalone HTML; the
  collection emits no pages (`permalink: false` in
  `tool-index/tool-index.json`). The homepage `05 · Experiments` teaser and
  `sitemap.xml` read the same collection. **To list a new tool:** build its
  standalone page as usual, then add one `tool-index/<slug>.md`. Card styles
  (`.tool-grid` / `.tool-card`) live in `site.css`. The directory is
  `tool-index/`, not `tools/`, because `tools/` holds build scripts. The page
  was renamed Tools -> Experiments in Sept 2026; the *internal* names (the
  `tools` collection, `tools.njk`, `tool-index/`) were deliberately left alone,
  and `_redirects` 301s the old `/tools` path.
- Talks: individual talk pages live as `talks/*.md` (front matter + body),
  rendered by `_includes/talk-layout.njk` into `/speaking/<slug>/`. The
  `talks` collection is ordered by an `order` field; `talks/talks.json`
  supplies the shared layout/permalink, same pattern as essays.
- Local preview: `npm run build` writes `_site/`; there's a `site` entry in
  `.claude/launch.json` that runs `npm run serve` on port 8080. `npm run
  serve` also works for a live-reloading dev server.

---

## Analytics & privacy — READ BEFORE ADDING ANY THIRD-PARTY SCRIPT

Analytics is **Plausible** (cookieless, EU-hosted, no consent banner
needed). It is loaded once from the top of `nav.js`, so every page that
includes `nav.js` gets it for free. Standalone pages that don't load
`nav.js` (`the-feed.html`, `ascii.html`, `burn-rate.html`) carry the same
snippet inline in their own `<head>`. There is **no Google Analytics** on
the site — don't add it back.

The privacy policy at `/privacy` (`privacy.html`) describes exactly what the
site does. Keep it true. Conventions that keep it true:

- **YouTube embeds use `https://www.youtube-nocookie.com/embed/<id>`**,
  never `youtube.com/embed/`. Privacy-enhanced mode sets no cookie until the
  visitor presses play, which is what the policy promises.
- **No Google Fonts CDN, no third-party CSS/JS CDNs.** Fonts are self-hosted
  in `/fonts` with `@font-face` declarations (`colors_and_type.css` for the
  site faces; `the-feed.html` inline for its own Space Grotesk / Anton).
- **Nothing sets a cookie before user action.** Adding anything that does
  (an ad pixel, a chat widget, a non-Plausible analytics tag) means adding a
  consent banner *and* updating `/privacy` — so don't, without asking Jason.
- Forms: the contact form is Netlify Forms; the newsletter form posts
  straight to Kit (plain HTML POST to the form endpoint — deliberately NOT
  Kit's `ck.5.js` embed, which would set cookies and force a consent banner).
  Endpoint and field name live in `SITE_CONFIG` in `nav.js`; the email input
  must be `name="email_address"`, which is what Kit expects. If a new form appears anywhere, the policy's
  "What I collect" section needs a matching entry.
- `localStorage` is fine for on-device state (games, mute, unlock flags).
  It never leaves the browser and the policy already covers it.
- When any of the above changes, update the "Last updated" date in the
  `/privacy` hero eyebrow.

## Pages

| File | URL | Purpose | Notes |
|---|---|---|---|
| `index.njk` | `/` | Homepage | Nunjucks-templated (the "recent writing" teaser pulls from the essay collection); still emits `/index.html`. Otherwise plain hand-authored HTML. |
| `blog.njk` + `essays/*.md` | `/blog`, `/blog/<slug>` | Writing archive | Eleventy-generated — see "Writing archive (Eleventy)" above. Has newsletter subscribe banner (Kit email capture form). Essays are LinkedIn reposts turned into permanent pages. |
| `speaking.html` + `talks/*.md` | `/speaking`, `/speaking/<slug>` | Speaking/media page + per-talk pages | Aspirational — positioning + "book me" CTA, not a list of past gigs. Has a "Where I'll be" strip (section 05) listing upcoming markets/events Jason will attend — one `.where-row` per event, hand-maintained; remove rows once the event has passed (MIPCOM 2026, 12–15 Oct, is the first). The homepage `.offer-note` pill repeats the same event and needs the same cleanup. Section 04 (Formats) lists panel moderation / event MC as a named bookable offer alongside keynotes, with a `.mod-callout` making the case from real numbers (50+ VidCon interviews on Meta's Super + 100+ Building Value episodes = 150+ hosted conversations) — added Sept 2026 because organisers book moderators on a separate line item from keynotes. Media section embeds Building Value YouTube clips via `youtube-nocookie.com` (see "Analytics & privacy"). Individual talk pages are Eleventy-generated from `talks/*.md` via `_includes/talk-layout.njk`. |
| `advisory.html` | `/advisory` | Advisory / contract work | Three named engagements (The Read, The 90-Day Sprint, Retainer) with "from" pricing, who-it's-for, how-I-work terms, case-study links, and a CTA that prefills the contact form with `?topic=advisory`. Prices live only in this file — change them here. |
| `press-kit.html` | `/press-kit` | Speaker press kit | Bios (short/long), downloadable headshots (square stage shot `jason-nellis-headshot-stage.jpg` + 2400px download variant, and the seated portrait), MC intro script, AV requirements, one-pager + PDF download. `noindex` (deliberately kept out of the sitemap). Linked from `/speaking`. The downloadable `jason-nellis-speaker-kit.pdf` is generated by `tools/build-speaker-kit.py` (deps: `pip3 install reportlab fonttools brotli`) — edit the copy in that script and rerun it to regenerate; never hand-edit the PDF. |
| `tools.njk` + `tool-index/*.md` | `/experiments` | Experiments index | Eleventy-generated — see "Writing archive (Eleventy)". Lists The Feed, Burn Rate, and The Lens as cards with a newsletter banner. In `NAV_LINKS` as "Experiments". Template filename stays `tools.njk`; old `/tools` 301s here. |
| `lens.html` | `/lens` | The Lens — creator durability framework | Three questions ("tells") for reading whether a creator is building or renting attention. Linked from `/blog` hero, `/speaking`, `/advisory`, `/experiments`. |
| `burn-rate.html` | `/burn-rate` | Burn Rate — creator cadence calculator | Standalone-styled but loads `nav.js`. Newsletter-gated "what to cut" plan (unlock flag in `localStorage`). Indexed since 2026-09-14; listed on `/experiments`. OG image built from `tools/burn-rate-og/`. |
| `bio.html` | `/about` | About / personal story | Contains the origin narrative (Hodgkin's diagnosis at 19, Northwestern, the move to France). This content doesn't exist anywhere else — don't remove without checking with Jason. Served at `/about`, not `/bio` — see "URL structure". Hero is a split layout: text left, portrait right. Portrait is `jason-nellis-stage-portrait.jpg` — a 1200x1800 crop of the IFA Berlin stage shot (master: `confheadshot.jpg`, 3711px). It's a high-key image on a dark page, so the CSS carries a deliberate `filter` plus layered navy gradients to sit it in the palette; re-tune those together if the photo is ever swapped. |
| `contact.html` | `/contact` | Contact page | |
| `thanks.html` | `/thanks` | Newsletter confirmation page | Where Kit redirects after a successful subscribe (set in the Kit form's `after_subscribe` settings — if that redirect is ever cleared, subscribers land on Kit's own unbranded page instead). Tells them to confirm the double opt-in email, then points at `/blog`, `/experiments`, `/building-value`. `noindex`, kept out of the sitemap. |
| `privacy.html` | `/privacy` | Privacy policy + French legal notice | GDPR policy in Jason's voice, eight numbered sections, processors table, CNIL details, LCEN legal notice at the end. Linked from the footer bottom bar via `LEGAL_LINKS` in `nav.js` (not `NAV_LINKS`) and from the contact form meta row. See "Analytics & privacy" above for the conventions that keep it accurate. |
| `ascii.html` | `/ascii` | Hidden ASCII art easter egg | Linked via a near-invisible `.` link on the homepage. |

`cv.html` was **removed** — all "see my background" / CV links now point to
LinkedIn (`https://linkedin.com/in/jasonnellis`). Don't recreate it.

---

## Design system — "Bolt OS"

Dark, controlled, data-forward. Defined in `colors_and_type.css` (tokens)
and `site.css` (components/layout). Always use CSS variables — never
hardcode hex values.

**Key tokens:**
- `--bg-base` (#0A2540 navy), `--bg-deep` (#0F172A), `--bg-card` (#1E293B)
- `--fg-1` white, `--fg-2` cool gray (#94A3B8, secondary text), `--fg-3`
  (#8892AA, tertiary/metadata — lightened from #64748B to hold WCAG AA)
- `--color-accent-vivid` (#00E676, "Signal Green") — the **only** accent
  color. Used for active states, CTAs, live indicators. Never as a
  background. Used sparingly — roughly 10% of any surface.
- Fonts: `--font-sans` (DM Sans, standing in for licensed Suisse Intl),
  `--font-mono` (DM Mono, same foundry as DM Sans) for labels/eyebrows/
  badges/timestamps.
- Borders are subtle (`--border-subtle`, 1px, low contrast) — structural,
  not decorative.

**Conventions seen across pages:**
- Section eyebrows: small mono-font numbered labels (e.g. `01 · Section
  name`) above each `<h2>`.
- Cards: `--bg-card` background, `--border-subtle`, `--radius-lg` (10px),
  hover state brightens border to accent green at low opacity.
- CTAs: `.btn.primary` (filled green) and `.btn.ghost` (outlined) button
  classes already exist in `site.css`.
- "Live" indicators: small pulsing green dot (`.live-pip` / `.live-dot`),
  used for active ventures and the location pill in the nav.

---

## The Feed (game at `/the-feed`)

A content-creator life-sim game. Full state, architecture, and the open
backlog (leaderboard + OpenMoji, both deferred) live in
**`the-feed-BACKLOG.md`** — read it before touching the game. Key facts:

- Mechanics/economy/balance are in **`the-feed-engine.js`** (single source of
  truth, `CONFIG` block); imported by the game, the balance simulator
  `tools/the-feed-sim.js` and the tests `tools/the-feed-test.js`. To
  rebalance: edit `CONFIG`, run `npm run sim` (exits non-zero if the six
  balance targets fail). `npm test` runs the deterministic engine tests.
- The week loop is **2 content slots + 1 business slot**; **stress** (not
  energy) is the health meter; content cards are platform × angle
  (Trend / Evergreen / Personal) × an authored topic line. There is no skill
  stat. See `the-feed-BACKLOG.md` for the full mechanical summary.
- `the-feed.html` is standalone (does NOT load `nav.js`) — so its Plausible
  snippet is inline, and it's styled via Bolt OS tokens from
  `colors_and_type.css`. Its Space Grotesk / Anton faces are self-hosted
  from `/fonts` via inline `@font-face` (no Google Fonts CDN).
- Live at `/the-feed` and `thefeed.jasonnellis.com`; indexed and listed on
  `/experiments` (via `tool-index/the-feed.md`) since 2026-09-14. Not a top-level
  nav item.

---

## Assets backlog

Things the site needs that can't be written, only collected — testimonials,
speaker footage, logos, NDA clearances, numbers Jason is waiting on — live in
**`ASSETS-BACKLOG.md`** at the repo root, ranked by leverage. It also records
the open decision about which claim leads the site header, and the list of
claims deliberately *not* being pursued (and why). Check it before proposing
new proof-led copy: the answer to "we should add testimonials here" is usually
already tracked there.

## Working preferences

- **Minimal maintenance is the priority.** Don't propose solutions that
  require ongoing manual upkeep unless explicitly requested.
- Prefer direct, opinionated recommendations over surveyed options — Jason
  decides quickly once choices are framed clearly.
- For simple changes: targeted edits to existing files. For larger
  structural changes: ask first, don't assume.
- Ask clarifying questions before generating new pages rather than guessing
  content/structure.
- Low tolerance for unnecessary back-and-forth — be efficient.