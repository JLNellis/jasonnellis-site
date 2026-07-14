---
name: new-essay
description: Use when adding a new essay to the jasonnellis-site writing archive — publishing a draft, turning a LinkedIn post into a permanent essay page, or growing the /blog collection.
---

# New Essay

## Overview

Essays are Eleventy-generated from `essays/*.md`. This skill states the exact
conventions so you don't have to re-derive them by reading all six existing
essays and the templates from scratch each time.

## Steps

1. **Pick a slug** — kebab-case, becomes both the filename and the URL
   (`essays/<slug>.md` → `/blog/<slug>/`, via `essays/essays.json`'s
   permalink). Treat it as permanent once published — an indexed URL
   shouldn't move. Derive it from the title.

2. **Front matter** (all required except `originalDate`/`originalUrl`):

   | Field | Type | Notes |
   |---|---|---|
   | `title` | quoted string | Short, declarative — matches existing titles' punchy one-liner style |
   | `description` | quoted string | One sentence, used for meta/OG/JSON-LD |
   | `date` | **unquoted** YAML date (`2025-02-10`) | Must be a real date literal, not a string — the `readableDate`/`monthYear`/`isoDate` filters break otherwise. For a LinkedIn repost, use the original post's date. For fresh content, use today. |
   | `category` | quoted string | **Reuse one of the existing six** — `Creator Economy`, `Strategy`, `Product`, `Leadership`, `Reflection`, `Life`. Don't invent a new one: `blog.njk`'s filter chips are hardcoded HTML, not derived from the collection — a novel category is unreachable from the filter bar (visible under "All" only). If nothing fits, pick the closest existing category, or flag it to Jason and update the filter chips in `blog.njk` together. |
   | `readTime` | quoted string, e.g. `"5 min"` | word count ÷ 50, rounded (verified against all six existing essays — they run a slow, reflective ~50 wpm, not a skim-reading ~200 wpm) |
   | `originalDate` | quoted string, e.g. `"Feb 2025"` | LinkedIn reposts only — omit entirely for content written directly for the site |
   | `originalUrl` | quoted string | LinkedIn reposts only — omit entirely otherwise. The footnote in `_includes/essay-layout.njk` is conditional on this field, so omitting it cleanly drops the "Originally published on LinkedIn" line instead of rendering broken |

3. **Body** — plain Markdown paragraphs. Conventions from the existing six:
   - Exactly **one** blockquote (`> `) — the single sharpest line. Don't
     reuse a sentence that already appears in prose elsewhere in the piece.
   - **At most one** `### ` subheading, only if the piece has a clear
     two-beat shape (specific anecdote → general claim). About half of
     existing essays have no subheading at all — don't force one.

4. **Verify before reporting done** — run `npm run build` (or `npx
   @11ty/eleventy`), confirm the new file writes to
   `_site/blog/<slug>/index.html` with no errors, and that the essay shows
   up in `_site/sitemap.xml`.

5. **Don't commit or push without asking.** Draft the file, verify the
   build, show Jason the result, wait for confirmation. The newest `date`
   becomes the `/blog` featured post automatically — no manual flag needed.

## If a change to `_includes/essay-layout.njk` or `blog.njk` seems needed

Those templates are shared across every essay, past and future. Don't edit
them silently as a side effect of writing one essay's content — flag the
specific need to Jason first (what needs to change and why), since a
template edit has a different blast radius than adding one content file.

## Common mistakes

- Quoting `date` as a string instead of a bare YAML date literal — breaks
  the date filters.
- Inventing a category not in the filter-chip list — makes the essay
  unfilterable.
- Fabricating a LinkedIn URL for content that didn't originate there —
  omit `originalDate`/`originalUrl` instead.
- Reusing the same sentence for both body prose and the pull-quote — pick
  or tighten a line that's distinct from the surrounding text.
- Skipping the local build check — a bad front-matter field fails the
  whole Eleventy build; catch that before pushing, not after a broken
  Netlify deploy.
