# SEED: seedrec

> seed-format: 1

> **You're an AI agent reading this seed.** Your job: run `## Steps` Step 0
> (Interview), then execute every Step in order, then perform `## Verify`.
> When all Verify evidence is in hand print `SEED_RESULT=DONE`; on a blocker
> print `BLOCKED_REASON=<short reason>` and stop. Do not ask the human
> anything outside the single Interview turn.

## Goal

A host ends with the **seedrec browser recorder installed and proven** — the
opt-in tool that records a seedbed's browser/UI evidence path to host disk as
real video. seedrec is a host-side Playwright daemon: it opens a node's `ttyd`
or browser target URL in headless Chromium and records it with Chromium's
**native `recordVideo`** screencast encoder (never screenshot-stitching). Chromium
captures VP9-in-`.webm` (the raw intermediate); the **deliverable is H.264 mp4 by
default** — the universally-playable codec (Safari/QuickTime cannot play VP9 webm).

Default seedbed terminal recording is **asciinema**, not seedrec. Once this
seed is hydrated, a seedbed/test that explicitly exercises UI/browser behavior
can opt in with `SEEDBED_BROWSER_RECORDING=1` or run `seedrec start <node>
--url <url>` directly, then later run `seedrec stop <node> --reason
approved-retire|ceo-request` to finalize a playable browser artifact that
**survives the container's teardown**. Non-UI seedbeds MUST NOT start seedrec as
a duplicate default recorder.

**Agent-runtime policy (CEO doctrine).** Substrate validation/hydration agents
run on **Claude**, never Codex (see `seedbed.seed.md`). This browser-recording
path is the one special case: the host-side recorder is model-agnostic, and the
**dedicated browser-auth controller** that drives an interactive browser/UI login
when a flow requires it is the *only* place Codex may be used outside the central
`main:Boss`. That controller is special-case only — it is not a general substrate
agent and never validates or hydrates a node.

## Done

All observable, proven by `## Verify`:

- **Recorder installed.** `$SEEDREC_DIR/seedrec.mjs` exists and is executable;
  `$SEEDREC_DIR/node_modules/playwright` is present and a Chromium build is
  installed (the recorder launches `chromium.launch({ headless: true })`).
  `node "$SEEDREC_DIR/seedrec.mjs"` with no args prints the usage line
  (`usage: seedrec start|stop|status|_daemon …`).
- **Records to host disk, native video.** `seedrec start <node> --url <url>`
  spawns a **detached** daemon (survives the launching shell) that writes under
  `$REC_ROOT/<node>/` — `segments/seg-NNN.webm` (Chromium `recordVideo` output),
  `state.json` (pid + heartbeat), `recorder.log`. The path is on the **host**,
  not inside any container, so the video outlives `docker rm -f <node>`.
- **Recording is live + whole-lifetime.** `seedrec status <node>` reports
  `RECORDING`, `heartbeat_age < 10s`, and the in-flight segment's byte count
  **grows between two checks ~20–30s apart**. There is no timer cap and no
  stop-on-live-URL — the daemon records the node's entire lifetime.
- **Stops ONLY on a CEO-driven signal.** `seedrec stop <node> --reason
  approved-retire` or `--reason ceo-request` finalizes; **any other `--reason`
  (or none) is REJECTED with exit 1** and does not touch the recording. The
  daemon likewise ignores a malformed `control.json` (logs `IGNORED invalid
  control`). Agents never stop a recording on their own judgment.
- **Finalization delivers an H.264 mp4 (the STANDARD) + manifest.** Chromium's
  `recordVideo` captures VP9-in-`.webm`, which **Safari/QuickTime CANNOT play** — so
  the `.webm` is only the raw intermediate. On a valid stop the daemon concatenates
  segments losslessly (`ffmpeg -c copy`) → `$REC_ROOT/<node>/<node>-full.webm`, writes
  `manifest.json` (fast proof: `stop_reason`, segment list, `ffprobe` probe with
  `format.duration > 0`), then **by default** transcodes the deliverable
  `$REC_ROOT/<node>/<node>-full.mp4` (**H.264, `-pix_fmt yuv420p -movflags +faststart`**
  — universally playable) and repoints `manifest.video` to it. Pass `--webm-only` to
  skip the transcode (rarely wanted). **Always upload/hand off the `.mp4`, never the
  raw `.webm`.** The `stop` CLI blocks until `manifest.json` appears (finalization
  proof), up to 120s; the mp4 lands right after.
