# Reference video study

Source: `demo/reference/reference.mp4` (organizer reference; gitignored, not redistributed).
Studied 18 November 2026. Frames extracted at 2 fps to `demo/reference/frames/` (306 frames).

## Technical

| Property | Value |
|---|---|
| Duration | 153.05 s (2:33) |
| Resolution | 1280 × 720 |
| Frame rate | 30 fps |
| Video | H.264, ~328 kb/s |
| Audio | AAC, 48 kHz stereo, ~128 kb/s |

## Measurements

### Cut rhythm

- **17 transitions** in 153 s.
- **Average shot length: 8.8 s.** Median 7.5 s, shortest 2.0 s, longest 16.5 s.
- There are long holds on a single animated screen (23.5–39.0 s, 15.5 s; 96.5–108.5 s, 12 s) and short bridge cards (2.0–2.6 s).
- Transitions cluster at narrative beats, not on a fixed timer.

### Transition types

| Type | Share | Evidence |
|---|---:|---|
| Cross-dissolve, 0.3–0.5 s | ≈65% | 16.65→17.05 s title card dissolves into the 407.1K stat; 132.60→133.00 s document dissolves into the CLI card; 39.00 s and 55.50 s show 3–4 intermediate blended frames |
| Hard cut | ≈30% | 23.50 s dashboard appears in one frame (frame diff 11.3, next frame 0.9); 115.00 s stat card appears in one frame; 141.50 s hard cut to the near-white end card |
| Fade from black | ≈5% | 0.00–0.50 s black/gray, first title card at 1.00 s |
| Slide / zoom / whip | 0% | No lateral motion or scale transition observed in any cut |

### Narration cadence

ASR transcript: 344 words, 28 sentence-like segments, speech from 0.59 s to 149.81 s.

- **138.3 words per minute.**
- **Sentence length:** mean 12.3 words, median 12, range 4–21.
- **Pauses:** 42 gaps > 0.15 s; median 1.18 s; 30 > 0.5 s; 26 > 0.8 s; 21 > 1.2 s; longest 4.09 s.
- Typical sentence: 3.4–5.3 s (e.g. 25.87–30.97 s, 19 words, 5.1 s).
- The longest pause (55.23 + 4.09 s) sits on a scene change; pauses are used as punctuation, not silence for its own sake.
- Pace is measured and explanatory, with emphasis rather than speed.

### Lower-third style

- **Word-synced highlight caption.** The full phrase stays on screen; the currently spoken word is bold white, the remainder muted green-gray. Confirmed at 2.2–3.2 s: “comes down to one test.” highlights *comes* → *down* → *to*.
- **Position:** horizontally centred, baseline ≈ 690 px of 720 (≈ 96% of frame height), sitting directly on the green gradient band.
- **Size:** ≈ 24 px at 720p (≈ 36 px at 1080p); medium weight; sentence case; no punctuation in most phrases.
- **No box, no background plate.** Contrast comes from the dark green band at the bottom of the frame.
- **On-screen duration:** phrase changes every 2.0 s median (range 1.5–6.5 s, 61 detected changes). Individual word highlights last ≈ 0.3–0.5 s.
- **Entry/exit:** no slide or scale. Phrases swap in place; the emphasis change is a weight/colour change. The band itself is part of the scene background.

### Intro (first 5 s)

- 0.00–0.50 s: near-black frame.
- 1.00 s: white title card appears with the question “Does NEAR’s usage pay for its own issuance?”
- 1.0–5.0 s: a green underline draws beneath the question; no logo, no channel ident.
- 5.0–9.0 s: the first diagram cards animate in under the same headline.

### Outro (last 5 s)

- 141.50 s: hard cut to a warm-white end card.
- 142.10 s: circular logo fades in.
- 144.0–147.0 s: “A thesis you can check, re-run, and watch update.” appears line by line.
- 148.0 s: `nearinsight.xyz` appears as plain text.
- 148–153 s: static hold. No CTA button, no social handles, no logo animation.

### Music

- **Continuous instrumental bed under the whole video.** It never drops out.
- Narration gaps measure **−16.8 to −18.2 dBFS RMS** with peaks around −5 dB; the full mix measures −16.7 dBFS RMS. The bed is therefore only **≈4–6 dB below the speech mix** — audible, not wallpaper.
- No sung vocals detected; the bed is low-dynamic-range and harmonic. Inferred genre: minimal electronic / ambient pulse.
- Speech and music are mixed together; there is no ducking to silence.

### Colour and grade

- High-key **white/near-white cards** (`#F7FBF8`) on a **mint-to-emerald gradient** (`#8CEBC0` → `#075E46`).
- Text on cards is near-black green (`#0A1F17`); accent green (`#16A36A`); amber/red only for status.
- Soft radial gradient behind the card, no grain or film emulation.
- The video alternates between light cards and dark dashboard chrome, but the frame background stays green.

---

## Matched

1. **Word-synced lower-third captions, centred at 96% height** (observed 2.2–3.2 s). Orivoxx will use phrase captions with the spoken word highlighted, same position and no plate.
2. **Question-first cold open with an underline draw** (1.0–5.0 s). Orivoxx opens on “Why did the agent fail?” with the same underline gesture.
3. **Cross-dissolves at narrative beats, ~0.4 s** (16.65–17.05 s, 132.60–133.00 s). Orivoxx uses dissolves between its five acts and hard cuts only for emphasis.
4. **Measured 138 WPM narration with 1–2 s sentence pauses** and longer beats at scene changes (25.87–30.97 s; pause at 55.23 s). The new script is timed to the same cadence.
5. **Plain-text URL outro held for several seconds, no CTA button** (148–153 s). Orivoxx closes on the tagline plus `orivoxx.vercel.app`, held.
6. **Low continuous music bed, roughly 5 dB under narration** (gaps at 55.23 s and 139.67 s). Orivoxx uses an original low ambient bed at the same relative level.

## Deliberately different

1. **Dark product, not a white card on green.** The reference is high-key; Orivoxx is a dark developer tool (`#0B0B09`). The frame background is near-black, and the accent is emerald (`#17CF97`), not a mint gradient.
2. **No white title cards.** The reference cuts to white question cards (1.0 s, 39.0 s, 59.0 s). Orivoxx uses dark typographic cards with a thin grid and mono section labels, so the product stays one continuous world.
3. **Real product chrome, not a mock dashboard.** The reference builds a stylised NEAR dashboard. Orivoxx records the actual Playwright-driven app: leaderboard, result, attribution card, replay.
4. **No decorative metric animation.** The reference counts numbers and draws bars as spectacle (17.05–17.45 s, 80.0–83.5 s). Orivoxx shows real values and real traces; only the cursor and scroll move.
5. **No licensed music track.** The bed is an original generated ambient pad, not a library track; it is mixed lower (−26 LUFS) than the reference to keep technical narration intelligible.
6. **Scene length driven by the product, not a fixed 8.8 s.** Orivoxx cuts when the UI action completes; average target 8–10 s, with short 3–4 s bridges.
