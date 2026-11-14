#!/usr/bin/env bash
# Captures the Chrome Web Store images into store/images from the playground's store pages.
# Start the playground first (pnpm playground), then run: bash scripts/store/capture.sh
# Pages are rendered at 2x and scaled down, which keeps small text sharp at the store's exact sizes.
set -euo pipefail
cd "$(dirname "$0")/../.."

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
BASE="${BASE:-http://localhost:5178}"
OUT=store/images
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT"

# shot NAME URL WIDTH HEIGHT [transparent]
shot() {
  local name=$1 url=$2 w=$3 h=$4 transparent=${5:-}
  local bg=()
  [ -n "$transparent" ] && bg=(--default-background-color=00000000)
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
    --user-data-dir="$WORK/profile" --force-device-scale-factor=2 --window-size="$w,$h" \
    --virtual-time-budget=5000 ${bg[@]+"${bg[@]}"} --screenshot="$WORK/$name.png" "$url" >/dev/null 2>&1
  if [ -n "$transparent" ]; then
    sips -z "$h" "$w" "$WORK/$name.png" --out "$OUT/$name.png" >/dev/null
  else
    # The store wants opaque images: go through JPEG at full quality to drop the alpha channel.
    sips -z "$h" "$w" -s format jpeg -s formatOptions 100 "$WORK/$name.png" --out "$WORK/$name.jpg" >/dev/null
    sips -s format png "$WORK/$name.jpg" --out "$OUT/$name.png" >/dev/null
  fi
  echo "$OUT/$name.png"
}

shot screenshot-1-dictionary "$BASE/store/shots.html#dictionary" 1280 800
shot screenshot-2-translation "$BASE/store/shots.html#translation" 1280 800
shot screenshot-3-summary "$BASE/store/shots.html#summary" 1280 800
shot screenshot-4-my-words "$BASE/store/words.html" 1280 800
shot screenshot-5-settings "$BASE/settings.html" 1280 800
shot promo-small "$BASE/store/promo.html#tile" 440 280
shot store-icon "$BASE/store/promo.html#icon" 128 128 transparent
