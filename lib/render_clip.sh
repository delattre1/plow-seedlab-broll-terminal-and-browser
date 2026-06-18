#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# render_clip.sh — asciinema .cast -> TRUE 16:9 (1920x1080) mp4, content-fills.
#
#   render_clip.sh <in.cast> <out.mp4> [START] [DURATION]
#
# START/DURATION (seconds, optional) render only a RANGE of the cast, e.g.
#   render_clip.sh demo.cast clip.mp4 4 12     # 12s starting at t=4s
#
# The scale-to-FILL step is the whole point: the cast is rendered by agg at a
# geometry that is already ~16:9 (e.g. 151x36 @ font-size 21 -> 1927x1087), then
# scaled to COVER 1920x1080 and cropped a hair. NO padding, NO pillarbox — the
# terminal content reaches all four edges. Final encode = Apple h264_videotoolbox.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
IN="$1"; OUT="$2"; START="${3:-}"; DURATION="${4:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

FONTDIR="${FONTDIR:-$ROOT/fonts}"
FONTFAMILY="${FONTFAMILY:-JetBrainsMono Nerd Font Mono}"
FONT_SIZE="${FONT_SIZE:-21}"
IDLE_LIMIT="${IDLE_LIMIT:-2}"
FPS="${FPS:-30}"
ENCODER="${ENCODER:-h264_videotoolbox}"   # Rule 6: Apple HW encode (never libx264).
BITRATE="${BITRATE:-8M}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1) Normalize TUI codepoints no monospace font covers (spinner/box-drawing/etc).
python3 "$HERE/normalize_glyphs.py" "$IN" "$TMP/fixed.cast"

# 2) Render to gif with the bundled Nerd Font. agg's native output is already
#    ~16:9 when COLS/ROWS/FONT_SIZE are chosen per SEED.md (e.g. 1927x1087).
agg --font-dir "$FONTDIR" --font-family "$FONTFAMILY" \
    --idle-time-limit "$IDLE_LIMIT" --font-size "$FONT_SIZE" --fps-cap "$FPS" \
    "$TMP/fixed.cast" "$TMP/out.gif"
echo "  native agg dims: $(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height -of csv=p=0 "$TMP/out.gif")"

# 3) Optional range trim.
TRIM=()
[ -n "$START" ]    && TRIM+=(-ss "$START")
[ -n "$DURATION" ] && TRIM+=(-t "$DURATION")

# 4) gif -> H.264, scale-to-FILL exactly 1920x1080 (cover + crop), HW encode.
#    force_original_aspect_ratio=increase => the image COVERS 1920x1080 (>=),
#    then crop trims the few overflow px. Result: zero bars, edge-to-edge content.
ffmpeg -y "${TRIM[@]}" -i "$TMP/out.gif" -movflags +faststart -pix_fmt yuv420p \
    -vf "fps=$FPS,scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1" \
    -c:v "$ENCODER" -b:v "$BITRATE" "$OUT"

echo "  rendered ($ENCODER): $OUT"
