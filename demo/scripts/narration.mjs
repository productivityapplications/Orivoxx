/**
 * Narration and scene metadata for the Orivoxx attribution demo.
 * Audio is rendered with ElevenLabs; word timings come from the alignment API.
 */
export const SCENES = [
  {
    id: "01",
    title: "The problem",
    file: "scene-01.mp3",
    text: "Forty-seven steps. One failed artifact. The trace shows every hand-off, but it does not say which layer broke. Was it the model, the harness, a tool, or the specification itself? Orivoxx answers that with a deterministic benchmark and a counterfactual proof.",
  },
  {
    id: "02",
    title: "The solution",
    file: "scene-02.mp3",
    text: "Orivoxx benchmarks the whole agent configuration. A versioned task, a sandboxed run, and a static score with no model in the loop. Then it attributes the failure to one of twenty layer and mode cells, and proves the attribution with a replay.",
  },
  {
    id: "03",
    title: "What it measures",
    file: "scene-03.mp3",
    text: "Six metrics: artifact score, steps, tool calls, tokens, cost, and duration. Three chaos modes: tool errors, latency, and context pressure. Across runs, those become a reliability profile: pass at k, score spread, and the layer distribution behind every failure.",
  },
  {
    id: "04",
    title: "One run",
    file: "scene-04.mp3",
    text: "One task, one agent, one model. The agent runs in Docker, with no platform secrets and no internet route. Every model call passes through one allowlisted proxy. The harness records the trace, captures the repository, and scores it statically.",
  },
  {
    id: "05",
    title: "Attribution",
    file: "scene-05.mp3",
    text: "This run fails at forty-nine point seven. The attribution says harness, recovery. Evidence: step two, a write fails with EACCES, and the harness never retries. No guessed root cause. One cell, one rule, one recorded step.",
  },
  {
    id: "06",
    title: "Replay",
    file: "scene-06.mp3",
    text: "The proof is a replay. Steps before the intervention are byte-identical. At step two, we retry the failed write. The remaining actions replay from the record, and the same deterministic engine scores ninety-eight point three. No model call.",
  },
  {
    id: "07",
    title: "Reliability",
    file: "scene-07.mp3",
    text: "Across runs, the leaderboard shows the reliability profile, not a single lucky score. The stacked bar is the layer distribution behind the failures. Compare two agents and the attribution diff shows which layer keeps breaking.",
  },
  {
    id: "08",
    title: "Close",
    file: "scene-08.mp3",
    text: "Orivoxx. Benchmark the agent, not just the model. Run it, attribute it, replay it. The source, the tasks, and the proofs are public at orivoxx dot vercel dot app.",
  },
];

export const HOLD_SECONDS = 0.45;
export const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "SOYHLrjzK2X1ezoPC6cr";
