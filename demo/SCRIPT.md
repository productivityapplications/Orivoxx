# Orivoxx demo — script

Voice: ElevenLabs `eleven_multilingual_v2`, voice ID `SOYHLrjzK2X1ezoPC6cr` (“Harry”, premade).
Pronunciation: “OR-ih-vox”. Casing: Orivoxx. Tone: calm, precise, explanatory.
Final cut: 2:21.5, 1920×1080, 30 fps, −15.9 LUFS, true peak −1.5 dBTP.
Reference study: `demo/REFERENCE_NOTES.md`. Each scene names the technique it adapts.

## Timing

| Scene | In | Out | Audio | Visual |
|---|---:|---:|---:|---|
| 1 Problem | 0:00 | 0:20 | 19.4s | Landing hero → problem diagram |
| 2 Solution | 0:20 | 0:36 | 16.0s | Solution pillars → attribution card |
| 3 Measurement | 0:36 | 0:59 | 22.6s | Six metrics → leaderboard reliability |
| 4 One run | 0:59 | 1:18 | 17.9s | Real 96.4 result → metrics → trace |
| 5 Attribution | 1:18 | 1:38 | 20.3s | Attributed 49.7 result → evidence |
| 6 Replay | 1:38 | 1:55 | 16.6s | Replay 49.7 → 98.3, highlighted step |
| 7 Reliability | 1:55 | 2:11 | 14.8s | Leaderboard bars → compare deltas |
| 8 Close | 2:11 | 2:24 | 12.8s | App home → tagline |

## Scene 1 — The problem (0:00–0:20)

**Narration**

Forty-seven steps. One failed artifact. The trace shows every hand-off, but it does not say which layer broke. Was it the model, the harness, a tool, or the specification itself? Orivoxx answers that with a deterministic benchmark and a counterfactual proof.

**Visual:** landing hero, then the five-layer hand-off diagram.

**Reference:** matches the question-first cold open (REFERENCE_NOTES 1.0–5.0s) and the dissolve into the problem diagram (16.65–17.05s). Deliberately different: dark UI, no white title card.

## Scene 2 — The solution (0:20–0:36)

**Narration**

Orivoxx benchmarks the whole agent configuration. A versioned task, a sandboxed run, and a static score with no model in the loop. Then it attributes the failure to one of twenty layer and mode cells, and proves the attribution with a replay.

**Visual:** solution pillars, then the real attribution card.

**Reference:** mirrors the reference's “one layer, zero hand-offs” solution section (≈39.0–55.5s): a thesis, three numbered rows, one artifact. The artifact is a real result, not a mock.

## Scene 3 — What it measures (0:36–0:59)

**Narration**

Six metrics: artifact score, steps, tool calls, tokens, cost, and duration. Three chaos modes: tool errors, latency, and context pressure. Across runs, those become a reliability profile: pass at k, score spread, and the layer distribution behind every failure.

**Visual:** measurement grid, then the leaderboard preview with reliability bars.

**Reference:** matches the measured, list-like explanation cadence (138 WPM, 1–2s pauses; REFERENCE_NOTES “Narration cadence”). Captions are word-synced.

## Scene 4 — One run (0:59–1:18)

**Narration**

One task, one agent, one model. The agent runs in Docker, with no platform secrets and no internet route. Every model call passes through one allowlisted proxy. The harness records the trace, captures the repository, and scores it statically.

**Visual:** a real 96.4 result: scorecard, six metrics, trace rows.

**Reference:** the reference holds a single product surface for 12–15s (23.5–39.0s; 96.5–108.5s). This scene holds one result page and scrolls it, rather than cutting every 2s.

## Scene 5 — Attribution (1:18–1:38)

**Narration**

This run fails at forty-nine point seven. The attribution says harness, recovery. Evidence: step two, a write fails with EACCES, and the harness never retries. No guessed root cause. One cell, one rule, one recorded step.

**Visual:** the attributed 49.7 result, attribution card, evidence and trace highlight.

**Reference:** matches the reference's “verdict at the top is written from the numbers” pattern (25.9–31.0s): the conclusion is visible before the supporting detail. The supporting detail is a real trace, not an animated chart.

## Scene 6 — Replay (1:38–1:55)

**Narration**

The proof is a replay. Steps before the intervention are byte-identical. At step two, we retry the failed write. The remaining actions replay from the record, and the same deterministic engine scores ninety-eight point three. No model call.

**Visual:** replay page: 49.7 → 98.3, intervention at step 2, highlighted trace rows.

**Reference:** matches the reference's proof-by-side-by-side card (115–120s) with a dark, technical treatment instead of a white card.

## Scene 7 — Reliability (1:55–2:11)

**Narration**

Across runs, the leaderboard shows the reliability profile, not a single lucky score. The stacked bar is the layer distribution behind the failures. Compare two agents and the attribution diff shows which layer keeps breaking.

**Visual:** leaderboard reliability bars, then compare metrics and attribution cards.

**Reference:** matches the reference's “two independent figures, side by side” (115–126s), adapted to a leaderboard plus comparison.

## Scene 8 — Close (2:11–2:24)

**Narration**

Orivoxx. Benchmark the agent, not just the model. Run it, attribute it, replay it. The source, the tasks, and the proofs are public at orivoxx dot vercel dot app.

**Visual:** app home recent runs, then the landing tagline.

**Reference:** matches the plain-text URL outro (148–153s), held, with no CTA button or logo sting. Deliberately different: dark product, not a white end card.

## Production notes

- Audio: ElevenLabs `with-timestamps`, one file per scene; word timings drive ASS karaoke captions.
- Video: Playwright at 1920×1080, each scene held to `audio + 0.45s`.
- Captions: Inter 44px, white primary / muted secondary, semi-transparent band, 0.35s cross-dissolves.
- Music: original generated ambient bed at `volume=0.22`, mixed under narration; no licensed track.
- Final: `loudnorm=I=-16:TP=-1.5:LRA=11`.
- No Talking head, no stock footage, no mock dashboards.
