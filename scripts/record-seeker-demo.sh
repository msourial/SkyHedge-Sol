#!/bin/zsh
# One-command Seeker mirror recording for the Encode demo.
# Stops at 170s or when you press Ctrl+C. Does not tap the phone and does not sign.
# Output: ~/Documents/Codex/demo-assets/seeker-raw.mp4
set -euo pipefail

SERIAL="${SKYHEDGE_SERIAL:-SM02G406197714}"
SCRCPY="${SCRCPY:-$HOME/Documents/Codex/tools/scrcpy/scrcpy-macos-aarch64-v5.0.1/scrcpy}"
OUT="${SKYHEDGE_DEMO_RAW:-$HOME/Documents/Codex/demo-assets/seeker-raw.mp4}"

if [[ ! -x "$SCRCPY" ]]; then
  echo "scrcpy not executable: $SCRCPY" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"
if [[ -e "$OUT" ]]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  backup="${OUT%.mp4}.$stamp.mp4"
  mv "$OUT" "$backup"
  echo "Moved previous recording to $backup"
fi

echo "Recording $SERIAL to $OUT"
echo "Start on https://skyhedge.app in the Seeker browser. Ctrl+C when the wallet beat ends."
echo "Do not approve Phantom until this window is recording."

exec "$SCRCPY" \
  --serial "$SERIAL" \
  --window-title "Seeker" \
  --max-size 1080 \
  --stay-awake \
  --no-audio \
  --time-limit 170 \
  --record "$OUT"
