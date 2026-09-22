# The Lens — social share card

One HTML card rendered to JPG for `/lens` link previews. Self-contained (no
running server needed). Regenerate after any copy change:

    CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 --virtual-time-budget=10000 --screenshot=/tmp/lens2x.png "file://$PWD/tools/lens-og/og-1200x630.html"

then downsample to 1200×630 and save as JPG (q88) at the repo root as
`og-lens.jpg` (referenced from `lens.html`'s head, passthrough-copied in
`.eleventy.js`):

    sips -s format jpeg -s formatOptions 88 -z 630 1200 /tmp/lens2x.png --out og-lens.jpg
