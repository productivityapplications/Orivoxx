# AI_HANDOFF.md — ORIVOXX

- **Updated:** 15 November 2026
- **Project state:** deterministic verification engine shipped; web app is a shell; documentation repositioned for the HackCulture AI Global Hackathon; benchmark layer not started.
- **Current task:** documentation pass complete, awaiting human review. Do not start benchmark-layer code until the docs are approved.

## Product

Orivoxx is a benchmarking platform for AI software-engineering agents. Given a versioned `PROJECT_SPEC.md`, it is designed to run any agent (Claude Code, Codex CLI, OpenClaw, custom) through a model-agnostic harness in a sandbox, capture the produced repository, and score it deterministically on spec conformance, security patterns, and structural maintainability.

The existing deterministic verification engine is the **scoring rubric**. The product is a benchmark platform; "verifier" refers only to the rule-engine component.

Tagline: **Benchmark the agent, not just the model.**

## What exists in the repository

- `packages/core/src/contracts` — Zod contracts for requirements, evidence, findings, reports, assessments, explanations, and the graph.
- `packages/core/src/spec-parser` — parses documented `PROJECT_SPEC.md` requirement blocks and seven check types.
- `packages/core/src/checks` — deterministic rule engine: `file_exists`, `file_absent`, `text_contains`, `text_not_contains`, `dependency_present`, `dependency_absent`, `source_reference_exists`.
- `packages/core/src/archive` — bounded in-memory ZIP intake, path validation, denylist filtering, secret redaction.
- `packages/core/src/inventory` — file metadata and language summary.
- `packages/core/src/evidence` — server-generated evidence registry.
- `packages/core/src/verdict` — deterministic precedence and severity-aware gate.
- `packages/core/src/report` — schema-validated report builder (graph is currently empty).
- `packages/core/src/verify-input` — verify-request validation with upload-consent refinement.
- `packages/core/src/graph/contracts` — graph schema only; no builder.
- `packages/core/src/fixtures` — TaskBoard regressed/compliant snapshots and expected deterministic outcomes.
- `apps/web` — Next.js shell with a dark landing placeholder and `GET /api/v1/health`.
- `apps/web/src/server/nebius` — server-only `pingModel()` smoke adapter; not a semantic verifier or explanation service.
- `apps/web/scripts/smoke-test.ts` — manual real-provider smoke script (`pnpm smoke`).

## What does not exist

- Benchmark task registry, task versioning, scoring configuration.
- Agent adapters, harness, sandbox runner, artifact capture.
- Numeric benchmark score, leaderboard, leaderboard store, result explorer.
- Second benchmark rule type beyond the seven deterministic checks.
- Graph builder, graph metrics, cycle detection.
- `/workspace`, `/privacy`, upload UI/API, `/api/v1/verify`, `/api/v1/explanations/*`.
- Semantic verification and explanation runtime (schemas exist only).
- Upstash rate limiting (env vars exist, code does not).
- Playwright suite, LICENSE file.
- Deployed demo or recorded video.

## Source of truth

Current product and architecture:

- `docs/VISION.md` — problem, insight, positioning, out-of-scope list.
- `docs/ARCHITECTURE.md` — target architecture, shipped-vs-planned components, execution flow, security boundary.
- `docs/BENCHMARKS.md` — bench definitions, scoring design, reproducibility, limitations.
- `docs/HACKATHON.md` — track, pitch, demo narrative, honest shipped/planned split.

Historical verifier-era references (still useful for engine contracts, not for product scope):

- `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `FRONTEND_DESIGN_SPEC.md`, `ORIVOXX_COMPLETE_BLUEPRINT.md`.

Operating rules:

- `AGENTS.md` — implementation executor restrictions; updated with the positioning note.
- `PROPER_VIBE_CODING_WORKFLOW.md` — implementation methodology.

Deprecated: `README_TEMPLATE.md`, `HACKATHON_SOURCE_NOTES.md`, `HACKATHON_SUBMISSION_CHECKLIST.md`, `ORIVOXX_COMPLETE_BLUEPRINT.md`.

## Must-preserve invariants

1. Deterministic FAIL cannot be overridden by model output.
2. Missing or invalid evidence is `UNVERIFIED`, never `PASS`.
3. Unknown requirement IDs, paths, or evidence references are rejected.
4. The scoring engine makes no model calls and executes no produced code.
5. The model is used only for optional explanations and never changes score, findings, verdicts, or gate.
6. Graph edges come from static source evidence, never from a model.
7. Uploaded/captured archives are processed in memory with path, size, entry-count, and secret protections.
8. No source, archive bytes, prompts, secrets, or raw model responses in logs.
9. Provider keys stay server-only. No `NEXT_PUBLIC_` secrets.
10. Planned capabilities are documented as planned, not shipped.

## Next task (only after human approval of the docs pass)

1. Scaffold `packages/benchmarks` with a task manifest schema, task versioning, ruleset versioning, and one TaskBoard task derived from the fixtures.
2. Scaffold `packages/harness` with an adapter interface and a fake/no-op adapter for tests before any real agent adapter.
3. Add a scoring config and a pure score function over existing rule outcomes. Keep it out of `packages/core` if it needs benchmark-specific task metadata.
4. Add the sandbox/runner design review before executing any real agent.
5. Build the leaderboard read path and result explorer only after the run artifact shape is stable.

Do not implement adapters, sandbox execution, or persistence in the same step as the scoring scaffold.

## Verification commands

These are the existing workspace scripts. They were **not run** during the documentation pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm smoke   # requires a real NEBIUS_API_KEY
```

## End-of-task report

List files changed; commands actually run and their outcomes; documentation claims verified against code; known issues; acceptance pass/fail. Do not commit unless the assigned instruction authorizes it. Then STOP.
