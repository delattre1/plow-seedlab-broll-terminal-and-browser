# SEED: terminal-broll

> seed-format: 1 · **generative**

> **You are an AI coding agent reading this seed.** This is a GENERATIVE seed: it
> encodes **intent + contracts + the working scripts** for producing a TRUE 16:9
> (1920x1080) terminal B-roll. There is ZERO magic here — the recipe is exact and
> reproducible. Boot a wide tmux in the operator's Dracula style, record the live
> PTY with asciinema, render with agg, then scale-to-FILL exactly 1920x1080 so the
> terminal content reaches all four edges. No padding, no pillarbox, no square in a
> box. Final encode uses Apple `h264_videotoolbox` (Rule 6: hardware encode).

---

## 1. Purpose & mental model

A terminal B-roll is a short, beautiful screen recording of a real terminal — used
as background footage in a product video. The hard requirement is that it be a
genuine 16:9 frame: the **text grid itself** must render at 16:9, not a square
terminal floating in colored bars.

Mental model — three moving parts:
- **The geometry** — a WIDE tmux (cols × rows) whose grid renders ~1920×1080 at a
  chosen font size. The aspect comes from the grid, not from post-hoc padding.
- **The capture** — asciinema records the real PTY of a live tmux session running
  the operator's `~/.tmux.conf` (Dracula theme, base-index 1, status plugins).
- **The render** — agg turns the cast into frames; ffmpeg scales-to-FILL 1920×1080
  and encodes on Apple silicon. The output is checked: width=1920, height=1080.

## 2. Contracts (each was a real bug once)

- C1. The grid renders ~16:9 NATIVELY. Do not record a square and pad it.
- C2. Scale-to-FILL only. If aspect is a hair off, cover+crop — never pillarbox.
- C3. asciinema 3.x: there is no `--cols/--rows`; use `--window-size COLSxROWS`
      and `--headless`, or a non-tty shell silently records 80×24.
- C4. Encode with `h264_videotoolbox`. Never libx264 on Apple hardware.
- C5. Verify the final mp4: width=1920, height=1080, content reaches all edges.

## 3. Geometry math

agg cell model (JetBrainsMono Nerd Font Mono): cell_w ≈ 0.6002 × font_size,
cell_h ≈ 1.405 × font_size. The grid aspect is independent of font size, so pick
cols/rows for 16:9, then a font size for ~1920 wide. cols=151, rows=36,
font-size=21 → agg renders 1927×1087 (true 16:9) → fill to exact 1920×1080.

## 4. Verify

Run the harness; its exit code is the truth. On a 1920×1080 16:9 output with
content at all four edges, print `SEED_RESULT=DONE`.
