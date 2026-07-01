#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# seed-walkthrough.sh — the content "drive" for a terminal B-roll: what gets
# typed into the live tmux pane while it's being recorded. This is the exact
# walkthrough behind the approved clip (a seed file on screen), generalized to
# show $SEED_FILE.
#
# It runs AS the tmux pane's command. It blocks until the recording client is
# attached (so capture starts clean), types a short walkthrough into the real
# PTY, then detaches the client to stop the recording.
#
# Swap this file (DRIVE=... ./record-terminal-broll.sh) to record anything else
# in the same 16:9 Dracula style.
# ─────────────────────────────────────────────────────────────────────────────
set -u
SOCK="${BROLL_SOCK:-brollrec}"
SESSION="${BROLL_SESSION:-seedlab}"
SEED="${SEED_FILE:-$HOME/workspace/plow-seedlab-terminal-broll/examples/sample.seed.md}"
P='\033[38;5;156m❯\033[0m'   # volt-green prompt

type_cmd() { printf "$P "; for ((i=0;i<${#1};i++)); do printf '%s' "${1:$i:1}"; sleep 0.03; done; printf '\n'; sleep 0.4; }

# Wait until a client (the asciinema attach) is connected before drawing, so the
# recording never misses the opening frames.
for _ in $(seq 1 200); do
  if tmux -L "$SOCK" list-clients -t "$SESSION" 2>/dev/null | grep -q .; then break; fi
  sleep 0.1
done
sleep 0.6

clear; sleep 0.8
type_cmd "ls -la $SEED"
ls -la "$SEED"; sleep 1.0

type_cmd "wc -l $SEED   # one file = the whole runtime"
wc -l "$SEED"; sleep 1.4

# Clear so the seed file fills the screen top-to-bottom (35 usable rows above the
# Dracula status bar): 34 lines of output + the command line == a full frame.
clear; sleep 0.4
type_cmd "head -34 $SEED"
head -34 "$SEED"; sleep 3.4

type_cmd "# A Boss + a team out. You just bring the tasks."
sleep 2.0

# Clean stop: drop the recording client → its `attach` returns → rec finalizes.
tmux -L "$SOCK" detach-client -s "$SESSION"
sleep 0.5
