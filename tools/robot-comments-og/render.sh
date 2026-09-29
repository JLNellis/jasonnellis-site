#!/bin/sh
# Renders the default card and the six archetype cards to the repo root.
# Needs Google Chrome and python3 with Pillow. Rerun after any copy change.
set -e
cd "$(dirname "$0")/../.."
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="${TMPDIR:-/tmp}"
for a in default pod-casualty ghost generalist broadcaster fingerprinted-founder control-group; do
  out="og-robot-comments-$a.jpg"
  [ "$a" = default ] && out="og-robot-comments.jpg"
  "$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1200,630 \
    --virtual-time-budget=10000 --screenshot="$TMP/rc-og.png" "file://$PWD/tools/robot-comments-og/og.html?a=$a" >/dev/null 2>&1
  python3 -c "from PIL import Image; Image.open('$TMP/rc-og.png').convert('RGB').resize((1200,630), Image.LANCZOS).save('$out','JPEG',quality=88,progressive=True,optimize=True)"
  echo "wrote $out"
done
