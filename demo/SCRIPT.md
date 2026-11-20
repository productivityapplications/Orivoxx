# Orivoxx demo — final script

Voice: ElevenLabs `eleven_multilingual_v2`, premade voice `SOYHLrjzK2X1ezoPC6cr` (“Harry”).
Pronunciation: “OR-ih-vox”. Casing: Orivoxx. Tone: calm, precise, explanatory.
Target: 8 scenes, ≤ 3:00, 1920×1080, 30 fps, −16 LUFS, true peak ≤ −1.5 dBTP.
Reference study: `demo/REFERENCE_NOTES.md`. Each scene names the technique it adapts.

The production ElevenLabs account cannot use library/professional voices, so the cut uses the
premade “Harry” voice. The configured `.env.local` voice id is overridden at render time.

## Timing

| Scene | In | Out | Narration | Visual |
|---|---:|---:|---:|---|
| 1 Problem | 0:00 | 0:20 | ~19s | Landing hero → problem section |
| 2 Solution | 0:20 | 0:38 | ~18s | App control room → attribution proof |
| 3 Metrics | 0:38 | 0:58 | ~20s | Six metrics → four chaos modes |
| 4 Real run | 0:58 | 1:21 | ~23s | Real tasks → slugify result |
| 5 Attribution | 1:21 | 1:42 | ~21s | `res_c1ba8d7b…` result → evidence |
| 6 Replay | 1:42 | 2:02 | ~20s | Replay page 0.0 → 100.0 |
| 7 Community | 2:02 | 2:23 | ~21s | `/tasks/new` → six gates → promoted task |
| 8 Close | 2:23 | 2:40 | ~17s | App home → landing tagline |

Exact cuts are driven by the generated audio plus a 0.45s hold and 0.35s cross-dissolves.

## Scene 1 — The problem

**Narration**

An agent fails. The trace lists forty-seven steps, but not the reason. Was it the model, the
harness, a tool, or the specification? Orivoxx answers with a deterministic benchmark and a
counterfactual proof.

**Visual:** landing hero, then the problem section.

**Reference:** question-first cold open and dissolve into the problem diagram (REFERENCE_NOTES
1.0–5.0s, 16.65–17.05s). Dark product, no white title card.

## Scene 2 — The solution

**Narration**

Orivoxx benchmarks the whole agent configuration: a real repository task, a sandboxed run, and a
static score with no model in the loop. Then it names the failure by layer and mode, and proves the
diagnosis with a replay.

**Visual:** `/app` control room → the `0.0 → 100.0` proof card.

**Reference:** thesis, numbered rows, one real artifact (≈39.0–55.5s). The artifact is a stored
result, not a mock.

## Scene 3 — What it measures

**Narration**

Six metrics: steps, tool calls, tool errors, tokens, cost, and duration. Four chaos modes: injected
tool errors, failing tools, latency, and context pressure. Across runs they become a reliability
profile, not one lucky score.

**Visual:** the six-metric grid, then the four chaos cards; a short leaderboard reliability bar.

**Reference:** measured, list-like cadence (138 WPM, 1–2s pauses). Word-synced captions.

## Scene 4 — A real run

**Narration**

Claude Code runs a real issue from the slugify repository. It edits the runtime and the type
declaration. The test command stays hidden. The harness captures the trace, runs the real test
inside the sandbox, and the result passes at one hundred.

**Visual:** `/tasks` catalogue with `slugify-max-length`, `is-email-predicate`, and
`itsdangerous-future-signature`; then `/tasks/slugify-max-length`; then the Claude result
`res_85394cc5…` at 100.0.

**Reference:** hold one product surface for 12–15s (23.5–39.0s; 96.5–108.5s). Scroll the result
instead of cutting every two seconds.

## Scene 5 — Attribution

**Narration**

The chaos run fails at zero. The attribution says harness, recovery. Evidence: step two, the
multi-file apply_patch is intercepted, and the harness never retries. One cell, one rule, one
recorded step.

**Visual:** `/results/res_c1ba8d7b…`; the attribution card, evidence line, and trace highlight.

**Reference:** verdict first, then supporting detail (≈25.9–31.0s). The detail is a real trace.

## Scene 6 — Replay proof

**Narration**

The proof is a replay. The workspace is reconstructed, the intercepted action is applied,
dependencies are reinstalled, and the real test command runs again. Zero becomes one hundred. No
model call enters the score.

**Visual:** `/replay/res_c1ba8d7b…`; baseline 0.0, counterfactual 100.0, retry at step 2, three
replayed steps.

**Reference:** proof-by-side-by-side card (115–120s), dark technical treatment.

## Scene 7 — Community tasks

**Narration**

Anyone can submit a real task. Six mechanical gates run in the same sandbox: clone, install, test
fails at base, deterministic times three, time bounded, and license. A curator promotes it. Private
tasks stay private.

**Visual:** `/tasks/new` form, then `/tasks/is-decimal-800937e9` with the six gates, then the
promoted community task in `/tasks`.

**Reference:** “two independent figures, side by side” (115–126s), adapted to a form and a gate
list.

## Scene 8 — Close

**Narration**

Orivoxx. Benchmark the agent, not just the model. Run it, attribute it, replay it. The source, the
tasks, and the proofs are public at orivoxx dot vercel dot app.

**Visual:** `/app` recent runs, then the landing tagline and URL.

**Reference:** plain-text URL outro, held, no CTA button or logo sting (148–153s). Dark product.

## Production notes

- Audio: ElevenLabs `with-timestamps`, one file per scene; word timings drive ASS karaoke captions.
- Voice: premade `SOYHLrjzK2X1ezoPC6cr`; the account cannot use library voices via the API.
- Video: Playwright at 1920×1080; each scene held to `audio + 0.45s`.
- Captions: Inter 44px, white primary / muted secondary, semi-transparent band, no overlap.
- Music: original generated ambient bed at `volume=0.22`, mixed under narration.
- Final: `loudnorm=I=-16:TP=-1.5:LRA=11`.
- No talking head, no stock footage, no mock dashboards.
