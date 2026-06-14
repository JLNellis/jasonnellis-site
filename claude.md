# CLAUDE.md — jasonnellis.com

Context file for Claude Code sessions on this repo. Read this first.

---

## What this site is

Jason Nellis's personal site. Purpose: thought leadership and audience
building — **not** job seeking. Jason is a strategist, writer, and media
executive (Head of Innovation & Strategy at BoltOS; co-founder Akaeon Corp;
hosts the *Building Value* podcast). Based near Cannes, France.

The site positions him as "Strategist · Writer." Tone is direct, confident,
no filler.

---

## Stack & deployment

- Static HTML/CSS/JS — no build step, no framework, no package.json.
- Hosted on **Netlify**, connected to this **GitHub** repo.
- Pushing to the main branch triggers an automatic Netlify deploy.
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
- `SITE_CONFIG` holds: Substack handle, "last updated" date, LinkedIn,
  Twitter/X, podcast link, contact email. Update these in one place.
- Active-page highlighting (`aria-current="page"`) is computed automatically
  from the URL — no per-page configuration needed.

If a future page needs nav, just add the two tags + script include and an
entry in `NAV_LINKS`. Never hand-roll header/footer HTML again.

---

## Analytics — REQUIRED ON EVERY PAGE

Every page's `<head>`, immediately after the opening `<head>` tag and before
`<meta charset="utf-8">`, must include the Google Analytics (gtag.js)
snippet:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-PP4FTXFZRX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-PP4FTXFZRX');
</script>
```

Any new page must include this snippet. Don't change the tracking ID
(`G-PP4FTXFZRX`) without explicit instruction from Jason.

---

## Pages

| File | Purpose | Notes |
|---|---|---|
| `index.html` | Homepage | |
| `blog.html` | Writing archive | Has Substack subscribe banner (email capture form). Old LinkedIn reposts + essays live here as archive. |
| `speaking.html` | Speaking/media page | Aspirational — positioning + "book me" CTA, not a list of past gigs. Media section has 4 embedded Building Value YouTube clips (Chef Mike Haracz, Betina Chan-Martin, Ken Bolido, Jacklyn Dallas). |
| `now.html` | "Now" page | What Jason's working on / thinking about / where he is. **Update quarterly** — there's a literal "last updated" badge and a dashed note saying so. Sections: Building, Publishing, Thinking About, Living. |
| `bio.html` | About / personal story | Contains the origin narrative (Hodgkin's diagnosis at 19, Northwestern, the move to France). This content doesn't exist anywhere else — don't remove without checking with Jason. |
| `contact.html` | Contact page | |

`cv.html` was **removed** — all "see my background" / CV links now point to
LinkedIn (`https://linkedin.com/in/jasonnellis`). Don't recreate it.

---

## Pending / known placeholders

- **Substack**: not yet launched. `SITE_CONFIG.substackHandle` in `nav.js`
  is set to `'YOUR-SUBSTACK-HANDLE'`. The blog page subscribe form also
  references this placeholder in its form `action` URL
  (`https://YOUR-SUBSTACK-HANDLE.substack.com/api/v1/free`). Once Jason has
  a real handle, update both.
- **`now.html` "Thinking About" section**: written for June 2026 — Jason
  should refresh this content periodically; it's explicitly meant to go
  stale and be rewritten, not maintained indefinitely.

---

## Design system — "Bolt OS"

Dark, controlled, data-forward. Defined in `colors_and_type.css` (tokens)
and `site.css` (components/layout). Always use CSS variables — never
hardcode hex values.

**Key tokens:**
- `--bg-base` (#0A2540 navy), `--bg-deep` (#0F172A), `--bg-card` (#1E293B)
- `--fg-1` white, `--fg-2` cool gray (#94A3B8, secondary text), `--fg-3`
  (#64748B, tertiary/metadata)
- `--color-accent-vivid` (#00E676, "Signal Green") — the **only** accent
  color. Used for active states, CTAs, live indicators. Never as a
  background. Used sparingly — roughly 10% of any surface.
- Fonts: `--font-sans` (DM Sans, standing in for licensed Suisse Intl),
  `--font-mono` (JetBrains Mono) for labels/eyebrows/badges/timestamps.
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