# Orivoxx — Target Architecture

**Status:** target design for the HackCulture AI Global Hackathon build. This document separates what exists in the repository today from what is planned.

**Legend:** `[SHIPPED]` = implemented and covered by the current source/tests. `[PARTIAL]` = contracts or scaffolding exist but the runtime path does not. `[PLANNED]` = design only; no implementation in this repository yet.

## 1. What exists today

```text
apps/web                         Next.js 16 shell
  ├── /                          dark landing placeholder
  └── /api/v1/health             safe provider/version status

packages/benchmarks              versioned benchmark tasks and the deterministic score
  ├── tasks                      registry, TaskBoard, Linkstash, fixtures, generated assets
  ├── scoring                    scoreRun, static structural metrics, evaluateRepository
  ├── contracts                  task/ruleset/scoring-config/score Zod schemas
  └── fingerprint                canonical ruleset fingerprint

packages/harness                 the only component that executes an agent
  ├── adapters                   adapter contract, registry, fake baseline
  ├── sandbox                    Docker executor, allowlisted model proxy
  ├── capture                    bounded artifact capture + repository fingerprint
  └── run                        run lifecycle, command/env validation, summaries

packages/core                    pure TypeScript verification engine
  ├── archive                    bounded in-memory ZIP intake, path checks, redaction
  ├── spec-parser                PROJECT_SPEC.md requirement parser
  ├── inventory                  eligible file metadata
  ├── checks                     deterministic rule engine (7 rule types)
  ├── evidence                   server-generated evidence registry
  ├── verdict                    precedence rules and gate
  ├── report                     schema-validated report builder
  ├── graph/contracts            graph schema only (no builder)
  ├── contracts                  Zod contracts for reports, assessments, explanations
  ├── verify-input               verify-request validation and consent refinement
  └── fixtures                   TaskBoard regressed/compliant snapshots
```

What this means in practice:

- The scoring **rubric** exists: versioned tasks, deterministic checks, evidence, verdicts, and a numeric score.
- The scoring **service** does not: there is no HTTP route that runs the engine over a submitted repository, and there is no leaderboard API yet.
- The **execution path** exists for organizer-run benchmarks: `packages/harness` runs an adapter in Docker and returns a normalized repository. The public fake-run path and the result explorer are still to be built.
- The Nebius adapter is demoted to an optional provider; OpenRouter is the featured provider. Neither is in the score path.

## 2. Target system

