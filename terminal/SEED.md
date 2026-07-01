# SEED: plow-seedlab-terminal-broll

> seed-format: 1 · **generative**
> One file = the whole recipe for a CEO-approved **TRUE 16:9 (1920×1080) terminal B-roll**.

> **You are an AI coding agent (or a human) reading this seed.** This encodes the
> **exact, reproducible method** that produced the approved clip: a wide tmux in the
> operator's Dracula style, recorded as a genuine PTY with asciinema, rendered with
> agg, and scaled-to-FILL to exactly 1920×1080 so the terminal **content reaches all
> four edges** — no padding, no pillarbox, no square floating in colored bars. The
> working scripts ship alongside this seed; this document is the load-bearing spec.
> Final encode is Apple `h264_videotoolbox` (Rule 6: hardware encode, never libx264).

---

## 0. One command

```bash
./record-terminal-broll.sh
# → out/terminal-broll.mp4   (1920×1080, DAR 16:9, content fills frame)
```

Show your own file, or change the output path:

```bash
SEED_FILE=~/notes/whatever.md  OUT=clip.mp4  ./record-terminal-broll.sh
```

Render only a range of an existing cast:

```bash
lib/render_clip.sh out/terminal-broll.cast range.mp4  4 12   # 12s from t=4s
```

---

## 1. Purpose & mental model

A terminal B-roll is short, beautiful footage of a REAL terminal, used as a video
background. The hard requirement (the thing the CEO rejected twice before approving):
the recording must be a **genuine 16:9 frame** — the **text grid itself** renders at
16:9. It is NOT a 1:1 square terminal scaled-to-fit and padded with Dracula-colored
bars. The aspect ratio comes from the grid geometry, not from post-hoc padding.

Three moving parts:
- **Geometry** — a WIDE tmux (cols × rows) whose grid renders ~1920×1080 at a chosen
  agg font size. See §4.
- **Capture** — asciinema records the real PTY of a live tmux session running the
  operator's `~/.tmux.conf` (Dracula theme, `base-index 1`, status plugins: the green
  `seedlab` session block on the left, CPU/RAM/clock on the right).
- **Render** — agg → frames; ffmpeg scale-to-FILL 1920×1080 → Apple HW encode. The
  output is asserted: width=1920, height=1080.

## 2. Contracts (load-bearing — each was a real bug once)

- **C1 — Native 16:9 grid.** The terminal grid must render ~16:9 by itself. Do NOT
  record a square (e.g. 80×24 or 150×32) and pad it to 16:9. That is the exact thing
  the CEO rejected.
- **C2 — Scale-to-FILL, never pad.** If the native aspect is a hair off 16:9, COVER
  1920×1080 and crop the few overflow px. Never letterbox/pillarbox. No dark margins.
- **C3 — asciinema 3.x geometry.** asciinema ≥3 has **no `--cols`/`--rows`**. Use
  `--window-size COLSxROWS` **and** `--headless`. In a non-tty shell (any agent /
  CI / `bash -c`) asciinema otherwise defaults to **80×24** and silently destroys the
  geometry — this was the #1 reproduction trap.
- **C4 — Apple HW encode.** Final encode is `-c:v h264_videotoolbox` (Rule 6). Never
  libx264 on Apple silicon. (`ENCODER=libx264` is available as an escape hatch for
  non-Mac hosts.)
- **C5 — Verify the artifact.** Assert `width=1920 height=1080`, `DAR=16:9`, and that
  content reaches all four edges (status bar spans full width; no uniform border).
- **C6 — Genuine capture.** Record a real PTY. Never screenshot HTML or fake a frame.
- **C7 — Fresh tmux server.** Start tmux with a dedicated `-L` socket so a clean
  `~/.tmux.conf` is sourced (Dracula via TPM, base-index 1) without colliding with a
  running session, and kill it after.

## 3. Pipeline (what the scripts do)

```
record-terminal-broll.sh
  ├─ tmux -L brollrec kill-server                 # clean slate (C7)
  ├─ tmux -L brollrec new-session -d -x151 -y36 \ # WIDE 16:9 grid (C1)
  │     "bash drive/seed-walkthrough.sh"          #   sources ~/.tmux.conf → Dracula
  ├─ asciinema rec --headless --window-size 151x36 \   # genuine PTY (C3, C6)
  │     -c "tmux -L brollrec attach -t seedlab" out.cast
  └─ lib/render_clip.sh out.cast out.mp4
        ├─ normalize_glyphs.py    # TUI codepoints no monospace font covers → siblings
        ├─ agg --font-size 21     # → native 1927×1087 (true 16:9)
        └─ ffmpeg scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080
              -c:v h264_videotoolbox -b:v 8M       # scale-to-FILL (C2) + HW encode (C4)
```

The **drive** (`drive/seed-walkthrough.sh`) is whatever gets typed into the live pane.
It blocks until the recording client attaches (clean first frame), types a short
walkthrough of `$SEED_FILE`, then detaches the client to finalize the capture. Swap
this file to record anything else in the same 16:9 Dracula style.

## 4. Geometry math (how to pick cols/rows/font-size)

agg renders each cell at a size proportional to `--font-size`. Fitted for the bundled
**JetBrainsMono Nerd Font Mono**:

```
cell_w ≈ 0.6002 × font_size      cell_h ≈ 1.405 × font_size
agg_width  ≈ font_size × (0.6002 × cols + 1.17)     # +pad ≈ 1 cell total
agg_height ≈ font_size × (1.405 × rows + 1.23)
```

The **grid aspect is independent of font size** — it depends only on cols/rows. So:

1. Pick cols/rows for 16:9:  `cols ≈ 4.16 × rows`  (e.g. rows=36 → cols≈151).
2. Pick a font size for ~1920 wide:  `font_size ≈ 1920 / (0.6002×cols + 1.17)`.

The approved recipe — **cols=151, rows=36, font-size=21** — renders **1927×1087**
natively (aspect 1.773 ≈ 16:9). A scale-to-FILL to 1920×1080 crops ~3 px. Edge-to-edge.

To change font: render a 2-line probe cast at two font sizes and two geometries,
measure the gif dims with `ffprobe`, and re-solve the two constants above.

## 5. Prerequisites

- macOS (Apple silicon) for `h264_videotoolbox`. Set `ENCODER=libx264` elsewhere.
- `tmux`, `asciinema` (≥3), `agg` (agg ≥1.7), `ffmpeg`, `python3`.
  `brew install tmux asciinema agg ffmpeg`
- The operator's `~/.tmux.conf` for the Dracula look (status block, base-index 1,
  plugins via TPM). Without it you still get a clean 16:9 clip, just default tmux
  styling. The bundled Nerd Font is used for rendering regardless of system fonts.

## 6. Verify (exit code is the truth)

`record-terminal-broll.sh` asserts the output is exactly 1920×1080 and prints
`✅ TRUE 16:9 terminal B-roll`. To prove content fills the frame (no border), sample
the final frame's edges — the Dracula status bar must span the full width (green
session block hard-left, CPU/RAM/clock hard-right). On success: `SEED_RESULT=DONE`.

## 7. Provenance

This seed is the packaged form of the method behind plow card `978ee4e2c817`
(CEO-approved terminal B-roll). The scripts here are the literal ones that produced
the approved clip, generalized only to take `$SEED_FILE`/`$OUT`.
