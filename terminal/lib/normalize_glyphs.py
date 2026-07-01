#!/usr/bin/env python3
"""Normalize the handful of TUI codepoints that NO monospace Nerd Font covers
to visually-identical glyphs that JetBrainsMono Nerd Font Mono DOES have.

This is part of the asciinema->video recorder pipeline: the recorded .cast is
byte-faithful, but a couple of glyphs (Miscellaneous-Technical block) have no
monospace font with coverage, so agg would render them as tofu. We map them to
their identical-looking siblings so the rendered video matches what the agent's
terminal actually showed.
"""
import json, sys

# missing-codepoint -> visually-equivalent covered-codepoint.
# Verified against the bundled JetBrainsMono Nerd Font Mono charset (fc-query):
# every key below is NOT in the font (would render as tofu), every value IS.
# The Claude Code TUI uses all of these; the original kit only mapped the first
# two, so a real session's spinner/record/braille glyphs still tofu'd.
REMAP = {
    0x23F5: 0x25B6,  # ⏵ -> ▶  bypass-permissions mode indicator
    0x23BF: 0x2514,  # ⎿ -> └  tool-call output corner
    0x23FA: 0x25CF,  # ⏺ -> ●  record / assistant-message bullet
    0x2733: 0x2736,  # ✳ -> ✶  spinner frame (eight-spoked asterisk)
    0x273B: 0x2736,  # ✻ -> ✶  spinner frame (teardrop-spoked asterisk)
    0x2722: 0x2736,  # ✢ -> ✶  spinner frame (four-teardrop-spoked asterisk)
    0x273D: 0x2736,  # ✽ -> ✶  spinner frame (heavy teardrop-spoked asterisk)
    0x2802: 0x00B7,  # ⠂ -> ·  startup braille spinner dot
    0x2810: 0x00B7,  # ⠐ -> ·  startup braille spinner dot
}
TBL = {k: chr(v) for k, v in REMAP.items()}

src, dst = sys.argv[1], sys.argv[2]
n = 0
with open(src) as f, open(dst, "w") as o:
    o.write(f.readline())  # header passthrough
    for line in f:
        line = line.rstrip("\n")
        if not line:
            continue
        t, typ, data = json.loads(line)
        if typ == "o":
            new = data.translate(TBL)
            if new != data:
                n += data != new and sum(data.count(chr(k)) for k in REMAP)
            data = new
        o.write(json.dumps([t, typ, data]) + "\n")
print(f"{dst}: normalized {n} glyph(s)")
