# Design backlog

Fixes from the full-site design review of 2026-10-24 (`/impeccable critique`,
scored 25/40). Listed in the order to do them. Each item names the skill
command to run it with. Tick an item when it ships, and delete it once the
change has been live for a while.

Constraints for every item: keep the navy and single green accent (the
"refine, don't replace" decision of 2026-10-24); follow CLAUDE.md (no prices,
no eyebrows, no em dashes in new copy, privacy stays literally true); and add
no new figure or claim without Jason's approval.

*(Not built by Eleventy; listed in `.eleventyignore`.)*

---

## Done

- [x] **Contact page script crash** (P0). An unescaped apostrophe killed
  `contact.html`'s inline script, which disabled the prefill, the topic toggle,
  the clocks and the AJAX submit. Fixed in `72aa977`, which also added a build
  check that fails the deploy on any inline script syntax error.
- [x] **Item 1, YouTube click-to-load** (2026-10-24). All six embeds on
  `/speaking` and `/building-value` are now `.yt-facade` posters that nav.js
  swaps for the player on click. `/privacy` wording and date updated.

---

## 1. Make /privacy literally true about YouTube (P1)

**Why first:** the policy is currently wrong, which is a bigger problem than a
weak design. `privacy.html:89` and `:138` say nothing loads from Google until
you press play. In fact the `youtube-nocookie.com` iframes on `/speaking` and
`/building-value` fetch the player and thumbnails as soon as they scroll into
view.

**Fix:** use a click-to-load facade. Show a self-hosted poster and a play
button, and inject the iframe only on click. This also removes the off-brand
YouTube thumbnails (the "Hulu's First PM" card currently shows a thumbnail
for "Why Amazon's Buy Button Is Orange"). Then re-read both policy lines and
bump the `.policy-updated` date.

**Files:** `speaking.html` (lines ~500, ~510), `building-value.html` (4
embeds), `privacy.html`, plus a few lines of shared JS and CSS.

**Run:** `/impeccable harden speaking.html building-value.html`

---

## 2. Rebuild the About career log as a readable ledger (P1)

**Why:** visitors check the dates and titles against LinkedIn, and right now
the log hides exactly that. Entries are collapsed by default, with previews
cut off mid-sentence. The company name is the smallest text on each row (11px
gray mono). Dates are years only, and some rows merge employers (Jogg with
SuperBam; PBS with the agency and Vizio).

**Fix:** show every entry open, one row per employer. Each row gets the
company as its heading, then the title, then Mon YYYY–Mon YYYY dates matching
the CLAUDE.md résumé dates and LinkedIn, then one outcome line. The narrative
paragraphs become optional detail under each row. Also drop "Click an entry to
expand" and the amber and blue timeline dots (single accent rule). Check that
the "Career log." h2 reads as a heading, not a gray side label.

**Files:** `bio.html`.

**Run:** `/impeccable layout bio.html`, then `/impeccable typeset bio.html`

---

## 3. Homepage: lead with the current role (P1)

**Why:** the green "active" act card is SuperBam, which ended in April 2026.
BoltOS sits in a loose paragraph under the cards, and 2012–2017 isn't
mentioned. The four experiment cards take up more room than speaking and
advisory combined, and the fourth card sits alone on a row in the 3-column
grid.

**Fix:** make BoltOS the first, highlighted "Now" card. Add a line that
covers 2012–2017. Shrink the experiments teaser (one row, or a compact list).
Point the primary "Read the case studies" CTA straight at the first case study
instead of `/blog#case-study`, where the podcast banner comes first.

**Files:** `index.njk`, `site.css`.

**Run:** `/impeccable layout index.njk`

**Needs Jason (see "Decisions only Jason can make"):** the "2 companies built
and sold" stat.

---

## 4. Shared header, footer and contact topics (P2)

**Why:** these ship on every page and currently undercut the positioning.

- **Footer line:** "Product strategy for media and creator businesses"
  (`nav.js:145`) is the strategist framing CLAUDE.md rules out. Replace it with
  the executive title.
- **"Currently active · {month}" pill** (`nav.js:128`, `:146`): it shows the
  visitor's own month, so it isn't a real freshness signal. Remove it, along
  with its pulsing dot.
