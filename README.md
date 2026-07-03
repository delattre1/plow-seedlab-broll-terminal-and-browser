# plow-seedlab-broll-terminal-and-browser

**ONE source of truth for B-roll recording — TERMINAL and BROWSER.** Both recorders live here
together; there is no other canonical b-roll repo.

*(Renamed from `plow-seedlab-terminal-broll` on 2026-07-01 and merged with the rescued `seedrec`
browser recorder — the old URL still redirects. The browser recorder was previously orphaned in the
now-deleted `plow-pbc/seedlab`; it is preserved here.)*

## Which recorder?

| you want to record… | use | lives in |
|---|---|---|
| a **terminal / TUI** (tmux, CLI) → 16:9 mp4 | terminal recorder | [`terminal/`](terminal/) |
| a **browser / UI** flow → **H.264 mp4** | browser recorder (`seedrec`) | [`browser/`](browser/) |

## Terminal recorder — [`terminal/`](terminal/)

TRUE 16:9 (1920×1080) terminal B-roll: a real Dracula tmux session, recorded (asciinema) and
rendered (agg + ffmpeg scale-to-FILL, `h264_videotoolbox`) so the terminal fills the whole frame
edge-to-edge — no padding/pillarbox.

```bash
cd terminal
./record-terminal-broll.sh                     # → out/terminal-broll.mp4 (1920×1080, 16:9)
SEED_FILE=~/notes/x.md OUT=clip.mp4 ./record-terminal-broll.sh
lib/render_clip.sh out/terminal-broll.cast clip.mp4 4 12   # render a 12s slice from t=4s
```

Full spec + geometry math: [`terminal/SEED.md`](terminal/SEED.md). Requires macOS (Apple silicon):
`brew install tmux asciinema agg ffmpeg` (set `ENCODER=libx264` on non-Apple hosts).

## Browser recorder — [`browser/`](browser/)

`seedrec` — the opt-in browser/UI recorder for seeds/tests exercising browser behavior (host-side
Chrome + ttyd). It captures via Chromium `recordVideo` (VP9 `.webm`, the raw intermediate) and, **by
default, delivers an H.264 mp4** (`<node>-full.mp4`, `yuv420p` + `+faststart`) — the universally
playable codec. **Safari/QuickTime cannot play VP9 webm, so always hand off the `.mp4`.** The
generative seed is
[`browser/seedrec.seed.md`](browser/seedrec.seed.md); the Node implementation is
[`browser/seedrec/seedrec.mjs`](browser/seedrec/seedrec.mjs) (`start` / `status` / `stop`).

```bash
cd browser/seedrec && npm install
node seedrec.mjs start  <name> …            # begin recording
node seedrec.mjs status <name>              # RECORDING?
node seedrec.mjs stop   <name> --reason ceo-request   # finalize → H.264 mp4 (default; --webm-only to skip)
```

> Consumers (e.g. the seedbed substrate seed) should invoke
> `~/workspace/plow-seedlab-broll-terminal-and-browser/browser/seedrec/seedrec.mjs`
> (the substrate seed was updated to this path). The terminal recorder is the DEFAULT for substrate
> panes (asciinema, ~0% CPU); `seedrec` is opt-in only when a real browser video (H.264 mp4) is needed.

## Layout

```
terminal/   TRUE-16:9 terminal B-roll recorder (SEED.md + record-terminal-broll.sh + lib/ + fonts/)
browser/    seedrec browser/UI recorder (seedrec.seed.md + seedrec/ node impl)
```

## License

MIT. Public, no secrets.
