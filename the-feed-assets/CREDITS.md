# The Feed — asset credits

*A content-creator life sim at [jasonnellis.com/the-feed](https://jasonnellis.com/the-feed).*

All third-party assets below are used under licenses that permit commercial
use. CC0 requires no attribution; it is credited here anyway as good practice.

---

## Sound effects

- **Kenney — Interface Sounds** — [kenney.nl/assets/interface-sounds](https://kenney.nl/assets/interface-sounds)
  License: **CC0 1.0 Universal** (public domain, no attribution required).
  A curated subset is used, renamed to game events and stored in
  `the-feed-assets/sfx/`:

  | In-game event            | File          | Kenney source            |
  |--------------------------|---------------|--------------------------|
  | UI click / pick          | `click.wav`   | `click_001`              |
  | Post published           | `post.wav`    | `pluck_001`              |
  | A post pops off (viral)  | `hit.wav`     | `confirmation_003`       |
  | Money in                 | `cash.wav`    | `pluck_002`              |
  | Channel levels up        | `level.wav`   | `maximize_003`           |
  | Bad / hostile event      | `bad.wav`     | `error_003`              |
  | An event appears         | `event.wav`   | `question_001`           |
  | Week resolves            | `week.wav`    | `scroll_002`             |
  | Winning ending           | `win.wav`     | `confirmation_002`       |
  | Losing ending            | `lose.wav`    | `bong_001`               |

  Sourced via the CC0 re-pack at
  [github.com/Calinou/kenney-interface-sounds](https://github.com/Calinou/kenney-interface-sounds).

## Typography

- **DM Sans** and **DM Mono** by Colophon Foundry / Jonny Pinhorn —
  **SIL Open Font License 1.1**. Self-hosted in `/fonts/` (site-wide via
  `colors_and_type.css`).
- **Space Grotesk** by Florian Karsten — **SIL OFL 1.1**. Loaded from Google
  Fonts; display face for headings and card titles.
- **Anton** by Vernon Adams — **SIL OFL 1.1**. Loaded from Google Fonts; used
  only for the big words inside the generated content-card thumbnails.

## Icons

- All in-game glyphs (nav, platforms, angles, niches, feed, endings) are a
  bespoke inline SVG sprite in `the-feed.html`. No emoji, no icon library.

---

*Game design, code, and the balance engine: Jason Nellis (with Claude Code).*
