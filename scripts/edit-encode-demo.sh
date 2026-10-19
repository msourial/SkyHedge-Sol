#!/bin/zsh
# Combine the Seeker recording, optional voiceover, and 3s title/end cards.
# Does nothing until ~/Documents/Codex/demo-assets/seeker-raw.mp4 exists.
# Output: ~/Documents/Codex/demo-assets/skyhedge-encode-demo.mp4 (1080x1920, under 3 min).
set -euo pipefail

ROOT="${SKYHEDGE_DEMO_ASSETS:-$HOME/Documents/Codex/demo-assets}"
RAW="${SKYHEDGE_DEMO_RAW:-$ROOT/seeker-raw.mp4}"
VO="${SKYHEDGE_DEMO_VO:-$ROOT/audio/voiceover.m4a}"
TITLE="$ROOT/cards/title.png"
END="$ROOT/cards/end.png"
OUT="$ROOT/skyhedge-encode-demo.mp4"
FONT="${SKYHEDGE_DEMO_FONT:-/System/Library/Fonts/Supplemental/Georgia.ttf}"

if [[ ! -f "$RAW" ]]; then
  echo "No Seeker recording yet: $RAW" >&2
  echo "Record first: scripts/record-seeker-demo.sh" >&2
  exit 1
fi
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is not installed. Install it, then rerun this script:" >&2
  echo "  brew install ffmpeg" >&2
  exit 1
fi
for card in "$TITLE" "$END"; do
  if [[ ! -f "$card" ]]; then
    echo "Missing card: $card" >&2
    exit 1
  fi
done

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# Portrait 1080p. Phone footage is scaled to fit, never stretched.
ffmpeg -y -i "$RAW" -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0B1220,fps=30,format=yuv420p" -an -c:v libx264 -pix_fmt yuv420p "$workdir/phone.mp4"
ffmpeg -y -loop 1 -i "$TITLE" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -t 3 -vf "scale=1080:1920,fps=30,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$workdir/title.mp4"
ffmpeg -y -loop 1 -i "$END" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -t 3 -vf "scale=1080:1920,fps=30,format=yuv420p" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$workdir/end.mp4"
ffmpeg -y -i "$workdir/phone.mp4" -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 -c:v copy -c:a aac -shortest "$workdir/phone-a.mp4"

printf "file '%s'\nfile '%s'\nfile '%s'\n" "$workdir/title.mp4" "$workdir/phone-a.mp4" "$workdir/end.mp4" > "$workdir/list.txt"
ffmpeg -y -f concat -safe 0 -i "$workdir/list.txt" -c copy "$workdir/silent.mp4"

duration="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$workdir/silent.mp4")"
python3 - "$duration" <<'PY'
import sys
seconds = float(sys.argv[1])
if seconds > 180:
    raise SystemExit(f"Cut is {seconds:.1f}s. Trim the Seeker recording so the edit stays under 3 minutes.")
print(f"Duration {seconds:.1f}s")
PY

if [[ -f "$VO" ]]; then
  ffmpeg -y -i "$workdir/silent.mp4" -i "$VO" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest "$OUT"
else
  cp "$workdir/silent.mp4" "$OUT"
  echo "No voiceover at $VO — video is silent. Put an m4a or wav there and rerun." >&2
  echo "Narration text: $ROOT/audio/voiceover.txt" >&2
fi

echo "Wrote $OUT"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
