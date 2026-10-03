# Site-wide share card

`og-image.png` at the repo root is the default Open Graph / Twitter image for the
homepage, /about, /blog, /contact, /experiments, /privacy and every essay. Its
source is `og.html` here. Regenerate after any change to the name line or label:

    CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 --virtual-time-budget=10000 --screenshot=og-image.png "file://$PWD/tools/site-og/og.html"

Output is 2400x1260 PNG. Google Fonts load at render time only; nothing ships to the site.
