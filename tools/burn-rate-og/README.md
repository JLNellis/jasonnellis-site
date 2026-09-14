# Burn Rate — social share card

One HTML card rendered to JPG for link previews. Uses Google Fonts (DM Sans / DM Mono), no dev server needed. Regenerate after any copy change:

    CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 --virtual-time-budget=10000 --screenshot=/tmp/br2x.png "file://$PWD/tools/burn-rate-og/og-1200x630.html"
    python3 -c "from PIL import Image; Image.open('/tmp/br2x.png').convert('RGB').resize((1200,630), Image.LANCZOS).save('og-burn-rate.jpg','JPEG',quality=88,progressive=True,optimize=True)"

Output: `og-burn-rate.jpg` at the repo root (Open Graph / Twitter, referenced from `burn-rate.html`'s head; passthrough-copied in `.eleventy.js`).
