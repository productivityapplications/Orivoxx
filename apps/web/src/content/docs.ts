export type DocBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; text: string; label?: string }
  | { type: "table"; head: string[]; rows: string[][] };

export interface DocSection {
  slug: string;
  title: string;
  summary: string;
  blocks: DocBlock[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    slug: "overview",
    title: "Overview",
    summary: "What Orivoxx measures and why the score is deterministic.",
    blocks: [
      {
        type: "p",
        text: "Orivoxx benchmarks AI software-engineering agents: the model, the harness, the tools, the orchestration, and the stopping conditions as one configuration. A versioned task supplies a PROJECT_SPEC.md. The harness runs the agent in an isolated Docker sandbox, captures the produced repository, and the deterministic engine scores it on spec conformance, security patterns, and structural maintainability.",
      },
      {
        type: "p",
        text: "Every point traces to a named rule and evidence. The model is never in the score path. Optional explanations are a separate, explicit action and cannot change a number.",
      },
      { type: "h2", text: "What is measured" },
      {
        type: "list",
        items: [
          "Spec conformance (60%): declared deterministic checks from the task ruleset.",
          "Security patterns (25%): absence of shell-execution dependencies, environment files, dynamic evaluation, and other declared rules.",
          "Structural maintainability (15%): import cycles, fan-out, orphan ratio, and module count from static analysis.",
        ],
      },
      { type: "h2", text: "What is not measured" },
      {
        type: "list",
        items: [
          "Model quality in the abstract. Two harnesses on one model can score differently.",
          "Runtime performance or test execution. The scoring engine never runs produced code.",
          "Subjective style. There is no LLM judge and no preference model.",
        ],
      },
    ],
  },
  {
    slug: "how-it-works",
    title: "How it works",
    summary: "Task, sandbox, capture, static analysis, immutable result.",
    blocks: [
      {
        type: "code",
        label: "one run",
        text: "task + ruleset + scoring config\n        ↓\nDocker sandbox (no platform secrets, allowlisted model proxy)\n        ↓\ncaptured repository (bounded text, redacted, fingerprinted)\n        ↓\ndeterministic checks + static import graph\n        ↓\nscorecard + requirement outcomes + produced-code diff\n        ↓\nappend-only result store",
      },
      {
        type: "p",
        text: "The sandbox is the only place an agent runs. It has a read-only root filesystem, a non-root user, bounded CPU/memory/PIDs/time, and no route to the internet except an allowlisted model proxy. The scoring engine receives normalized text, not an execution handle.",
      },
      { type: "h2", text: "Reproducibility" },
      {
        type: "p",
        text: "Every leaderboard-valid result records taskVersion, rulesetVersion, scoringConfigVersion, adapterVersion, and a repository fingerprint. A row missing any of them is rejected by the store schema.",
      },
    ],
  },
  {
    slug: "benchmarks",
    title: "Benchmarks",
    summary: "TaskBoard and Linkstash, versioning, and what a task contains.",
    blocks: [
      {
        type: "p",
        text: "A benchmark task is immutable per version: a PROJECT_SPEC.md, a starting repository, a ruleset of deterministic requirements, a scoring configuration, a time limit, and a network mode. Changing any of them requires a new version.",
      },
      { type: "h2", text: "TaskBoard" },
      {
        type: "p",
        text: "A small Next.js task board. The agent must build owner-scoped project access, a structured-error project route, and a task list that reads through the repository layer. Nine requirements: eight spec and one security, with two critical checks.",
      },
      { type: "h2", text: "Linkstash" },
      {
        type: "p",
        text: "An authenticated bookmark API. Twelve requirements cover user resolution, Zod validation, structured errors, and the absence of dynamic evaluation and shell-execution dependencies.",
      },
      {
        type: "p",
        text: "Task metadata is available at /api/v1/tasks. The task detail page shows the full spec, declared checks, starting files, and the task leaderboard.",
      },
    ],
  },
  {
    slug: "scoring",
    title: "Scoring",
    summary: "The published formula, caps, and UNVERIFIED semantics.",
    blocks: [
      {
        type: "p",
        text: "The overall score is one decimal from 0 to 100: spec × 0.60 + security × 0.25 + maintainability × 0.15. Each bench is a severity-weighted ratio: critical 8, high 4, medium 2, low 1. PASS earns the full weight; FAIL and DRIFT earn zero; UNVERIFIED earns zero but is reported separately.",
      },
      { type: "h2", text: "Caps" },
      {
        type: "list",
        items: [
          "Any critical spec FAIL or DRIFT caps the overall score at 59.9.",
          "Any critical security FAIL or DRIFT caps the overall score at 49.9.",
          "UNVERIFIED never triggers a cap; missing evidence is not treated as a confirmed failure.",
          "Applied caps are stored in the result and shown in a banner above the score.",
        ],
      },
      { type: "h2", text: "Maintainability" },
      {
        type: "p",
        text: "A static import graph yields four metrics: dependency cycles, maximum fan-out, orphan ratio (entrypoint-aware), and module count. Each degrades linearly between published good and warn thresholds. Tests and mocks are excluded; only resolvable relative JS/TS imports create edges.",
      },
      { type: "h2", text: "No model in the score path" },
      {
        type: "p",
        text: "The score module imports only deterministic task, rule, and result types. A test asserts that the import graph contains no provider or adapter module. Deterministic FAIL overrides any model PASS; model output cannot create rules, paths, verdicts, or scores.",
      },
    ],
  },
  {
    slug: "adapters",
    title: "Adapters",
    summary: "fake, python-openrouter, aider-openrouter, and how to add one.",
    blocks: [
      {
        type: "table",
        head: ["Adapter", "Kind", "Model", "Runtime"],
        rows: [
          ["fake", "Baseline", "none", "In-process fixture"],
          ["python-openrouter", "Harness", "MODEL_NAME", "Python 3.12 stdlib"],
          ["aider-openrouter", "Harness", "MODEL_NAME", "Aider 0.86.2"],
        ],
      },
      {
        type: "p",
        text: "The fake baseline materializes a checked-in fixture and is the public, self-serve path. It never calls a model. The two real adapters are organizer-executed in Docker and record adapter version plus model identity. A head-to-head pair uses one model slug so only the harness varies.",
      },
      {
        type: "p",
        text: "Adapters produce one validated argv command with an allowlisted environment. Provider keys never enter the container; the only key-shaped value is the literal sentinel orivoxx-sandbox-proxy. To add an adapter, implement the contract, register it, add the entry point to the sandbox image if needed, and record a real run.",
      },
    ],
  },
  {
    slug: "sandbox",
    title: "Sandbox",
    summary: "Container profile, network topology, and the execution boundary.",
    blocks: [
      {
        type: "list",
        items: [
          "Non-root uid 10001, read-only root filesystem, bounded tmpfs /tmp.",
          "Memory 512 MB, 1 CPU, 128 PIDs, 256 file descriptors, 64 MB /dev/shm.",
          "No platform secrets, no Docker socket, no host mount beyond the run workspace.",
          "Agent joins only the internal sandbox network; the proxy sidecar is the only egress path.",
          "The proxy forwards only /v1/*, caps request and response sizes, strips client credentials, injects the provider key host-side, and never logs bodies.",
        ],
      },
      {
        type: "p",
        text: "Timeouts kill the container and remove it; no sandbox container survives a run. The integration suite proves filesystem escapes fail, raw internet access fails, direct provider access fails, and the host sees only the captured workspace.",
      },
      {
        type: "p",
        text: "The scoring engine never executes produced code, tests, builds, or package installs. It parses source statically with the TypeScript parser.",
      },
    ],
  },
  {
    slug: "attribution",
    title: "Attribution",
    summary: "The 5×4 taxonomy and the deterministic rules behind every cell.",
    blocks: [
      { type: "p", text: "Attribution answers where a failure entered the agent configuration and what kind of mistake it was. A trace shows the hand-offs; attribution names the layer and the mode, then attaches evidence from the recorded steps." },
      { type: "h2", text: "Layers" },
      { type: "list", items: ["Spec — contradictory, ambiguous, or underspecified task", "Model — wrong reasoning, ignored instruction, hallucinated API", "Harness — swallowed error, no retry, bad stopping condition, dropped state", "Tool — wrong result or the tool's own failure", "Environment — network, timeout, quota, or external nondeterminism"] },
      { type: "h2", text: "Modes" },
      { type: "list", items: ["Decision — wrong choice among viable options", "Execution — correct choice, failed to execute", "Recovery — should have recovered from a fault, did not", "Detection — should have noticed an inconsistency, did not"] },
      { type: "p", text: "Twenty cells. Twelve rules ship today, including tool_error_unhandled (harness × recovery), step_limit_hit (harness × execution), hallucinated_api (model × decision), and misleading_spec_followed (spec × detection). A rule that matches without a counterfactual is medium confidence and is never presented as proven." },
    ],
  },
  {
    slug: "replay-proof",
    title: "Replay & proof",
    summary: "How a counterfactual proves an attribution without a model call.",
    blocks: [
      { type: "p", text: "An attribution without a counterfactual is an opinion. Replay takes the recorded text actions, applies them to a fresh in-memory file map, intervenes at one step, and scores with the same deterministic engine." },
      { type: "code", label: "proof", text: "baseline: 49.7 (failed)\nintervention: retry write_file at step 2\nreplay: steps 2-7 (6 actions)\ncounterfactual: 98.3 (passed, threshold 70)" },
      { type: "p", text: "Steps before the intervention are byte-identical by construction. Replay makes no model call, executes no produced code, and writes nothing to disk. If no intervention crosses the threshold, the result is unattributed." },
    ],
  },
  {
    slug: "reliability",
    title: "Reliability profile",
    summary: "pass@k, score spread, layer distribution, and chaos sensitivity.",
    blocks: [
      { type: "p", text: "A single score is a sample. The reliability profile aggregates stored runs for one adapter and task: artifact score mean and standard deviation, pass@k (score above the threshold and a completed exit), the distribution of attributed layers, pass rate per chaos condition, and the trend across the run window." },
      { type: "p", text: "The leaderboard's stacked bar is that layer distribution. Green is not used for the bar: spec is violet, model blue, harness red, tool amber, environment neutral. A profile with one run is labelled with its run count, not presented as stability." },
    ],
  },
  {
    slug: "metrics-traces",
    title: "Metrics & traces",
    summary: "Six metrics, redaction, and the trace event model.",
    blocks: [
      { type: "list", items: ["Artifact score, steps, tool calls, tool error rate, prompt/completion tokens, cost, duration", "RunStarted, ModelCallStarted/Finished, ToolCallStarted/Finished, StepCompleted, ChaosInjected, RunFinished", "Every tool argument and result is a summary; content-bearing fields carry redacted: true", "The agent trace is excluded from the produced repository before capture"] },
      { type: "p", text: "Token and cost metrics come from the provider's usage object through the allowlisted proxy. If the proxy trace is missing, the result is still scored and attribution is reported as unavailable." },
    ],
  },
  {
    slug: "resilience",
    title: "Resilience testing",
    summary: "Three chaos modes and what each one tests.",
    blocks: [
      { type: "list", items: ["tool_error — one write fails with EACCES; tests recovery and retry policy", "latency — every model call is delayed; tests the stopping policy and budget guards", "context_pressure — context is truncated and the step budget shrinks; tests completeness and detection"] },
      { type: "p", text: "Chaos injections are labelled ground truth. The attribution engine is measured against those labels; precision (the proof crosses the threshold) and recall (the expected cell is named) are reported separately in the build log." },
    ],
  },
  {
    slug: "results-retention",
    title: "Results and retention",
    summary: "What is stored, where, for how long, and what is never stored.",
    blocks: [
      {
        type: "list",
        items: [
          "Stored: bounded scorecard, requirement outcomes, cap reasons, structural metrics, run summary, adapter/model identity, version fields, and the produced-code diff as bounded text.",
          "Never stored: full source trees, archives, prompts, raw model responses, provider request bodies, API keys.",
          "Stores: Upstash Redis in deployment; an append-only local directory for organizer runs; bundled seed rows as a cold-start fallback.",
          "Retention: 90 days. The store interface has no update or delete; a re-run creates a new row.",
        ],
      },
      {
        type: "p",
        text: "Captured workspaces exclude .env files, keys, certificates, credentials, .git, node_modules, build output, binaries, and large generated content. The diff is text, not an artifact.",
      },
      {
        type: "p",
        text: "The public site has no accounts, cookies, analytics, or third-party telemetry. Reads are read-only; mutations are limited to the fake baseline with origin checks and shared rate limiting.",
      },
    ],
  },
  {
    slug: "api",
    title: "API",
    summary: "Public read routes and the fake run endpoint.",
    blocks: [
      {
        type: "table",
        head: ["Route", "Method", "Purpose"],
        rows: [
          ["/api/v1/tasks", "GET", "Task catalogue with version fields"],
          ["/api/v1/tasks/:id", "GET", "Task detail, requirements, spec, starting files"],
          ["/api/v1/leaderboard", "GET", "Ranked rows; taskId, kind, limit"],
          ["/api/v1/results", "GET", "Same projection as the leaderboard"],
          ["/api/v1/results/:id", "GET", "Full stored result by id"],
          ["/api/v1/runs", "POST", "Fake baseline run: { taskId, variant }"],
          ["/api/v1/health", "GET", "Provider and store status, no secrets"],
        ],
      },
      {
        type: "p",
        text: "All responses are no-store with nosniff. Errors use a fixed envelope: { error: { code, message, requestId } }. Mutating routes require a same-origin request, a JSON body under 4 KiB, and shared rate limiting unless running locally.",
      },
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    summary: "Common questions about scope, fairness, and provider use.",
    blocks: [
      { type: "h2", text: "Does a model grade the code?" },
      {
        type: "p",
        text: "No. The score comes from declarative checks and static structural analysis. A model is used only for optional explanations in future work, never for the score.",
      },
      { type: "h2", text: "Why can two agents get the same score?" },
      {
        type: "p",
        text: "The engine measures outcomes against a fixed ruleset. Two repositories that satisfy the same checks and have similar structure deserve the same score. The diff and fingerprint still distinguish the runs.",
      },
      { type: "h2", text: "Can I submit my own agent?" },
      {
        type: "p",
        text: "The public path runs the fake baseline only. Real adapters are organizer-executed because they require Docker and sandbox credentials. The organizer flow is documented in the repository.",
      },
      { type: "h2", text: "What happens when the provider is down?" },
      {
        type: "p",
        text: "The score and stored findings stay available because the score path makes no provider call. A model-dependent capability would be marked UNVERIFIED, never PASS.",
      },
    ],
  },
  {
    slug: "hackathon",
    title: "Hackathon note",
    summary: "Track, scope, and what was built for the submission.",
    blocks: [
      {
        type: "p",
        text: "Built for the HackCulture AI Global Hackathon, track: Build a Benchmarking Platform for AI Agents, Not Just Models. Deadline: 21 November 2026.",
      },
      {
        type: "list",
        items: [
          "Deterministic scoring with no LLM in the score path.",
          "A real Docker sandbox with an allowlisted model proxy.",
          "Three adapters: fake baseline, Python loop, and Aider.",
          "A public read-only leaderboard and result explorer.",
          "Recorded real runs on one task and one model.",
        ],
      },
      {
        type: "p",
        text: "The source, README, and demo video are linked from the repository. The public deployment is read-only for real results; fake runs are self-serve.",
      },
    ],
  },
];

export function getDoc(slug: string): DocSection | undefined {
  return DOC_SECTIONS.find((section) => section.slug === slug);
}

export function searchDocs(query: string): DocSection[] {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return [];
  }

  return DOC_SECTIONS.filter((section) => {
    const haystack = [
      section.title,
      section.summary,
      ...section.blocks.map((block) =>
        block.type === "p"
          ? block.text
          : block.type === "list"
            ? block.items.join(" ")
            : block.type === "table"
              ? [...block.head, ...block.rows.flat()].join(" ")
              : block.type === "code"
                ? block.text
                : block.text,
      ),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(needle);
  });
}
