# The Feed — laptop console: channels into the rail

**Date:** 2026-09-14 · **Scope:** `the-feed.html` chrome only (CSS + one DOM
move). Engine, sim, tests, mobile layout untouched.

## Problem

Playtest on a laptop-sized screen (viewport ≈ 1440×790): the full-width
"Your Channels" strip sat between the header and the three console columns.
Measured: header 226px + strip 272px = 498px before the decision column
started, leaving it 253px tall (93px of that the sticky End-the-week footer)
for ~1,220px of content. On week 1 the content cards were entirely below the
fold — the tester didn't know what action to take, called the strip wasted
space (one card, 900px empty), and said the "bottom-left panel" was too small
to be the primary surface. Three complaints, one cause.

## Design

At ≥980px the channel strip becomes the **top of the right rail**, above the
Setup/Team panel; the rail scrolls as one column. The workspace and feed
columns start directly under the header (grid is now a single row).

- Channel cards keep their platform-artifact format, stacked vertically at
  the rail's inner width (~268px) with a 12px gap. "Your Channels" header
  line + "N active" hint unchanged.
- Setup/Team panel unchanged, now below the channels. Not duplicated into
  the header (rejected: clutter in the one area already tight).
- The strip node is moved with JS (`placeStrip()`) on load and on the 980px
  breakpoint change: wide → prepended to `.rail`; narrow → restored before
  `#tab-home`. Below 980px the DOM order and CSS are exactly as before.

## Success

At 1440×790 the week-1 prompt and the first row of content thumbnails are
visible on load above the sticky End-the-week button; workspace height
roughly doubles (253 → ~525px). Mobile 375px unchanged. Engine tests pass.
