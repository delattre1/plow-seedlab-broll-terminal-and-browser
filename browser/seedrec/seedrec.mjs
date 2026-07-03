#!/usr/bin/env node
// seedrec — opt-in NATIVE browser-video recorder for seedbed UI/browser proof.
//
// Records a node's ttyd attach URL with Playwright's recordVideo (chromium's
// native screencast encoder — NO screenshot stitching). Playwright captures to
// VP9-in-.webm; that codec is NOT playable in Safari/QuickTime, so the .webm is
// only the RAW intermediate. THE DEFAULT DELIVERABLE IS H.264 mp4 (<node>-full.mp4,
// yuv420p + faststart) — the universally-playable codec. This is the STANDARD
// output; pass `--webm-only` on stop to skip the transcode (rarely wanted).
//
// Lifecycle contract:
//   - OPT-IN: seedbed terminal recording defaults to asciinema. Use seedrec only
//     when a seed/test explicitly needs a browser .webm artifact.
//   - CONTINUOUS WHEN STARTED: no timer cap, no stop-on-live-URL, no
//     agent-judgment stop. Segments rotate on timer/crash so artifacts are
//     inspectable and the supervisor resumes recording immediately.
//   - STOPS ONLY on a CEO-driven signal, delivered via `seedrec stop`:
//       --reason approved-retire   (seed approved + node being retired)
//       --reason ceo-request       (CEO explicitly asked for the video)
//     Any other reason is REJECTED. Nothing else stops the recording.
//
// Commands:
//   seedrec start  <node> --url <ttyd-url> [--width 1920] [--height 1080]
//   seedrec stop   <node> --reason approved-retire|ceo-request [--webm-only]
//   seedrec status [<node>]
//   seedrec _daemon <node>          (internal — spawned detached by start)
//
// Layout: ~/workspace/seedlab/recordings/<node>/
//   state.json      daemon state + heartbeat
//   control.json    stop signal (written by `seedrec stop`)
//   segments/       seg-001.webm, seg-002.webm ... (>1 only after crashes)
//   recorder.log
//   <node>-full.mp4   (H.264 — THE deliverable) + <node>-full.webm (raw VP9) + manifest.json

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execFileSync } from 'child_process';

const ROOT = path.join(os.homedir(), 'workspace/seedlab/recordings');
const STOP_REASONS = ['approved-retire', 'ceo-request'];
const POLL_MS = 2000;

const [, , cmd, node, ...rest] = process.argv;
const opt = (name, dflt) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : dflt;
};
const flag = (name) => rest.includes(`--${name}`);
const dir = (n) => path.join(ROOT, n);
const j = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const rj = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const log = (n, msg) => {
  const line = `${new Date().toISOString()} ${msg}\n`;
  fs.appendFileSync(path.join(dir(n), 'recorder.log'), line);
};
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// ── start ─────────────────────────────────────────────────────────────────────
if (cmd === 'start') {
  const url = opt('url');
  if (!node || !url) { console.error('usage: seedrec start <node> --url <ttyd-url>'); process.exit(1); }
  fs.mkdirSync(path.join(dir(node), 'segments'), { recursive: true });
  const st = rj(path.join(dir(node), 'state.json'));
  if (st && alive(st.pid)) { console.error(`already recording ${node} (pid ${st.pid})`); process.exit(1); }
  fs.rmSync(path.join(dir(node), 'control.json'), { force: true });
  const args = ['_daemon', node, '--url', url,
    '--width', opt('width', '1920'), '--height', opt('height', '1080')];
  const child = spawn(process.execPath, [new URL(import.meta.url).pathname, ...args], {
    detached: true, stdio: 'ignore',
  });
  child.unref();
  console.log(`seedrec: recording ${node} → ${dir(node)} (daemon pid ${child.pid})`);
  console.log(`stops ONLY via: seedrec stop ${node} --reason approved-retire|ceo-request`);
  process.exit(0);
}

// ── stop ──────────────────────────────────────────────────────────────────────
if (cmd === 'stop') {
  const reason = opt('reason');
  if (!node || !STOP_REASONS.includes(reason)) {
    console.error(`REJECTED: stop requires --reason ${STOP_REASONS.join('|')} (CEO-driven only)`);
    process.exit(1);
  }
  if (!fs.existsSync(dir(node))) { console.error(`no recording dir for ${node}`); process.exit(1); }
  j(path.join(dir(node), 'control.json'),
    // H.264 mp4 is the DEFAULT deliverable (Safari/QuickTime can't play VP9 webm);
    // --webm-only opts out of the transcode.
    { action: 'stop', reason, mp4: !flag('webm-only'), requested_at: new Date().toISOString() });
  console.log(`stop signal (${reason}) written for ${node}; daemon will finalize.`);
  // wait for the manifest (finalization proof), up to 120s
  const mf = path.join(dir(node), 'manifest.json');
  const t0 = Date.now();
  while (Date.now() - t0 < 120000) {
    if (fs.existsSync(mf)) { console.log(fs.readFileSync(mf, 'utf8')); process.exit(0); }
    execFileSync('sleep', ['1']);
  }
  console.error('daemon did not finalize within 120s — check recorder.log');
  process.exit(1);
}

