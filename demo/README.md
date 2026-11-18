# Orivoxx demo video

`demo/orivoxx-demo.mp4` — 2:21.5, 1920 × 1080, 30 fps, H.264/AAC, −15.9 LUFS, true peak −1.5 dBTP.

![thumbnail](thumbnail.jpg)

## Contents

| File | Purpose |
|---|---|
| `orivoxx-demo.mp4` | Final narrated demo |
| `thumbnail.png` / `thumbnail.jpg` | Cover frame from the attribution/replay result |
| `SCRIPT.md` | Narration, visuals, captions, timings, reference citations |
| `REFERENCE_NOTES.md` | Measured study of the organizer reference |
| `audio/scene-*.mp3` | ElevenLabs narration used in the cut |
| `audio/scene-*.timestamps.json` | ElevenLabs character alignment used for word-synced captions |
| `audio/test-scene-01.mp3` | Required single-scene ElevenLabs test render |
| `recordings/scene-*.webm` | Raw Playwright screen recordings (gitignored) |
| `build/` | Segments, ASS captions, music bed (gitignored) |
| `scripts/` | Audio generation, recording, assembly |

## Voice

- Provider: **ElevenLabs**
- Model: `eleven_multilingual_v2`
- Voice: `SOYHLrjzK2X1ezoPC6cr` (“Harry”, premade)
- Test render: `audio/test-scene-01.mp3` (19.25s, mean −23.1 dB, peak −5.2 dB) before the full render.
- The full render used `with-timestamps` so captions highlight the spoken word instead of guessing timing.

No Piper fallback was used in the shipped cut. If ElevenLabs fails, `generate-piper-audio.mjs` and the old Piper WAVs under `audio/piper/` remain available, but the assembler expects MP3 + timestamp files; swapping voices is a deliberate step, never silent.

## Pipeline

```bash
# 1. Narration + alignment (ElevenLabs)
node --env-file=.env.local demo/scripts/generate-elevenlabs.mjs

# 2. Screen recordings (production build on :3101)
SHOT_BASE_URL=http://127.0.0.1:3101 node demo/scripts/record-scenes.mjs

# 3. Assemble: segments, ASS karaoke captions, dissolves, music, loudnorm
node demo/scripts/assemble.mjs
```

## What the video shows

1. The problem: a trace shows what happened, not why.
2. The solution: deterministic score + counterfactual attribution.
3. Six metrics, three chaos modes, reliability profile.
4. A real 96.4 result: scorecard, metrics, trace.
5. A real 49.7 failure attributed to `harness × recovery`.
6. Replay proof: 49.7 → 98.3, intervention at step 2.
7. Leaderboard reliability bars and comparison.
8. Tagline and URL.

## Reference application

Measured in `REFERENCE_NOTES.md`:

- Question-first cold open with an underline draw → Scene 1.
- Cross-dissolves around 0.35–0.5s → all scene transitions.
- Word-synced lower-third at 96% height → every scene, via ASS `\k` tags.
- 138 WPM with 1–2s sentence pauses → narration timing.
- Plain URL outro, no CTA button → Scene 8.
- Continuous low music bed → original generated pad at `volume=0.22`.

Deliberately different: dark UI (not white cards on green), real product chrome (not a mock dashboard), no decorative metric animation, no licensed music.

## Quality checks

| Check | Result |
|---|---|
| Container | MP4, H.264 + AAC |
| Resolution / fps | 1920 × 1080 / 30 |
| Duration | 141.5 s (limit 180 s) |
| Integrated loudness | −15.9 LUFS |
| True peak | −1.5 dBTP |
| Caption overlap | none (ASS lines are non-overlapping) |
| Narration per scene | 8/8 |
| Visuals | real Playwright recordings only |
| Model calls during recording | none (stored results and fake baseline only) |
