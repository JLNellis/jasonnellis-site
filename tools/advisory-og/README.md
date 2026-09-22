# Advisory — social share card

One HTML card rendered to JPG for link previews of `/advisory`. Same recipe as `tools/burn-rate-og/`: uses Google Fonts at build time only (nothing ships to the site), no dev server and no Python deps needed (`sips` is built into macOS). Regenerate after any copy or stat change on the page:

    CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 --virtual-time-budget=10000 --screenshot=/tmp/adv2x.png "file://$PWD/tools/advisory-og/og-1200x630.html"
    sips -z 630 1200 /tmp/adv2x.png -s format jpeg -s formatOptions 88 --out og-advisory.jpg

Output: `og-advisory.jpg` at the repo root (Open Graph / Twitter, referenced from `advisory.html`'s head; passthrough-copied in `.eleventy.js`).

The right-hand panel repeats the three stats from the page's proof band with their company attribution. If a stat changes on `/advisory`, change it here too.
