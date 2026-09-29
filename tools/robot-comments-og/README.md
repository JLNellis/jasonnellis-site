# 80% of Your Comments Are Robots: share cards

`og.html` renders one 1200x630 card: `?a=default` (game title + tagline) or `?a=<archetype slug>`
(game title, archetype name, tagline). Every card carries the title's Invented stamp. Text comes from
`robot-comments-copy.js`, so rerun after any copy change:

    tools/robot-comments-og/render.sh

Writes `og-robot-comments.jpg` (the game page, the evidence page) and `og-robot-comments-<slug>.jpg`
(the share pages at `/robot-comments/r/<slug>/`) at the repo root. They are passthrough-copied by
the `og-robot-comments*.jpg` glob in `.eleventy.js`.
