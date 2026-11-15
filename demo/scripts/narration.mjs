/**
 * Narration and scene metadata for the Orivoxx demo.
 * Audio is generated per scene; video is recorded per scene.
 */
export const SCENES = [
  {
    id: "01",
    title: "The problem",
    file: "scene-01.mp3",
    text: "Most agent leaderboards compare models. They hold the harness constant, then report a single number. But the harness is part of the result. The same model can pass a specification with one tool loop, and miss a critical check with another. Orivoxx benchmarks the whole configuration: the model, the harness, the tools, the orchestration, and the stopping conditions.",
    captions: [
      "Most agent leaderboards compare models",
      "The harness is part of the result",
      "Benchmark the whole configuration",
    ],
  },
  {
    id: "02",
    title: "Versioned tasks and the sandbox",
    file: "scene-02.mp3",
    text: "Every benchmark is a versioned task. TaskBoard asks an agent to build owner-scoped project access in a small Next.js app. The task pins its specification, its ruleset, and its scoring configuration. The agent runs inside a Docker sandbox with no platform secrets and no internet route. Its only model access is an allowlisted proxy.",
    captions: [
      "Every benchmark is a versioned task",
      "Spec, ruleset, scoring config",
      "No platform secrets",
      "Model access through one proxy",
    ],
  },
  {
    id: "03",
    title: "Leaderboard",
    file: "scene-03.mp3",
    text: "Here is the leaderboard. One task, one model, two harnesses. The Python agent loop and Aider both score ninety-seven point three. A second run of the same Python harness on a different model scores ninety-eight point one. The model and the adapter are recorded on every row, so the comparison is explicit.",
    captions: [
      "One task, one model, two harnesses",
      "Python and Aider: 97.3",
      "Second model: 98.1",
      "Model and adapter on every row",
    ],
  },
  {
    id: "04",
    title: "The scorecard and the rules",
    file: "scene-04.mp3",
    text: "Open a result. The overall score is ninety-seven point three. Spec conformance and security both score one hundred. Maintainability scores eighty-two. Below the score, every requirement is a row. Expand it to see the declared rule, the source path, and the outcome. A critical failure would cap the score at fifty-nine point nine, and the cap would be shown above this number, never hidden.",
    captions: [
      "97.3 overall",
      "Spec 100, security 100",
      "Every requirement is a row",
      "Caps are shown, never hidden",
    ],
  },
  {
    id: "05",
    title: "Static evidence",
    file: "scene-05.mp3",
    text: "The produced-code diff is stored as bounded text, and rendered as escaped text, never as HTML. The score is computed statically. No produced code is executed. No model is consulted. Running the same repository against the same versions gives the same score, and every row carries the fingerprint that ties it to that repository.",
    captions: [
      "Diff is bounded text",
      "No produced code executed",
      "No model in the score",
      "Fingerprint on every row",
    ],
  },
  {
    id: "06",
    title: "Compare and self-serve",
    file: "scene-06.mp3",
    text: "Compare two harnesses on the same task. Bench deltas and a requirement matrix show exactly where they diverge. Then try it yourself. The fake baseline materializes a checked-in fixture, captures it, and scores it with the same pipeline. It makes no model call, and it creates a real, immutable result.",
    captions: [
      "Same model, two harnesses",
      "Bench deltas and a matrix",
      "Fake baseline, no model call",
      "A real immutable result",
    ],
  },
  {
    id: "07",
    title: "Under the hood",
    file: "scene-07.mp3",
    text: "Under the hood, every run is versioned end to end. Task, ruleset, scoring configuration, and adapter version are recorded with the repository fingerprint. Results are append-only, and the diff is bounded text, never full source. Real runs execute in Docker; the public app only reads.",
    captions: [
      "Versioned end to end",
      "Fingerprint on every row",
      "Append-only results",
      "Real runs in Docker",
    ],
  },
  {
    id: "08",
    title: "Close",
    file: "scene-08.mp3",
    text: "Orivoxx. Benchmark the agent, not just the model. Deterministic scoring, sandboxed execution, and every point traceable to a named rule and evidence. The source, the tasks, and the recorded results are public.",
    captions: [
      "Benchmark the agent",
      "Not just the model",
      "Every point traceable",
    ],
  },
];

export const HOLD_SECONDS = 0.35;