- **`NAV_LINKS` order:** the order puts About last ("audience-building work
  first"). Reorder to About, Speaking, Writing, Podcast, Experiments,
  Advisory, and update the comment.
- **Active nav state:** `activePage()` only matches exact paths, so talk pages
  and essays highlight nothing. Match on the path prefix (`/speaking/…` →
  Speaking, `/blog/…` → Writing).
- **Contact topics** (`contact.html`): add a topic for full-time roles (the
  advisory page already mentions full-time work).
  Rename the `budget` select and drop "Speaking honorarium" from it, in line
  with the no-prices rule.

**Files:** `nav.js`, `contact.html`, `CLAUDE.md` (the nav paragraph).

**Run:** `/impeccable clarify nav.js contact.html`

---

## 5. Speaker proof: show Jason in every first frame (P1)

**Why:** the featured reel poster (`reel-super-2022.jpg`, on `/speaking` and
`/press-kit`) shows a guest captioned "Chris", not Jason. Both Austin Evans
posters are title cards. Talk pages have no image at all. And format durations
vanish on mobile (`speaking.html:305` hides `.format-row .pill`).

**Fix:**
- Pull new poster frames with Jason's face (ffmpeg from the masters in
  `/videos`).
- Put a stage photo (from the IFA, Latitude59 or ZEST frames) at the top of
  each talk page via `_includes/talk-layout.njk`.
- Show durations on mobile.
- Convert the talk-title Title Case to sentence case.
- Add WebVTT captions to the three self-hosted videos. This is a WCAG 1.2.2
  failure today, and bookers often watch muted. It needs transcripts, so it may
  have to wait on Jason.

**Files:** `speaking.html`, `press-kit.html`, `_includes/talk-layout.njk`,
`talks/*.md`, new poster `.jpg`s plus passthrough entries in `.eleventy.js`.

**Run:** `/impeccable polish speaking.html`, then
`/impeccable polish _includes/talk-layout.njk`

---

## 6. Keyboard, screen-reader and touch fixes (P2)

**Why:** the basics are good (skip link, alt text, AA contrast on the main
pages), but there are gaps:

- No `:focus-visible` styles anywhere in `site.css`; links and buttons rely on
  each browser's default ring. Add one designed ring in the accent colour.
- The closed mobile menu (`.site-nav`, `max-height: 0`) leaves 7 invisible
  links in the tab order. Add `visibility: hidden` when closed, and close the
  menu on Escape.
- Contact placeholders use the browser default #757575, which is 3.4–3.9:1
  against the backgrounds. Add a `::placeholder` rule using `--fg-3`.
- Heading levels skip: the footer column h4s on every page (from `nav.js`),
  H1 straight to H3 in essays and case studies, the `/experiments` cards, and
  the press-kit one-pager.
- Tap targets below 24px on mobile: `.bolt` arrow links (20–28px),
  `.talk-title-link`, hero "LinkedIn ↗" (19px), footer "Privacy & legal"
  (20px), contact FAQ summaries (29px). The nav toggle is 36px.
- Functional text under 11px: the 9px "Building Value" on
  `building-value.html:88`, and the 10px "Open", "My local time" and "Yours"
  on contact.
- Add `aria-hidden="true"` to decorative inline SVGs (2–8 per page).

**Files:** `site.css`, `nav.js`, `contact.html`, `building-value.html`,
`_includes/essay-layout.njk`, `tools.njk`, `press-kit.html`.

**Run:** `/impeccable harden site.css nav.js`, then `/impeccable adapt` on the
mobile pass

---

## 7. Quiet the dashboard tics (P2)

**Why:** the "Bolt OS" system came from a product UI. Keeping the palette is
decided; these habits are what make the site look like a dark SaaS template:

- **Uppercase mono labels**, which are retired eyebrows under another name:
  - KEYNOTE / MODERATOR / MC on `/speaking`
  - GAME / CALCULATOR on the tool cards
  - STRATEGY / CASE STUDY on the writing rows
  - WRITING / SPEAKING / ADVISORY on About
  - ABOUT / TALKS in the press-kit one-pager
  - the `.kind` labels on `burn-rate.html:317` and `lens.html:167`
- **The green second clause** in six H1s. Keep it on one page, at most.
- **The blinking terminal cursor** (`.term-cursor`) at the end of essays.
- **Thick green left borders**: `.proof-strip` (`index.njk:71`), `.mod-callout`
  (`speaking.html:213`), `.toast` (`contact.html:92`).
