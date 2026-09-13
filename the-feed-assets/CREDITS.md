# The Feed — asset credits

*A content-creator life sim at [jasonnellis.com/the-feed](https://jasonnellis.com/the-feed).*

All third-party assets below are used under licenses that permit commercial
use. CC0 requires no attribution; it is credited here anyway as good practice.

---

## Sound effects

- **Pixabay** — eight short cues, each under the
  [Pixabay Content License](https://pixabay.com/service/license-summary/)
  (free for commercial use, no attribution required; credited here anyway).
  Downloaded 2026-09-13, converted to mono MP3, trimmed and peak-normalised
  (`ffmpeg`), stored in `the-feed-assets/sfx/`. Two old cues share a file
  (`level` → `hit`, `week` → `post`; see `ALIAS` in the game's sound module).

  | In-game event                 | File        | Source (author)                                                                                                    |
  |-------------------------------|-------------|--------------------------------------------------------------------------------------------------------------------|
  | UI click / pick               | `click.mp3` | [UI Tap Soft Short](https://pixabay.com/sound-effects/film-special-effects-ui-tap-soft-short-514599/) (SoundShelfStudio) |
  | Post published · week resolves | `post.mp3`  | [Quick Air Swipe Sound](https://pixabay.com/sound-effects/film-special-effects-quick-air-swipe-sound-561932/) (biww)   |
  | An event appears              | `event.mp3` | [Soft Notification](https://pixabay.com/sound-effects/film-special-effects-soft-notification-124468/) (Universfield)   |
  | Money in                      | `cash.mp3`  | [Coin Drop](https://pixabay.com/sound-effects/film-special-effects-coin-drop-355977/) (KoiRoylers)                    |
  | A post pops off · level up    | `hit.mp3`   | [Positive Notification](https://pixabay.com/sound-effects/film-special-effects-positive-notification-351299/) (Universfield) |
  | Bad / hostile outcome         | `bad.mp3`   | [Error Notification](https://pixabay.com/sound-effects/film-special-effects-error-notification-352286/) (Universfield) |
  | Winning ending                | `win.mp3`   | [Victory Bell Success Fanfare](https://pixabay.com/sound-effects/musical-victory-bell-success-fanfare-576275/) (Emand_Edroff) |
  | Losing ending                 | `lose.mp3`  | [fail](https://pixabay.com/sound-effects/film-special-effects-fail-234710/) (u_8g40a9z0la)                            |

  The previous set (Kenney Interface Sounds, CC0) was removed in this pass.

## Illustrations

- **42 illustrations** — generated September 13, 2026 with OpenAI's
  image-generation tool, directed by Jason Nellis: the opening scene, three
  per niche (18), one per ending (8), five workspace/gear tiers, six
  portraits for the recurring feed handles, and four portraits for the
  hireable team (editor, manager, community mod, designer). Exact prompts, dimensions and
  checksums: `the-feed-assets/imgs/manifest.json`. PNG originals live in
  `the-feed-assets/the-feed-art-library-v2/` (not committed, not deployed);
  the game loads only the WebP derivatives in `the-feed-assets/imgs/`.
  Used for the start screen, the niche picker, the header backdrop, the
  ending screen, the desktop Setup card and feed avatars. Platform, action
  and status icons remain the bespoke SVG sprite.

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
