# Orivoxx demo — script

Voice: ElevenLabs `eleven_multilingual_v2`, voice id from `ELEVENLABS_VOICE_ID`.
Pronunciation: “OR-ih-vox”. Casing: Orivoxx.
Tone: calm, precise, explanatory. No hype, no exclamation marks.
Total target: 2:35–2:45. Hard limit: 3:00.
Captions: Inter, lower third, 3–7 words per phrase, matching the audio.

## Scene 1 — The problem (0:00–0:22)

**Narration**

Most agent leaderboards compare models. They hold the harness constant, then report a single number. But the harness is part of the result. The same model can pass a specification with one tool loop, and miss a critical check with another. Orivoxx benchmarks the whole configuration: the model, the harness, the tools, the orchestration, and the stopping conditions.

**Visual:** landing hero, then the leaderboard preview. Slow scroll from the tagline to the task cards.

**Captions:** “Most agent leaderboards compare models” · “The harness is part of the result” · “Benchmark the whole configuration”

## Scene 2 — Versioned tasks and the sandbox (0:22–0:44)

**Narration**

Every benchmark is a versioned task. TaskBoard asks an agent to build owner-scoped project access in a small Next.js app. The task pins its specification, its ruleset, and its scoring configuration. The agent runs inside a Docker sandbox with no platform secrets and no internet route. Its only model access is an allowlisted proxy.

**Visual:** `/benchmarks`, then `/benchmarks/taskboard`. Scroll to the version strip and requirement table.

**Captions:** “Every benchmark is a versioned task” · “Spec, ruleset, scoring config” · “No platform secrets” · “Model access through one proxy”

## Scene 3 — Leaderboard (0:44–1:02)

**Narration**

Here is the leaderboard. One task, one model, two harnesses. The Python agent loop and Aider both score ninety-seven point three. A second run of the same Python harness on a different model scores ninety-eight point one. The model and the adapter are recorded on every row, so the comparison is explicit.

**Visual:** `/leaderboard`. Move through the Agents, All, and Baselines filters. Hover a row, then open the Python result.

**Captions:** “One task, one model, two harnesses” · “Python and Aider: 97.3” · “Second model: 98.1” · “Model and adapter on every row”

## Scene 4 — The scorecard and the rules (1:02–1:26)

**Narration**

Open a result. The overall score is ninety-seven point three. Spec conformance and security both score one hundred. Maintainability scores eighty-two. Below the score, every requirement is a row. Expand it to see the declared rule, the source path, and the outcome. A critical failure would cap the score at fifty-nine point nine, and the cap would be shown above this number, never hidden.

**Visual:** `/results/<python result>`. Scroll from the score to the version strip, then expand two requirement rows.

**Captions:** “97.3 overall” · “Spec 100, security 100” · “Every requirement is a row” · “Caps are shown, never hidden”

## Scene 5 — Static evidence (1:26–1:47)

**Narration**

The produced-code diff is stored as bounded text, and rendered as escaped text, never as HTML. The score is computed statically. No produced code is executed. No model is consulted. Running the same repository against the same versions gives the same score, and every row carries the fingerprint that ties it to that repository.

**Visual:** scroll through the diff, then the version strip and fingerprint. Return to the requirement list.

**Captions:** “Diff is bounded text” · “No produced code executed” · “No model in the score” · “Fingerprint on every row”

## Scene 6 — Compare and self-serve (1:47–2:06)

**Narration**

Compare two harnesses on the same task. Bench deltas and a requirement matrix show exactly where they diverge. Then try it yourself. The fake baseline materializes a checked-in fixture, captures it, and scores it with the same pipeline. It makes no model call, and it creates a real, immutable result.

**Visual:** `/compare?task=taskboard`, then `/submit`. Choose the regressed fixture, run it, and land on the capped result.

**Captions:** “Same model, two harnesses” · “Bench deltas and a matrix” · “Fake baseline, no model call” · “A real immutable result”

## Scene 7 — Under the hood (2:06–2:24)

**Narration**

Under the hood, every run is versioned end to end. Task, ruleset, scoring configuration, and adapter version are recorded with the repository fingerprint. Results are append-only, and the diff is bounded text, never full source. Real runs execute in Docker; the public app only reads.

**Visual:** a capped TaskBoard result (59.9), cap banner, version strip, then `/docs/scoring`.

**Captions:** “Versioned end to end” · “Fingerprint on every row” · “Append-only results” · “Real runs in Docker”

## Scene 8 — Close (2:24–2:39)

**Narration**

Orivoxx. Benchmark the agent, not just the model. Deterministic scoring, sandboxed execution, and every point traceable to a named rule and evidence. The source, the tasks, and the recorded results are public.

**Visual:** `/docs` scoring section, then the home leaderboard. End on the tagline.

**Captions:** “Benchmark the agent” · “Not just the model” · “Every point traceable”

## Production notes

- Generate one audio file per scene. Scene duration = audio + 0.45 s hold.
- Narration provider: ElevenLabs was attempted first. The configured voice is a library voice that the free plan rejects (HTTP 402), and the remaining character quota covered only three scenes. The shipped narration is the local Piper fallback, one consistent voice for all eight scenes. See `demo/README.md`.
- Record one Playwright video per scene at 1920×1080. Trim to the scene duration; if short, hold the last frame.
- Normalize the final mix to −16 LUFS, true peak −1.5 dB.
- No music. No talking head. No stock footage. Hard cuts only.
- Burn captions into the video with Inter at 46 px, white on a 55% black plate, bottom center.
- Keep the toolbar out of frame: viewport is the app, not browser chrome.