// ── status ────────────────────────────────────────────────────────────────────
if (cmd === 'status') {
  const nodes = node ? [node] : (fs.existsSync(ROOT) ? fs.readdirSync(ROOT) : []);
  for (const n of nodes) {
    const st = rj(path.join(dir(n), 'state.json'));
    if (!st) { console.log(`${n}: no state`); continue; }
    const segs = fs.existsSync(path.join(dir(n), 'segments'))
      ? fs.readdirSync(path.join(dir(n), 'segments')).filter(f => f.endsWith('.webm')) : [];
    const bytes = segs.reduce((a, f) => a + fs.statSync(path.join(dir(n), 'segments', f)).size, 0);
    const live = alive(st.pid);
    const hb = st.heartbeat ? Math.round((Date.now() - new Date(st.heartbeat)) / 1000) : '?';
    console.log(`${n}: ${live ? 'RECORDING' : 'DEAD'} pid=${st.pid} since=${st.started_at} ` +
      `segments=${segs.length} bytes=${bytes} heartbeat_age=${hb}s url=${st.url}`);
  }
  process.exit(0);
}

// ── _daemon ───────────────────────────────────────────────────────────────────
if (cmd === '_daemon') {
  const url = opt('url');
  const W = parseInt(opt('width', '1920')), H = parseInt(opt('height', '1080'));
  const D = dir(node), SEG = path.join(D, 'segments');
  fs.mkdirSync(SEG, { recursive: true });
  const startedAt = new Date().toISOString();
  let segN = fs.readdirSync(SEG).filter(f => f.endsWith('.webm')).length; // resume numbering
  log(node, `daemon up pid=${process.pid} url=${url} ${W}x${H} (resume seg index ${segN})`);

  const writeState = (extra = {}) => j(path.join(D, 'state.json'), {
    pid: process.pid, node, url, started_at: startedAt,
    heartbeat: new Date().toISOString(), segment: segN, ...extra,
  });

  const finalize = async (reason, wantMp4) => {
    // concat all segments (stream-copy: fast, lossless) → <node>-full.webm
    const segs = fs.readdirSync(SEG).filter(f => f.endsWith('.webm')).sort();
    const full = path.join(D, `${node}-full.webm`);
    if (segs.length === 1) {
      fs.copyFileSync(path.join(SEG, segs[0]), full);
    } else if (segs.length > 1) {
      const list = path.join(D, 'concat.txt');
      fs.writeFileSync(list, segs.map(s => `file '${path.join(SEG, s)}'`).join('\n') + '\n');
      execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', full],
        { stdio: 'ignore' });
    }
    const probe = (f) => {
      try {
        return execFileSync('ffprobe', ['-v', 'quiet', '-show_entries',
          'format=duration,size', '-of', 'json', f]).toString();
      } catch { return '{}'; }
    };
    // Manifest FIRST (webm concat is the fast finalization proof — the stop CLI
    // waits on it); the H.264 transcode can take minutes for long recordings and
    // must not delay the proof. `video` starts as the raw webm and is REPOINTED to
    // the mp4 below once it lands (the mp4 is the deliverable).
    const manifest = {
      node, started_at: startedAt, stopped_at: new Date().toISOString(),
      stop_reason: reason, segments: segs,
      video_webm: full,          // raw VP9 intermediate — NOT playable in Safari/QuickTime
      video: full,               // repointed to the H.264 mp4 below (default deliverable)
      video_probe: JSON.parse(probe(full)), mp4: wantMp4 ? 'transcoding' : null,
    };
    j(path.join(D, 'manifest.json'), manifest);
    log(node, `finalized: reason=${reason} segments=${segs.length} → ${full}`);
    if (wantMp4 && segs.length) {
      // DEFAULT DELIVERABLE: H.264 mp4 — the universally-playable codec. yuv420p +
      // +faststart so it plays in Safari/QuickTime/browsers and streams (moov up front).
      const mp4 = path.join(D, `${node}-full.mp4`);
      execFileSync('ffmpeg', ['-y', '-i', full, '-c:v', 'libx264', '-preset', 'veryfast',
        '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4],
        { stdio: 'ignore' });
      j(path.join(D, 'manifest.json'), { ...manifest, mp4, video: mp4 });  // mp4 = primary deliverable
      log(node, `H.264 mp4 (default deliverable) → ${mp4}`);
    }
  };

  let stopRequested = null;
  const checkControl = () => {
    const c = rj(path.join(D, 'control.json'));
    if (c && c.action === 'stop' && STOP_REASONS.includes(c.reason)) stopRequested = c;
    else if (c) log(node, `IGNORED invalid control: ${JSON.stringify(c)}`);
    return stopRequested;
  };

  // segment loop: one browser session per segment; new segment ONLY after a crash
  let errStreak = 0;
  while (true) {
    segN += 1;
    const segName = `seg-${String(segN).padStart(3, '0')}`;
    let browser, context, page, crashed = false;
    try {
      // CAPTURE-ENGINE NOTE (hard-won): server-side headless Playwright *chromium*
      // does NOT paint the ttyd/xterm terminal — it records a BLANK white video
      // (full-chromium, swiftshader, DOM-renderer, anti-throttle all still blank).
      // The working engine is real Google **Chrome** (channel:'chrome'), e.g. run
      // Mac-side against the node's tailnet attach URL. Make the channel selectable;
      // default stays 'chromium' but a self-recording seedbed MUST set a working one
      // (SEEDREC_CHANNEL=chrome with Chrome installed, or use xvfb+full-chrome /
      // a terminal-native recorder like asciinema — see "self-recording gap" notes).
      browser = await chromium.launch({
        headless: true,
        channel: process.env.SEEDREC_CHANNEL || 'chromium',
        // Stability flags: without --disable-dev-shm-usage (and at 1080p) the
        // recording page crashes ~17s in; --no-sandbox avoids headless sandbox
        // aborts. Pair with a 1280x720 capture (--width/--height) for a stable,
        // hours-long record. The anti-* flags stop rAF throttling of the bg page.
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'],
      });
      context = await browser.newContext({
        viewport: { width: W, height: H },
        recordVideo: { dir: SEG, size: { width: W, height: H } },
      });
      page = await context.newPage();
      page.on('crash', () => { crashed = true; });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      log(node, `${segName}: recording`);
      writeState({ status: 'recording', segment_name: segName });

      // hold open: heartbeat + control poll + ttyd reconnect, forever until stop
      let lastReload = 0;
      // Timed segment rotation: finalize a seg-NNN.webm every ROTATE_MS so capture is
      // continuously VERIFIABLE (segments/bytes grow on disk) and the final video stays a
      // lossless concat. Without this, Playwright writes the .webm only on context close,
      // so a healthy-but-recording daemon shows 0 bytes and the "recording active" gate
      // can't tell real capture from a hung browser (the false-green that bit us).
      const segStart = Date.now();
      const ROTATE_MS = Number(process.env.SEEDREC_ROTATE_MS || 30000);
      while (!checkControl() && !crashed) {
        await new Promise(r => setTimeout(r, POLL_MS));
        writeState({ status: 'recording', segment_name: segName });
        // NO page.evaluate() / CDP round-trip in the hot loop. Evaluating against a
        // LIVE xterm page (busy JS thread, continuous rAF) can hang the CDP channel and
        // jam every subsequent page op → the whole heartbeat/rotation loop freezes a few
        // seconds in and recording silently stops mid-capture (exactly what bit us: bytes
        // froze, heartbeat stale, 1 segment). The loop now does only a file-write heartbeat,
        // an internal isClosed() check, and the rotation timer — zero CDP calls, can't jam.
        if (page.isClosed()) { crashed = true; }
        if (!crashed && Date.now() - segStart > ROTATE_MS) break;  // timed rotation: finalize this segment, loop opens the next
      }

      // graceful close finalizes the webm
      const vid = page.video();
      await context.close();
      const recPath = await vid.path().catch(() => null);
      if (recPath && fs.existsSync(recPath)) {
        fs.renameSync(recPath, path.join(SEG, `${segName}.webm`));
      }
      await browser.close().catch(() => {});

      if (stopRequested) {
        await finalize(stopRequested.reason, stopRequested.mp4);
        writeState({ status: 'stopped', stop_reason: stopRequested.reason });
        process.exit(0);
      }
      // crashed page (not a stop): loop → new segment
      errStreak = 0;
      log(node, `${segName}: page crash/close — rotating to next segment`);
    } catch (e) {
      errStreak += 1;
      log(node, `${segName}: ERROR ${e.message} — salvaging + rotating`);
      try {
        const vid = page && page.video();
        await context?.close().catch(() => {});
        const recPath = vid ? await vid.path().catch(() => null) : null;
        if (recPath && fs.existsSync(recPath)) {
          fs.renameSync(recPath, path.join(SEG, `${segName}.webm`));
        }
        await browser?.close().catch(() => {});
      } catch { /* best effort */ }
      if (checkControl()) { await finalize(stopRequested.reason, stopRequested.mp4); process.exit(0); }
      // growing backoff on a crashloop (never stops on its own — stop is CEO-driven only)
      const backoff = Math.min(60000, 3000 * Math.pow(2, Math.min(errStreak - 1, 5)));
      log(node, `${segName}: backoff ${backoff}ms (errStreak=${errStreak})`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

console.error('usage: seedrec start|stop|status|_daemon <node> [options]');
process.exit(1);
