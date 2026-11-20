/**
 * Narration and scene metadata for the final Orivoxx demo.
 * Audio is rendered with ElevenLabs; word timings come from the alignment API.
 */
export const SCENES = [
  {
    id: "01",
    title: "The problem",
    file: "scene-01.mp3",
    text: "An agent fails. The trace lists forty-seven steps, but not the reason. Was it the model, the harness, a tool, or the specification? Orivoxx answers with a deterministic benchmark and a counterfactual proof.",
  },
  {
    id: "02",
    title: "The solution",
    file: "scene-02.mp3",
    text: "Orivoxx benchmarks the whole agent configuration: a real repository task, a sandboxed run, and a static score with no model in the loop. Then it names the failure by layer and mode, and proves the diagnosis with a replay.",
  },
  {
    id: "03",
    title: "What it measures",
    file: "scene-03.mp3",
    text: "Six metrics: steps, tool calls, tool errors, tokens, cost, and duration. Four chaos modes: injected tool errors, failing tools, latency, and context pressure. Across runs they become a reliability profile, not one lucky score.",
  },
  {
    id: "04",
    title: "A real run",
    file: "scene-04.mp3",
    text: "Claude Code runs a real issue from the slugify repository. It edits the runtime and the type declaration. The test command stays hidden. The harness captures the trace, runs the real test inside the sandbox, and the result passes at one hundred.",
  },
  {
    id: "05",
    title: "Attribution",
    file: "scene-05.mp3",
    text: "The chaos run fails at zero. The attribution says harness, recovery. Evidence: step two, the multi-file apply_patch is intercepted, and the harness never retries. One cell, one rule, one recorded step.",
  },
  {
    id: "06",
    title: "Replay proof",
    file: "scene-06.mp3",
    text: "The proof is a replay. The workspace is reconstructed, the intercepted action is applied, dependencies are reinstalled, and the real test command runs again. Zero becomes one hundred. No model call enters the score.",
  },
  {
    id: "07",
    title: "Community tasks",
    file: "scene-07.mp3",
    text: "Anyone can submit a real task. Six mechanical gates run in the same sandbox: clone, install, test fails at base, deterministic times three, time bounded, and license. A curator promotes it. Private tasks stay private.",
  },
  {
    id: "08",
    title: "Close",
    file: "scene-08.mp3",
    text: "Orivoxx. Benchmark the agent, not just the model. Run it, attribute it, replay it. The source, the tasks, and the proofs are public at orivoxx dot vercel dot app.",
  },
];

export const HOLD_SECONDS = 0.45;
export const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "7jynqzOvnVP89nA7TB0m";