- **Crash-resilient, never self-stops.** If the recording browser/page crashes,
  the daemon salvages the in-flight segment, rotates to the next `seg-NNN`, and
  resumes (growing backoff on a crashloop) — it only ever exits on a valid stop
  signal.
- **The opt-in browser-recording gate works.** The documented one-liner
  `node "$SEEDREC_DIR/seedrec.mjs" status <node> | grep -q RECORDING || {
  echo "BLOCKED_REASON=seedrec_not_recording"; exit 1; }` passes while
  browser recording and fails (non-zero) when it is not — this is the contract a
  UI/browser seed embeds only when it intentionally requires a browser `.webm`
  artifact. It is not part of the default non-UI seedbed recorder path.
- **Idempotent.** Re-running this seed re-verifies the install instead of
  breaking it; `seedrec start` on a node that is already recording refuses with
  a non-zero exit (`already recording <node> (pid …)`) rather than double-starting.

## Inputs

| name | required | default | detect | ask |
|---|---|---|---|---|
| `seedrec/` bundle | yes | seed-supplied | `[ -f <seed-dir>/seedrec/seedrec.mjs ] && [ -f <seed-dir>/seedrec/package.json ]` | "The recorder ships next to this seed in the seedlab checkout (`seedrec/seedrec.mjs` + `package.json`). Canonical live source: `~/workspace/seedlab/seedrec/`. If absent, the checkout is incomplete — obtain it from whoever delivered the seed (the bundle travels with the seed; it is not fetched from the network)." |
| `SEEDREC_DIR` | no | `$HOME/workspace/seedlab/seedrec` | `[ -f "${SEEDREC_DIR:-$HOME/workspace/seedlab/seedrec}/seedrec.mjs" ]` | "Install target for the recorder code + its `node_modules`. Default is the canonical seedlab location; on that host the install is already in place and this seed just re-verifies it." |
| `REC_ROOT` | no | `$HOME/workspace/seedlab/recordings` | `[ -d "${REC_ROOT:-$HOME/workspace/seedlab/recordings}" ] \|\| true` | "Where recordings land: `$REC_ROOT/<node>/`. **Hardcoded in `seedrec.mjs`** as `~/workspace/seedlab/recordings` (`ROOT`) — changing it means editing the recorder, so keep the default unless you also patch `ROOT`." |
| Node.js ≥ 18 | yes | none | `node -e 'process.exit(process.versions.node.split(".")[0]>=18?0:1)' 2>/dev/null` | "Node 18+ runs the recorder + Playwright. macOS: `brew install node`. Debian/Ubuntu: NodeSource `setup_22.x`." |
| Playwright + Chromium | yes | installed by Step 2 | `[ -d "${SEEDREC_DIR:-$HOME/workspace/seedlab/seedrec}/node_modules/playwright" ]` | "Step 2 runs `npm install` in `$SEEDREC_DIR` then `npx playwright install chromium`. The recorder needs the Chromium build (native `recordVideo`)." |
| `ffmpeg` + `ffprobe` | yes | none | `command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null` | "`ffmpeg` losslessly concatenates multi-segment recordings + does the default H.264 `--mp4` transcode (opt out with `--webm-only`); `ffprobe` writes the manifest's duration/size probe. macOS: `brew install ffmpeg`. Debian/Ubuntu: `apt install ffmpeg`." |
| A recordable `ttyd`/HTTP target | for Verify only | seed stands up a throwaway | — | "To PROVE the opt-in browser recorder, Verify needs a URL to record. The seed stands up a short-lived local target itself (a `ttyd` attached to a shell if `ttyd` is on PATH, else `python3 -m http.server`). In production/UI tests the URL is the explicit browser/ttyd target the seed wants captured." |

