# Tools index (`/tools`) — design

**Date:** 2026-09-14
**Status:** approved by Jason ("Let's call it Tools"), implemented in the same session

## Problem

Three interactive pieces exist with no shared home and no discovery path:

| Tool | Inbound links before this change | Indexed? |
|---|---|---|
| The Feed (`/the-feed`, `thefeed.jasonnellis.com`) | Privacy policy sentence; Burn Rate footer | `noindex` |
| Burn Rate (`/burn-rate`) | None | `noindex` |
| The Lens (`/lens`) | Blog hero, speaking, advisory | indexed |

Jason plans to keep adding tools as lead-gen assets (every tool ends in a
Substack subscribe). They need one page that lists them, nav placement, and
a homepage teaser — with zero per-tool upkeep beyond dropping in a file.

## Decisions

- **Name / URL:** "Tools" in the nav, page at `/tools`.
- **Eleventy collection, not a hand-authored page.** Same pattern as
  essays and talks: one `tool-index/<slug>.md` per tool, `tool-index/tool-index.json`
  supplies shared data. The tool pages themselves stay standalone HTML;
  the collection only feeds the index and the homepage teaser.
- **Index everything.** Remove `noindex` from `the-feed.html` and
  `burn-rate.html`; `/tools` and every tool URL go into `sitemap.xml`
  from the collection. The Feed backlog already listed "link it from a
  tools page + remove noindex" as its launch step.
- **Nav:** `Tools` inserted after `Writing` in `NAV_LINKS` (content, not
  services). Footer "Site" column follows automatically.
- **Homepage:** new section `05 · Tools` between Recent writing and the
  podcast (podcast renumbers to 06). Loops over the collection, cards
  shared with `/tools` via `site.css`.
- **Back-links:** each tool gets a small "All tools →" link near its
  existing CTA/footer so a visitor arriving from a share link can find the
  rest. The Feed links to the absolute URL because it also lives on the
  subdomain.

## Data model — `tool-index/<slug>.md`

```markdown
---
title: "Burn Rate"
kind: "Calculator"            # eyebrow on the card
tagline: "Can you afford your own upload schedule?"
url: "/burn-rate"
cta: "Run the numbers"
time: "2 min"                 # how long it takes
released: "Sep 2026"
order: 2                      # index sort, ascending
---
One or two sentences of body Markdown — rendered as the card description.
```

`tool-index/tool-index.json` sets `permalink: false` (no page output; the real page
already exists) and `tags: ["tool"]`. The `tools` collection in
`.eleventy.js` sorts by `order`.

## Components

- `tools.njk` → `/tools/index.html`. Hero (eyebrow, h1, lede), card grid,
  Substack subscribe banner. Loads `nav.js`. OG tags reuse `og-image.png`.
- `site.css` gains `.tool-grid` / `.tool-card` (card, kind eyebrow, title,
  tagline, description, meta row, CTA button). Used by both `tools.njk`
  and `index.njk`.
- `index.njk` teaser: `block-head` with "All tools" ghost button, then the
  same grid.
- `sitemap.njk`: static `/tools` entry; the hard-coded `/lens` line is
  replaced by a loop over `collections.tools` (`tool.data.url`).
- `nav.js`: one `NAV_LINKS` entry.
- `the-feed.html`, `burn-rate.html`: drop the `noindex` meta; add the
  back-link. `lens.html`: back-link in `.lens-foot`.
- `the-feed-BACKLOG.md` and `CLAUDE.md`: record the new state (Tools page,
  `/lens` row, indexing).

## Adding a fourth tool later

1. Build the page as standalone HTML, add its passthrough + `_redirects`
   pair as usual.
2. Add `tool-index/<slug>.md` with the front matter above.

Nothing else changes: index, homepage teaser, sitemap all read the
collection.

## Out of scope

- Per-tool OG images on the index cards (text cards only).
- Filtering or categories on `/tools` (three items; revisit past six).
- Any change to the privacy policy — no new forms or scripts.

## Note on the directory name

The collection lives in `tool-index/`, not `tools/`, because `tools/` is
already the repo's scripts folder (`the-feed-sim.js`, `the-feed-test.js`,
`build-speaker-kit.py`, OG-image sources).
