#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# record-terminal-broll.sh — produce a TRUE 16:9 (1920x1080) terminal B-roll.
#
# This is the EXACT method that produced the CEO-approved clip. It:
#   1. Boots a fresh tmux server so your ~/.tmux.conf is sourced (Dracula theme,
#      base-index 1, status-bar plugins, seedlab block, etc.).
#   2. Creates a WIDE session whose grid renders ~16:9 natively (no pillarbox):
#      cols=151 rows=36 with agg --font-size 21 => agg renders 1927x1087 px,
#      i.e. the text grid itself is 16:9 and the content reaches all 4 edges.
#   3. Records the live PTY with asciinema (genuine capture, not rendered HTML).
#   4. Renders the cast with agg (bundled Nerd Font) and encodes with ffmpeg,
#      scaling to FILL exactly 1920x1080 (cover + hair crop) — NO pad, NO bars.
#   5. Final encode uses Apple h264_videotoolbox (Rule 6: HW encode, never x264).
#
# One command:  ./record-terminal-broll.sh
# Custom file:  SEED_FILE=~/notes.md ./record-terminal-broll.sh
# Custom out:   OUT=clip.mp4 ./record-terminal-broll.sh
#
# Why these numbers? See SEED.md §"Geometry math" — they come from agg's fitted
# cell model (cell_w≈0.6002*fontsize, cell_h≈1.405*fontsize for JetBrainsMono NF
# Mono). Change font/size and recompute cols/rows there.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
HERE="$(cd "$(dirname "$0")" && pwd)"

# ── Geometry (the approved 16:9 recipe) ──────────────────────────────────────
COLS=${COLS:-151}            # wide enough that the grid is 16:9 at FONT_SIZE
ROWS=${ROWS:-36}
FONT_SIZE=${FONT_SIZE:-21}   # agg render size; pairs with COLS/ROWS -> 1927x1087
FONTDIR=${FONTDIR:-$HERE/fonts}
FONTFAMILY=${FONTFAMILY:-JetBrainsMono Nerd Font Mono}

# ── Output / encode ──────────────────────────────────────────────────────────
OUT=${OUT:-$HERE/out/terminal-broll.mp4}
BITRATE=${BITRATE:-8M}
ENCODER=${ENCODER:-h264_videotoolbox}   # Rule 6: Apple HW. Override for non-Mac.
FPS=${FPS:-30}
IDLE_LIMIT=${IDLE_LIMIT:-2}

# ── Content drive (the script typed into the live tmux pane) ──────────────────
DRIVE=${DRIVE:-$HERE/drive/seed-walkthrough.sh}
# Default file shown on screen; the bundled sample, override with any path.
export SEED_FILE=${SEED_FILE:-$HERE/examples/sample.seed.md}

SOCK=${SOCK:-brollrec}
SESSION=${SESSION:-seedlab}
CAST=${CAST:-${OUT%.mp4}.cast}
mkdir -p "$(dirname "$OUT")"

export BROLL_SOCK="$SOCK" BROLL_SESSION="$SESSION"

command -v tmux      >/dev/null || { echo "need tmux";      exit 1; }
command -v asciinema >/dev/null || { echo "need asciinema"; exit 1; }
command -v agg       >/dev/null || { echo "need agg";       exit 1; }
command -v ffmpeg    >/dev/null || { echo "need ffmpeg";    exit 1; }

echo "▶ geometry ${COLS}x${ROWS} @ font-size ${FONT_SIZE}  (grid renders ~1927x1087, true 16:9)"

# 1) Fresh server → ~/.tmux.conf is sourced cleanly (Dracula via TPM, base-index 1)
tmux -L "$SOCK" kill-server 2>/dev/null || true
sleep 0.5

# 2) Wide detached session sized to match the cast geometry exactly (no wrap).
#    The pane runs the drive script, which waits for the recording client before
#    typing, then detaches it to stop the capture cleanly.
tmux -L "$SOCK" new-session -d -s "$SESSION" -x "$COLS" -y "$ROWS" \
  "bash '$DRIVE'"
tmux -L "$SOCK" refresh-client -S 2>/dev/null || true
sleep 1.0

# 3) Genuine capture of the live PTY.
#    asciinema 3.x note: --cols/--rows do NOT exist; you MUST use --window-size,
#    and --headless (in a non-tty shell asciinema otherwise defaults to 80x24,
#    which silently destroys the geometry). This is the #1 reproduction gotcha.
rm -f "$CAST"
asciinema rec --overwrite --headless --window-size "${COLS}x${ROWS}" \
  -c "tmux -L $SOCK attach -t $SESSION" "$CAST"

tmux -L "$SOCK" kill-server 2>/dev/null || true
echo "▶ cast: $CAST"

# 4) Render cast → mp4, scale-to-FILL exact 1920x1080, Apple HW encode.
FONTDIR="$FONTDIR" FONTFAMILY="$FONTFAMILY" FONT_SIZE="$FONT_SIZE" \
IDLE_LIMIT="$IDLE_LIMIT" FPS="$FPS" ENCODER="$ENCODER" BITRATE="$BITRATE" \
  bash "$HERE/lib/render_clip.sh" "$CAST" "$OUT"

# 5) Verify: must be exactly 1920x1080, 16:9.
read -r W H DAR < <(ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,display_aspect_ratio -of csv=p=0 "$OUT" | tr ',' ' ')
echo "▶ output: $OUT  (${W}x${H} DAR=${DAR})"
[ "$W" = 1920 ] && [ "$H" = 1080 ] || { echo "FAIL: not 1920x1080"; exit 1; }
echo "✅ TRUE 16:9 terminal B-roll, content fills frame (no pad/pillarbox)."