Substrate assumptions: macOS (Darwin) or Linux, a writable `$HOME/workspace`,
internet for the one-time `npm install` / `playwright install chromium`
download. No accounts, no operator-provided secrets. The recorder runs on the
**host** (not inside the recorded container) — that is what makes the video
survive container teardown.

## Components

| Component | Role | Source |
|---|---|---|
| `seedrec.mjs` | The whole recorder: `start` (spawns a detached `_daemon`), `_daemon` (the segment loop — `chromium.launch` → `newContext({ recordVideo })` → `page.goto(ttyd-url)`, hold open with heartbeat + control-poll + ttyd-reconnect, salvage+rotate on crash, finalize on stop), `stop` (writes the CEO-signed `control.json`, waits for `manifest.json`), `status` (RECORDING/DEAD + segment bytes + heartbeat age). | Bundled: `seedrec/seedrec.mjs`. Live source: `~/workspace/seedlab/seedrec/seedrec.mjs`. Originally `seedbed.seed.md` Step 7.6. |
| `package.json` | Declares the single dependency `playwright ^1.60.0`. | Bundled: `seedrec/package.json`. |
| `$REC_ROOT/<node>/` layout | Per-node recording dir written at runtime: `state.json`, `control.json`, `segments/seg-NNN.webm`, `recorder.log`, and on stop `<node>-full.webm` + `manifest.json` (+ optional `<node>-full.mp4`, `concat.txt`). | Created by the daemon. Root `~/workspace/seedlab/recordings` is hardcoded as `ROOT` in `seedrec.mjs`. |

## Steps

