# Privacy policy page — design

**Date:** 2026-09-14
**Status:** approved by Jason, implemented in the same session

## Goal

Give jasonnellis.com a GDPR-compliant privacy policy that describes what the
site actually does, plus the short legal notice French law (LCEN art. 6-III)
expects. Zero ongoing maintenance beyond bumping the date when something
changes.

## Decisions (from Jason)

- **Controller:** Jason Nellis personally, contact by email only. No postal
  address published. LCEN lets a private individual withhold their address
  provided the host's details are given.
- **YouTube embeds:** switch every iframe to `youtube-nocookie.com` so no
  Google cookie is set until play. Avoids a consent banner.
- **Legal notice:** included as the last section of the same page, not a
  separate page.
- **The Feed fonts:** self-host Space Grotesk and Anton in `/fonts` so no
  page ships visitor IPs to Google Fonts on load. Keeps the policy clean.

## What the audit found

| Source | Provider | Notes |
|---|---|---|
| Analytics | Plausible (Estonia, data in DE) | Cookieless. Loaded from `nav.js`, inline on standalone pages. **No Google Analytics anywhere** despite the old CLAUDE.md section. |
| Contact form | Netlify Forms (US, DPF-certified) | Name, email, topic, message, event fields. |
| Email | ImprovMX (US entity, EU+US servers) → Google Workspace | Forwarding only. |
| Newsletter | Substack (US) | GET form posts straight to substack.com; nothing stored on site. Publisher is controller, Substack is processor. |
| Video | YouTube embeds ×6 (speaking, building-value) | Were plain `youtube.com`; now nocookie. |
| Fonts | Google Fonts CSS on The Feed only | Now self-hosted. |
| Browser storage | The Feed, Burn Rate localStorage | Game state, mute, unlock. Not personal data. |
| Hosting | Netlify, Inc., 101 2nd Street, San Francisco | Server logs. |

## Deliverable

### `privacy.html` at `/privacy`
Hand-authored, passthrough-copied, standard `<site-header>`/`<site-footer>`.
Narrow page-wrap, page-hero, an "In short" summary card, then eight numbered
sections: controller · what and why (per source, with purpose / legal basis /
where / retention) · processors table · transfers · retention table · rights
incl. CNIL and post-mortem directives · changes · legal notice.

Voice: first person, plain English, no legalese. Last-updated date lives in
the hero eyebrow only.

### Wiring
- `_redirects`: rewrite + 301 pair for `/privacy`.
- `.eleventy.js`: `addPassthroughCopy("privacy.html")`.
- `sitemap.njk`: add `/privacy`.
- `nav.js`: "Privacy & legal" link in `.site-footer__bottom` (not in
  `NAV_LINKS`, so it stays out of the header nav). `site.css` gets one rule
  so the bottom-bar link renders inline at 12px.
- `contact.html`: "Privacy" link in the form meta row, so the Art. 13 notice
  is reachable at the point of collection.

### Related code changes
- `speaking.html`, `building-value.html`: `youtube.com/embed/` →
  `youtube-nocookie.com/embed/`.
- `the-feed.html`: Google Fonts `<link>` replaced by local `@font-face`
  declarations; four woff2 files added to `/fonts` (Space Grotesk variable
  covers 500–700 in one file per subset).
- `CLAUDE.md`: Google Analytics section replaced by the Plausible reality;
  privacy page added to the pages table; nocookie + no-CDN-fonts conventions
  recorded.

## Out of scope
- Cookie consent banner (not needed: nothing sets a cookie before user action).
- Separate French-language version.
- Automating retention (the three-year rule is a policy statement; deletion is
  manual).