```text
┌──────────────────────────────────────────────────────────────────────┐
│                         Public benchmark UI                          │
│  task catalogue · submit agent · run status · result explorer        │
│  leaderboard · score breakdown · evidence viewer                     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ same-origin HTTPS
┌──────────────────────────────▼───────────────────────────────────────┐
│                     apps/web (Next.js, Vercel)                       │
│  benchmark API · score API · leaderboard read API · explanation API  │
│  auth-less public read · rate limits · safe error envelope           │
└───────────────┬──────────────────────────────┬───────────────────────┘
                │                              │
┌───────────────▼──────────────┐  ┌────────────▼──────────────────────┐
│ packages/benchmarks [PLANNED]│  │ packages/harness [PLANNED]        │
│ task registry + versions     │  │ agent adapters                    │
│ ruleset versions             │  │ sandbox orchestration             │
│ scoring configuration        │  │ artifact capture                  │
│ leaderboard aggregation      │  │ run metadata                      │
└───────────────┬──────────────┘  └────────────┬──────────────────────┘
                │                              │
                │                   ┌──────────▼──────────────────────┐
                │                   │ apps/runner [PLANNED, optional] │
                │                   │ isolated execution service      │
                │                   │ sandbox image + quotas          │
                │                   └──────────┬──────────────────────┘
                │                              │ produced repository
┌───────────────▼──────────────────────────────▼───────────────────────┐
│                 packages/core [SHIPPED — scoring rubric]             │
│  spec parser · deterministic rules · evidence · verdict · report     │
│  static analysis only; never executes the produced repository        │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ optional explanation context
┌──────────────────────────────▼───────────────────────────────────────┐
│              Nebius Token Factory / Nemotron [PARTIAL]               │
│  explanations only; never scoring, never verdicts                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Package responsibilities

| Component | Responsibility | Status |
|---|---|---|
| `packages/benchmarks` | Versioned task registry, ruleset manifests, scoring configuration, leaderboard aggregation. | `[PARTIAL]` — tasks, rulesets, scoring config shipped; leaderboard aggregation is P5 |
| `packages/harness` | Agent adapter interface, run lifecycle, Docker sandbox, allowlisted model proxy, artifact capture, adapter versioning. | `[SHIPPED]` |
| `apps/runner` | Optional isolated execution service. | `[SUPERSEDED]` — real runs execute through `packages/harness` on the organizer machine |
| `apps/web` | Public benchmark UI, run submission, result explorer, leaderboard, explanation requests. | `[PARTIAL]` — shell and health only |
| `packages/core` | Deterministic scoring rubric over the captured repository. | `[SHIPPED]` — engine only |

## 3. Execution flow

Flow for one organizer-run benchmark run:

1. **Select the task and adapter.** The task registry resolves the task version, ruleset version, and scoring configuration. These versions are recorded before execution.
2. **Provision the sandbox.** `packages/harness` creates an empty run workspace, writes the task's starting repository, and starts a hardened container with no platform secrets (`docs/SANDBOX.md`).
3. **Run the agent.** The adapter launches the agent by argv inside the container. Stdout/stderr summaries are bounded and redacted; status, exit code, and timing are recorded.
4. **Capture the produced repository.** After the container exits, the workspace is normalized (path validation, denylist filtering, secret redaction, size ceilings) and fingerprinted.
5. **Score.** `packages/benchmarks` runs the deterministic ruleset and the static import graph over the captured text. No produced code is executed.
6. **Aggregate.** `scoreRun()` maps rule outcomes to the task score. The result records task/ruleset/adapter/scoring-config versions and the repository fingerprint.
7. **Publish.** The result is written to the leaderboard store and exposed in the result explorer with per-rule evidence.

### What is deliberately synchronous vs. queued

The scoring engine is synchronous and stateless `[SHIPPED]`. Real benchmark runs are not: an agent run takes minutes and needs isolation, so it runs as a separate organizer-executed command that writes a result to the store `[SHIPPED]` in `packages/harness`. A public run queue is `[PLANNED]`; nothing in the public web app executes an agent today.

## 4. Scoring boundary

The scoring function is:

```text
score = f(taskVersion, rulesetVersion, capturedRepository, scoringConfigVersion)
```

`packages/benchmarks` implements it: `scoreRun()` maps deterministic requirement outcomes and static structural metrics to a 0–100 score using the task's versioned scoring configuration. `evaluateRepository()` runs the checks and the static import graph first. The model is not an input.

Properties:

- **No network calls.** The scoring engine does not fetch URLs, call models, or contact the runner.
- **No filesystem writes.** It receives normalized files in memory.
- **No execution.** It reads text and package manifests. It does not install, build, test, or run the agent's code.
- **No model input.** Model output cannot add rules, requirements, paths, or evidence.
- **Deterministic ordering.** File order, finding order, and evidence IDs are stable for the same input.

A deterministic FAIL is final. Missing or invalid evidence is `UNVERIFIED`, never `PASS`. Unknown requirement IDs, paths, or evidence references from any external source are rejected before they can affect a result.

## 5. Security boundary

There are two distinct execution contexts, and the documentation must keep them separate:

| Context | What runs there | What it may access | What it must never access |
|---|---|---|---|
| **Harness sandbox** `[SHIPPED]` | The agent process and its declared tools | The task's starting repository, an ephemeral run workspace, one allowlisted model proxy | Platform API keys, the leaderboard store, other runs' artifacts, the host filesystem, unrestricted network |
| **Scoring engine** `[SHIPPED]` | Pure TypeScript analysis | The captured, normalized repository in memory | The network, a shell, the agent process, persistent storage |

This separation is a strength, not a limitation. The scoring engine cannot be compromised by malicious code in the agent's output because it never executes that code. It parses source with the TypeScript parser API and evaluates declarative checks. The harness is the only component that executes anything, and it does so in a disposable sandbox with explicit quotas. See `docs/SANDBOX.md` for the container profile, the network topology, and the proxy allowlist.

The existing engine rules still apply to the scoring engine:

- Archive entries are validated for traversal, absolute/drive paths, NULs, duplicates, symlinks, entry count, and expansion limits.
- Secret-bearing paths are excluded; common secret patterns are redacted.
- Source text is untrusted data. Prompt-injection text is never treated as instruction.
- No uploaded archive bytes, source, prompts, or model responses are logged.
- Public AI endpoints require shared rate limiting before launch. The current repo has no rate limiter; this remains a launch gate.

> **Approved:** adding a harness that executes agents was approved in Phase 0 and is recorded in `AGENTS.md`. That rule continues to apply to the **scoring engine**, which never executes produced code. The sandbox boundary above is the shipped replacement for the harness.

## 6. What we keep from the verifier era

| Verifier-era component | New role in the benchmark platform |
|---|---|
| Spec parser (`packages/core/src/spec-parser`) | Parses each benchmark task's `PROJECT_SPEC.md` into versioned requirements and checks. |
| Deterministic rule engine (`packages/core/src/checks`) | The scoring rubric. Each check is a named, reproducible rule. |
| Verdict engine (`packages/core/src/verdict`) | Precedence layer that turns rule outcomes into per-requirement statuses and a gate. |
| Evidence registry (`packages/core/src/evidence`) | Makes every deduction traceable to a rule, a requirement, a path, and a line where available. |
| Archive intake (`packages/core/src/archive`) | Normalizes and secures the repository artifact captured from the harness. |
| Report contract (`packages/core/src/report`) | Base for the planned benchmark result artifact; the benchmark result adds task/ruleset/adapter versions and a numeric score. |
| Graph contracts (`packages/core/src/graph/contracts`) | Structural metric schema. The builder and coupling/cycle metrics are planned. |
| Nebius adapter (`apps/web/src/server/nebius`) | Optional explanation service only. Never scoring. |
| Map-first dashboard design (`FRONTEND_DESIGN_SPEC.md`) | Visual reference for the planned result explorer. The current UI is a landing shell. |

## 7. Planned result record

Design-level shape for a benchmark result. This is not implemented; field names are a proposal for the code pass.

```json
{
  "resultId": "string",
  "taskId": "string",
  "taskVersion": "string",
  "rulesetVersion": "string",
  "scoringConfigVersion": "string",
  "adapterId": "string",
  "adapterVersion": "string",
  "agentLabel": "string",
  "modelId": "string",
  "harnessMetadata": {},
  "sandboxImage": "string",
  "startedAt": "ISO-8601",
  "completedAt": "ISO-8601",
  "repositoryFingerprint": "sha256",
  "score": 0,
  "scoreBreakdown": [],
  "ruleOutcomes": [],
  "findings": [],
  "artifactRef": "string"
}
```

The `taskVersion`, `rulesetVersion`, `adapterVersion`, `scoringConfigVersion`, and `repositoryFingerprint` fields are mandatory for reproducibility. A result missing any of them is not a valid leaderboard entry.

## 8. Technology constraints carried forward

- `[SHIPPED]` Node.js 24 LTS, pnpm workspace, TypeScript strict mode.
- `[SHIPPED]` Next.js 16 App Router on Vercel for the public UI and read APIs (currently a shell plus health endpoint).
- `[PARTIAL]` `@xyflow/react` + `@dagrejs/dagre` are installed, but the graph builder and result-explorer UI are planned.
- `[SHIPPED]` Zod for external contracts.
- `[SHIPPED]` `fflate` for bounded ZIP parsing.
- `[PARTIAL]` `openai` Node SDK against `https://api.tokenfactory.nebius.com/v1/`, model `nvidia/Nemotron-3.5-Super-VL`, for explanations only. The current adapter is a smoke test.
- `[PLANNED]` Upstash Redis REST + `@upstash/ratelimit` for shared rate limits. The package is not installed and no limiter is wired.
- `[SHIPPED]` Vitest for unit/integration tests. `[PARTIAL]` Playwright is installed as a dev dependency but has no test suite yet.

## 9. Open architecture decisions

These need a human decision before the code pass:

1. Where the leaderboard store lives (Upstash Redis vs. a relational database) and whether it persists only aggregate results or full artifacts.
2. Whether `apps/runner` is a separate deployable or a local-only harness for the hackathon demo.
3. Which sandbox technology is acceptable (container runtime, Firecracker, hosted runner) and what network policy applies to agents.
4. Whether benchmark artifacts are retained, and for how long. This affects the privacy notice and leaderboard reproducibility.
5. Whether the public leaderboard accepts self-submitted runs or only organizer-run evaluations.
