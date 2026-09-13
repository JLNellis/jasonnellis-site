# The Feed — social share cards

Two HTML cards rendered to JPG for link previews. Regenerate after any copy or
art change (the art is pulled from the running dev server, so `npm run serve`
first):

    CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 --virtual-time-budget=10000 --screenshot=/tmp/og2x.png "file://$PWD/tools/the-feed-og/og-1200x630.html"
    "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1080,1080 --virtual-time-budget=10000 --screenshot=/tmp/sq2x.png "file://$PWD/tools/the-feed-og/square-1080.html"

then downsample to 1200×630 / 1080×1080 and save as progressive JPG (q88):
`the-feed-assets/imgs/og-the-feed.jpg` (Open Graph / Twitter, referenced from
`the-feed.html`'s head) and `the-feed-assets/imgs/og-the-feed-square.jpg`
(square, for LinkedIn/Instagram posts — not referenced by the page).
