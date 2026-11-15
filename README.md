# Orivoxx

**Benchmark the agent, not just the model.**

Orivoxx is a benchmarking platform for AI software-engineering agents. Given a `PROJECT_SPEC.md`, it is designed to run any agent — Claude Code, Codex CLI, OpenClaw, or a custom Python agent — and score the repository that agent produces on **spec conformance**, **security patterns**, and **structural maintainability**. Scoring is designed to be deterministic and reproducible.

> **Status:** the deterministic verification engine that will act as the scoring rubric is shipped. The benchmark task registry, agent runner harness, leaderboard, and result explorer are the current hackathon build and are **not yet implemented**. See [Current state](#current-state) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## What Orivoxx is

Orivoxx is an agent benchmark, not a model benchmark. The thing being measured is the **whole agent system**: the model, the harness that drives it, the tools it can call, and the orchestration loop that decides when to stop. The benchmark supplies a versioned task spec; the harness runs an agent against it in a sandbox; the scoring engine inspects the produced repository and returns a structured, reproducible score.

The platform is being built for the HackCulture **AI Global Hackathon** under the track **"Build a Benchmarking Platform for AI Agents, Not Just Models."**

## Why "agents, not models"

Most public leaderboards compare foundation models on static tasks. That answers a narrow question: how well does this model perform under one particular harness? Real agent performance depends on the harness too — tool design, retry behaviour, context management, verification habits, and stopping conditions can change the outcome more than a model swap does.

A benchmark that only ranks models hides that. Orivoxx is designed to rank the compound system and record which harness produced which result, so a score is attributable to an agent configuration rather than to a model name.

## How scoring works

Steps 1–2 belong to the planned benchmark layer. Steps 3–5 are the shipped deterministic engine that will act as the scoring rubric.

1. A benchmark task defines a `PROJECT_SPEC.md` with stable requirement IDs and declared checks.
2. An agent adapter runs the agent against that task inside a sandbox and captures the produced repository.
3. The deterministic rule engine evaluates the repository statically: file presence/absence, text markers, declared dependencies, and static source references.
4. The verdict engine applies fixed precedence rules. A deterministic failure cannot be overturned. Missing evidence becomes `UNVERIFIED`, never `PASS`.
5. Every finding carries a requirement ID and links to evidence records that identify the check type and, where available, a validated file path/line. That is the trace from a lost point to a named rule.

The numeric benchmark score is a **planned** aggregation of these rule outcomes. The current engine produces per-requirement statuses, findings, evidence, and a `PASS`/`WARN`/`BLOCKED` gate; it does **not** yet emit a leaderboard score.

Nebius Token Factory / NVIDIA Nemotron is reserved for **optional natural-language explanations** of failures. The model is never part of the scoring loop and its output cannot change a score, finding, or verdict. The current adapter is a smoke test only; no explanation service is implemented.

## Current state

### ✅ Shipped

- **Spec parser** — `packages/core/src/spec-parser`: documented Markdown requirement blocks, severity, verification mode, and seven declarative check types.
- **Deterministic rule engine** — `packages/core/src/checks`: `file_exists`, `file_absent`, `text_contains`, `text_not_contains`, `dependency_present`, `dependency_absent`, `source_reference_exists`.
- **Verdict and gate engine** — `packages/core/src/verdict`: deterministic FAIL precedence, `UNVERIFIED` for missing evidence, severity-aware gate.
- **Evidence registry and report contract** — `packages/core/src/evidence`, `packages/core/src/report`, `packages/core/src/contracts`: Zod-validated report structures with evidence IDs and snapshot fingerprints.
- **Safe in-memory archive intake** — `packages/core/src/archive`: bounded ZIP parsing, path validation, denylist filtering, secret redaction.
- **Inventory** — `packages/core/src/inventory`: file metadata and language summary.
- **TaskBoard synthetic fixtures** — `packages/core/src/fixtures`: regressed and compliant snapshots with expected deterministic outcomes.
- **Zod contracts for graph, assessments, and explanations** — `packages/core/src/graph/contracts`, `packages/core/src/contracts`.
- **Next.js shell and health endpoint** — `apps/web`: dark landing placeholder and `/api/v1/health`.
- **Nebius smoke adapter** — `apps/web/src/server/nebius`: a single server-side `pingModel()` call plus a manual smoke script. This is not yet the semantic verification or explanation service.

### 🚧 In progress (hackathon build)

- Benchmark task registry and versioned task definitions.
- Agent runner harness and adapters (Claude Code, Codex CLI, OpenClaw, custom agents).
- Sandboxed execution service.
- Numeric scoring configuration and leaderboard service.
- Result explorer and public leaderboard UI.
- Dependency graph **builder** and structural metrics. Only the graph contract exists today.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md) for the target design.

## Quickstart (local development)

Prerequisites: Node.js 24 LTS, pnpm, a Nebius Token Factory API key, and an Upstash Redis REST database for shared rate limits.

1. Copy `.env.example` to `.env.local`.
2. Set `NEBIUS_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `APP_BASE_URL`.
3. Install dependencies with `pnpm install`.
4. Run `pnpm dev`.
5. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before submitting changes.

These are the existing workspace commands, preserved from the previous README template. They were **not run during the documentation pass**; do not treat this README as evidence that they currently pass. The current code only reads the `NEBIUS_*` variables; `UPSTASH_*` and `APP_BASE_URL` are reserved for planned rate limiting and origin checks.

The optional live provider smoke test is `pnpm smoke`. It calls Nebius Token Factory with `nvidia/Nemotron-3.5-Super-VL` and prints only safe response metadata.

## Repository layout

```text
apps/web                 Next.js shell (landing + health endpoint)
packages/core            Deterministic verification engine and Zod contracts
docs/                    Positioning, target architecture, benchmarks, hackathon pack
```

## Privacy and safety

- The archive-intake module in `packages/core` processes uploaded archives in memory. It does not execute uploaded code, tests, builds, package installs, or shell commands.
- The planned benchmark harness runs agents inside an isolated sandbox. That is a separate execution boundary from the scoring engine, which only analyzes the captured repository statically. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- The planned explanation service is designed to send bounded source context to Nebius Token Factory only after explicit consent. The current smoke adapter sends a fixed benign prompt and no user source.
- Do not upload secrets, API keys, personal data, or confidential code unless you are authorized to share it.
- The current MVP has no accounts, database, project history, or persistence of uploaded source.

## Hackathon

Built for the HackCulture AI Global Hackathon — **"Benchmarking Platform for AI Agents, Not Just Models"** track.

- Event: https://hackculture.io/hackathons/ai-global-hackathon
- Detailed pitch, demo narrative, and shipped-vs-planned breakdown: [`docs/HACKATHON.md`](docs/HACKATHON.md)

## License

MIT. See `LICENSE`.

> `TODO(verify)`: the `LICENSE` file was not present in the repository at the time of this documentation pass. The project claims MIT in the existing docs; the file still needs to be added before submission.