The agent may substitute equivalent commands but must preserve the contracts:
**the browser recorder runs on the host; output goes to `$REC_ROOT/<node>/` on
host disk; recording stops ONLY on `--reason approved-retire|ceo-request`; the
bundle is the source of truth (do not rewrite the recorder's behavior).**

### Step 0: Interview

Run `detect` for every `## Inputs` row. Send ONE consolidated message listing
✓ satisfied inputs, ✗ missing tools with their `ask` text, and ⚠ prior-install
state (existing `$SEEDREC_DIR` with `node_modules` → re-verify vs fresh
install). After the reply, run everything below autonomously to
`SEED_RESULT=DONE` or one `BLOCKED_REASON=` line.

### Step 1: Materialize the recorder bundle

*What:* place `seedrec.mjs` + `package.json` at `$SEEDREC_DIR`. *Why:* the
recorder must be installed independently of the seedlab checkout staying around.

```sh
mkdir -p "$SEEDREC_DIR"
cp <seed-dir>/seedrec/seedrec.mjs <seed-dir>/seedrec/package.json "$SEEDREC_DIR"/
chmod +x "$SEEDREC_DIR/seedrec.mjs"
```

On the canonical host, `$SEEDREC_DIR` is already `~/workspace/seedlab/seedrec`
and this is a no-op copy — that is fine (idempotent). Do **not** copy any
`node_modules` between machines; Step 2 builds it locally.

### Step 2: Install Playwright + Chromium

*What:* the recorder's only dependency, plus the Chromium browser build it
drives. *Why:* `seedrec _daemon` calls `chromium.launch({ headless: true })`
and `recordVideo` — both require the Chromium binary, not just the npm package.

```sh
cd "$SEEDREC_DIR"
npm install                       # installs playwright ^1.60.0 from package.json
npx playwright install chromium   # downloads the Chromium build recordVideo needs
```

(If a system Chromium/Playwright cache is already present, `playwright install`
is a fast no-op. On Linux you may also need `npx playwright install-deps
chromium` for the shared libraries.)

### Step 3: Smoke-test the CLI surface

*What:* confirm the four commands load and the recorder dir is wired. *Why:*
catches a broken Node/Playwright install before any real recording.

```sh
node "$SEEDREC_DIR/seedrec.mjs"          # → usage: seedrec start|stop|status|_daemon …
node "$SEEDREC_DIR/seedrec.mjs" status   # → lists existing recordings (or nothing on a fresh host)
```

A clean usage line + a non-crashing `status` proves the install. The real proof
that it *records* is `## Verify`.

### Step 4: Adopt the opt-in browser-recording gate (UI/browser tests only)

*What:* this is documentation + a one-liner a UI/browser seed embeds into its
OWN test path after it intentionally starts seedrec. seedrec does not enforce it
from the outside; the seed/test opts in by gating the UI/browser work on it.
*Why:* the default terminal recorder is asciinema. Browser recording is only for
explicit UI/browser behavior, where a `.webm` artifact is the evidence.

After intentionally starting browser recording, gate that UI/browser path:

```sh
# 1) start browser recording intentionally (host-side, URL chosen by the UI/browser test)
node "$SEEDREC_DIR/seedrec.mjs" start "$NODE_NAME" \
  --url "$BROWSER_RECORD_URL"
sleep 5
# 2) BLOCK the UI/browser test path unless the browser recorder is live
node "$SEEDREC_DIR/seedrec.mjs" status "$NODE_NAME" | grep -q RECORDING \
  || { echo "BLOCKED_REASON=seedrec_not_recording"; exit 1; }
```

Do not embed these lines in a default non-UI seedbed path. Default substrate
terminal recording is covered by `seedbed.seed.md` Step 7.6's asciinema gate.

### Step 5: Print the operator card

Print for the human, the exact opt-in browser-recorder lifecycle commands:

- **Start (begins intentional browser recording):**
  `node "$SEEDREC_DIR/seedrec.mjs" start <node> --url <ttyd-url> [--width 1920] [--height 1080]`
- **Status:** `node "$SEEDREC_DIR/seedrec.mjs" status [<node>]`
- **Stop (CEO-driven ONLY — finalizes the video):**
  `node "$SEEDREC_DIR/seedrec.mjs" stop <node> --reason approved-retire|ceo-request [--webm-only]`
- **Output:** `$REC_ROOT/<node>/<node>-full.webm` (+ `manifest.json`, + optional
  `.mp4`) — on host disk, survives `docker rm -f <node>`.

## Verify  (AGENT-DRIVEN — prove intentional browser recording produces a playable video)

You are an agent. Prove the opt-in browser recorder actually works end-to-end by
recording a short throwaway run and inspecting the artifact — do not trust exit
codes alone.
Use a disposable node name (e.g. `seedrec-verify`) so production recordings are
untouched.

**1. Stand up a recordable target.** Prefer a real terminal (faithful to
production); fall back to any HTTP page — the recorder records whatever the URL
serves.

```sh
PORT=7699
if command -v ttyd >/dev/null; then
  ( ttyd -W -p "$PORT" -t disableLeaveAlert=true bash >/tmp/seedrec-verify-ttyd.log 2>&1 & )
else
  ( cd /tmp && python3 -m http.server "$PORT" >/tmp/seedrec-verify-http.log 2>&1 & )
fi
sleep 2
curl -fsS -o /dev/null "http://localhost:$PORT/" && echo "target up on :$PORT"
```

**2. Start recording intentionally + confirm it is LIVE.**

```sh
node "$SEEDREC_DIR/seedrec.mjs" start seedrec-verify --url "http://localhost:$PORT/"
sleep 5
node "$SEEDREC_DIR/seedrec.mjs" status seedrec-verify   # expect: RECORDING heartbeat_age <10s
B1=$(node "$SEEDREC_DIR/seedrec.mjs" status seedrec-verify | sed -n 's/.*bytes=\([0-9]*\).*/\1/p')
sleep 20
B2=$(node "$SEEDREC_DIR/seedrec.mjs" status seedrec-verify | sed -n 's/.*bytes=\([0-9]*\).*/\1/p')
echo "segment grew: $B1 -> $B2"   # B2 > B1 proves active browser capture
```

Judge: `status` says `RECORDING`, heartbeat is fresh, and `B2 > B1`. Confirm the
output is on **host disk**: `ls -la "$REC_ROOT/seedrec-verify/segments/"` shows a
growing `seg-001.webm`, and `cat "$REC_ROOT/seedrec-verify/state.json"` shows a
live `pid` + recent `heartbeat`. This proves the browser artifact path can still
be enabled intentionally.

**3. Prove a bogus stop is REJECTED (recording must not be stoppable on a whim).**

```sh
node "$SEEDREC_DIR/seedrec.mjs" stop seedrec-verify --reason because-i-said-so; echo "exit=$?"
node "$SEEDREC_DIR/seedrec.mjs" stop seedrec-verify;                          echo "exit=$?"
node "$SEEDREC_DIR/seedrec.mjs" status seedrec-verify   # still RECORDING
```

Judge: both bogus stops print `REJECTED: stop requires --reason
approved-retire|ceo-request` and exit **1**, and `status` still says
`RECORDING`. The recording is untouched.

**4. Stop with a valid CEO signal → playable video on disk.**

```sh
node "$SEEDREC_DIR/seedrec.mjs" stop seedrec-verify --reason ceo-request
# the stop CLI blocks until manifest.json appears, then prints it
cat "$REC_ROOT/seedrec-verify/manifest.json"
ffprobe -v quiet -show_entries format=duration,size -of json \
  "$REC_ROOT/seedrec-verify/seedrec-verify-full.mp4"
```

Judge — ALL must hold:
- `$REC_ROOT/seedrec-verify/seedrec-verify-full.mp4` (the H.264 **deliverable**) exists,
  is non-empty, and `ffprobe` reports its codec is `h264` (NOT `vp9`) — this is the exact
  regression the default guards against (VP9 webm is unplayable in Safari/QuickTime);
- `ffprobe` reports `format.duration` **> 0** (a real, playable video — roughly
  the ~25s the run lasted, not a zero-length stub);
- `manifest.json` carries `"stop_reason": "ceo-request"`, the `segments` list,
  a `video_probe` with the same duration, and `"video"` pointing at the `.mp4`;
- `status` now reports `DEAD`/`stopped` for the node (the daemon exited cleanly
  on the valid signal, having recorded the whole lifetime up to it);
- the raw `seedrec-verify-full.webm` (VP9 intermediate) also exists — but is NOT what
  you hand off. (`--webm-only` would skip the mp4; don't, unless a caller truly wants raw.)

**5. (Optional, strongest) Eyeball playback.** Open the `.webm`/`.mp4` in a
player or a browser (`file://` or via the host-mapped path) and confirm it shows
the recorded terminal/page. A pass you can watch is the gold standard; capture a
screenshot of a playback frame as evidence.

**6. Conclude.** Browser recorder installed (Steps 1–3), opt-in gate documented
(Step 4), and the Verify run produced a playable host-disk video from a
CEO-signed stop while rejecting bogus stops and capturing intentionally -> print
`SEED_RESULT=DONE` with the recorder path,
`$REC_ROOT/seedrec-verify/seedrec-verify-full.webm`, and the probed duration.
Otherwise state which check failed + evidence, then
`BLOCKED_REASON=<reason>`.

> **Cleanup the verify artifacts** (they are throwaway):
> `rm -rf "$REC_ROOT/seedrec-verify"` and stop the target
> (`pkill -f "http.server $PORT"` or `pkill -x ttyd` for the one you started).

## Failure modes

**Symptom: `status` shows `DEAD` seconds after `start` (daemon dies immediately).**
- Detect: `cat "$REC_ROOT/<node>/recorder.log"` — a Playwright/Chromium launch
  error, or `page.goto` timeout against the URL.
- Fix: Chromium missing → `npx playwright install chromium` (+ `install-deps
  chromium` on Linux); URL unreachable → confirm the target is up
  (`curl "$URL"`). The daemon needs the URL to load within 30s.

**Symptom: `start` prints `already recording <node> (pid …)` and exits 1.**
- Detect: a prior daemon for that node is still alive (`status` → `RECORDING`).
- Fix: intended guard against double-starts. Stop it with a valid reason
  (`approved-retire`/`ceo-request`) first, or use a different node name. If the
  pid is actually dead but `state.json` lingers, remove
  `$REC_ROOT/<node>/state.json` and retry.

**Symptom: `stop` prints `REJECTED: stop requires --reason …` and exits 1.**
- Detect: missing/invalid `--reason`.
- Fix: **working as designed** — recordings stop ONLY on `--reason
  approved-retire` or `--reason ceo-request`. There is no override.

**Symptom: `stop` hangs then says `daemon did not finalize within 120s`.**
- Detect: no `manifest.json` after 120s.
- Fix: check `recorder.log`; usually an `ffmpeg` failure during multi-segment
  concat or H.264 mp4 transcode (confirm `ffmpeg`/`ffprobe` on PATH). The webm
  segments are still on disk under `segments/` and can be concatenated manually
  (`ffmpeg -f concat -safe 0 -i concat.txt -c copy <node>-full.webm`).

**Symptom: many `seg-NNN.webm` segments / `recorder.log` shows "rotating to
next segment".**
- Detect: repeated page crashes or ttyd disconnects in `recorder.log`.
- Fix: not a defect — the daemon salvages each segment and resumes; `finalize`
  losslessly concatenates them into one `<node>-full.webm`. Persistent crashes
  point at the *target* (ttyd/page) being unstable, not the recorder.

**Symptom: `recordVideo` produces a tiny/zero-duration webm.**
- Detect: `ffprobe` duration ~0; the run was stopped within a second of start.
- Fix: let the recording run a few seconds before stopping (Chromium flushes the
  screencast on context close); confirm the page actually rendered (not a blank
  error page) via the target's own log.

## Cleanup

The recorder install itself is meant to persist. To remove a single recording or
uninstall:

```sh
# one recording
rm -rf "$REC_ROOT/<node>"
# uninstall the recorder (only if decommissioning)
rm -rf "$SEEDREC_DIR/node_modules" "$SEEDREC_DIR/seedrec.mjs" "$SEEDREC_DIR/package.json"
```

## Notes / provenance

- **Extracted from the earlier browser-recorder path in `seedbed.seed.md` Step
  7.6** and now retained as an opt-in UI/browser artifact tool. Default seedbed
  terminal recording is asciinema; this seed packages the browser recorder as a
  standalone, independently-verifiable install. The live
  implementation is `~/workspace/seedlab/seedrec/seedrec.mjs`; reference
  recordings produced by it live under `~/workspace/seedlab/recordings/`
  (e.g. `seedbed-ours-1/` — a 3-segment, 245s `ceo-request` stop with both webm
  and mp4; `seedbed-rec-1-retire-proof/` — a 12s `approved-retire` finalize).
- **Native video, not stitching.** Capture is Chromium's `recordVideo`
  screencast encoder (`newContext({ recordVideo: { dir, size } })`), yielding a
  real `.webm`. There is no screenshot loop.
- **Host-side by design.** The recorder runs on the host and records the node's
  **host-mapped** ttyd port (`http://localhost:$TTYD_HOST_PORT/…`), which is its
  stablest path and — crucially — keeps the artifact on host disk so it
  **survives `docker rm -f <node>`**. The recorder is not installed inside the
  recorded container.
- **`REC_ROOT` is hardcoded.** `seedrec.mjs` sets `ROOT =
  ~/workspace/seedlab/recordings`. The `REC_ROOT` input documents where output
  lands; relocating it requires editing `ROOT` in the recorder.
- **Recursion (the harden proof).** This draft is proven by recording its OWN
  hydration on the server: run this seed's install while `seedrec` records that
  very terminal start-to-finish — the harden-loop of the seed-for-recording-
  harden-loops, captured by itself.