- **Repeated stat bands**: keep the one that carries the page, and cut the
  rest.

**Files:** `site.css`, `speaking.html`, `index.njk`, `bio.html`,
`press-kit.html`, `blog.njk`, `tools.njk`, `lens.html`, `burn-rate.html`,
`_includes/essay-layout.njk`.

**Run:** `/impeccable quieter`, page by page (start with `speaking.html`)

---

## 8. Press kit: actions at the top (P2)

**Why:** the PDF download sits at the bottom of a 6,600px page (8,300px on
mobile). The hero is a wide panel shot where Jason is hard to pick out. The
forwarded one-pager says "via the contact form" and gives no email.

**Fix:**
- Add a top action bar: download the PDF, email, jump links to bios,
  headshots, MC script and AV.
- Add copy buttons on the bios and the MC script.
- Use a hero crop where Jason is clearly the subject.
- Put `hello@jasonnellis.com` on the one-pager, then rerun
  `tools/build-speaker-kit.py`.

**Files:** `press-kit.html`, `tools/build-speaker-kit.py`,
`jason-nellis-speaker-kit.pdf` (regenerated, never hand-edited).

**Run:** `/impeccable layout press-kit.html`

---

## 9. One portrait set (P2)

**Why:** there are three different hero portraits: seated on the homepage,
stage on About, and a phone-style shot on `/blog`, which is the weakest image
on the site. The press-kit stage headshot looks soft.

**Fix:** derive one consistent set of crops from the IFA masters
(`confheadshot.jpg`, `confpanel.jpg`), sized for each slot, and swap the
`/blog` portrait first.

**Files:** `index.njk`, `blog.njk`, `press-kit.html`, new crops plus
`.eleventy.js` passthrough entries.

**Run:** `/impeccable polish blog.njk`

**Needs Jason:** the SuperBam and Hulu case-study images (see below).

---

## 10. Copy consistency sweep (P3)

- **Advisory:** "Text me… inside 24 hours" (`advisory.html:295`), but there
  is no number on the site and the closing CTA says 48 hours (`:333`). Jason
  decides the wording.
- **Dates:** at least five formats across home, blog, About, essays and the
  timeline (including the `dotDate` filter's "2026 · 09 · 29"). Pick one.
- **Case studies:** Title Case H3s ("What Shipped") and a third-person sign-off
  ("This case study informs how Jason talks…").
- **Building Value:** described as "creator conversations" in the talk pages
  and kit, and "operators, founders and creators" elsewhere.
- **Older essays:** em dashes and "not X, Y" constructions. Leave the original
  LinkedIn wording unless Jason wants them modernised.
- **Essays end on a dead end:** add a next-essay link above the podcast form.
- **Blog filter:** 8 chips for 11 essays. Cut it to the 3 or 4 categories
  that hold more than one post.

**Run:** `/impeccable clarify` (copy), `/impeccable distill blog.njk` (filter)

---

## 11. Image weight (P3)

The homepage carries 571KB of images: `building-value-header.jpg` (342KB),
`jason-headshot.jpg` (229KB). Also `jason-nellis-stage-portrait.jpg` (327KB) on
About and `jason-headshot-blog.jpg` (249KB) on `/blog`. Resize to the
rendered size × 2 and add WebP versions (`cwebp` is installed).

**Run:** `/impeccable optimize`

---

## 12. Final pass

Once the above has shipped, run `/impeccable polish` across the main pages,
then `/impeccable critique` again to compare against the 25/40 baseline.

---

## Decisions only Jason can make

These are tracked on the Now List as well. Each one blocks part of an item
above.

1. **`superbam.jpg`** (SuperBam case study): keep it, or replace it with a
   different photo or a typographic card. Blocks item 9.
2. **"2 companies built and sold"** on the homepage: keep it as is, or reword
   it. Blocks item 3.
3. **Advisory copy:** "I'm not here to fix your culture" and "My job isn't to
   rally your team" sit awkwardly next to the teams-and-consensus positioning.
   They're Jason's words, so it's his call. Blocks item 10.
4. **Hulu case-study hero:** it's a Hulu ad featuring Alec Baldwin. Confirm the
   rights or replace it. Blocks item 9.
5. **Video transcripts** for the captions in item 5.

Not on this list, on purpose: on-stage keynote footage, logos and further
testimonials. Those live in `ASSETS-BACKLOG.md`.
