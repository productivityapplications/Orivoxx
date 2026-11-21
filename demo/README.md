# Orivoxx demo video

`demo/orivoxx-demo.mp4` — 2:10.1, 1920 × 1080, 30 fps, H.264/AAC, −16.3 LUFS, true peak −1.5 dBTP.

![thumbnail](thumbnail.jpg)

## What changed

The old cut was a captioned screen recording. The final cut is a cinematic `/promo` route: real
Playwright UI clips presented inside a browser mockup, Framer Motion typography, a slow green orb,
and the ElevenLabs narration mixed underneath. The raw app is still real; nothing is a mock
dashboard.

## Contents

| File | Purpose |
|---|---|
| `orivoxx-demo.mp4` | Final narrated film |
| `thumbnail.png` / `thumbnail.jpg` | Cover frame from the real-run scene |
| `SCRIPT.md` | Final narration, scene beats, and visual direction |
| `REFERENCE_NOTES.md` | Measured study of the organizer reference |
| `audio/scene-*.mp3` | ElevenLabs narration (Adam, premade) |
| `audio/scene-*.timestamps.json` | ElevenLabs character alignment |
| `recordings/raw-0*.webm` | Raw Playwright UI clips |
| `recordings/promo-raw.webm` | One-take recording of `/promo` (gitignored) |
| `recordings/promo-timeline.json` | Scene starts and durations used by the promo page |
| `scripts/` | Audio, clip, promo recording, and assembly helpers |

## Voice

- Provider: **ElevenLabs**
- Model: `eleven_multilingual_v2`
- Voice: `pNInz6obpgDQGcFmaJgB` (“Adam”, premade)
- The single-scene test returned HTTP 200; the full eight-scene render used `with-timestamps` and
  the premade voice. No library voice is required.

## Pipeline

```bash
# 1. Narration + alignment (ElevenLabs, Adam)
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB \
  node --env-file=.env.local demo/scripts/generate-elevenlabs.mjs

# 2. Build the single promo audio track + shared scene timeline
node demo/scripts/build-promo-audio.mjs

# 3. Raw UI clips for the browser mockup (production build on :3101)
SHOT_BASE_URL=http://127.0.0.1:3101 node demo/scripts/record-raw-clips.mjs
cp demo/recordings/raw-0*.webm apps/web/public/demo/

# 4. Record the hidden /promo route in one take
SHOT_BASE_URL=http://127.0.0.1:3101 node demo/scripts/record-promo.mjs

# 5. Mux the promo recording with the narration and ambient bed
ffmpeg -ss 4.55 -i demo/recordings/promo-raw.webm \
  -i apps/web/public/demo/promo-audio.mp3 \
  -i demo/build/music-bed.wav \
  -filter_complex "[0:v]fps=30,scale=1920:1080,setsar=1[v];[1:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=130.085,atrim=0:130.085,asetpts=PTS-STARTPTS[voice];[2:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,atrim=0:130.085,volume=0.15,afade=t=out:st=127.5:d=2.5[bed];[voice][bed]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
  -map "[v]" -map "[a]" -t 130.085 -c:v libx264 -preset medium -crf 18 \
  -pix_fmt yuv420p -r 30 -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart demo/orivoxx-demo.mp4
```

The `-ss 4.55` trims the Playwright pre-roll to the click. The promo page uses a **wall-clock
timeline** (not `audio.currentTime`), so the recorded scene changes stay in sync even when headless
audio buffers; the narration is muxed separately.

## What the film shows

1. Problem: “AI agents fail. You don’t know why.”
2. Solution: “Orivoxx. Deterministic failure attribution.”
3. Six metrics (steps, tool calls, errors, tokens, cost, duration) and four faults.
4. Real run: the three curated tasks, `slugify-max-length`, Claude Code, and the 100.0 result.
5. Attribution: `Harness × Recovery.` with the real chaos result.
6. Replay proof: 0.0 → 100.0 with a rolling counter and progress bar.
7. Community: “Bring your own tasks. 6 validation gates.”
8. Close: “Benchmark the agent, not just the model.” and `orivoxx.vercel.app`.

## Quality checks

| Check | Result |
|---|---|
| Container | MP4, H.264 + AAC |
| Resolution / fps | 1920 × 1080 / 30 |
| Duration | 130.1 s (limit 180 s) |
| Integrated loudness | −16.3 LUFS |
| True peak | −1.5 dBTP |
| Scene sync | wall-clock timeline; scene cuts match audio starts |
| Visuals | real Playwright recordings inside `/promo` |
| Model calls during recording | none; stored results only |

## Hidden route

`apps/web/src/app/promo/page.tsx` is a recording-only page. It is not linked from the main
navigation. The `framer-motion` dependency is used only there.
