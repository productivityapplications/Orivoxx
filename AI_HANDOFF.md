# AI_HANDOFF.md — ORIVOXX

- **Updated:** 15 November 2026
- **Project state:** benchmark platform build in progress (P0 complete; P1–P11 running autonomously).
- **Current task:** implement the benchmark layer, web surfaces, docs, demo video, and submission pack. Phase 0 pre-flight was the only approval gate.
- **Provider:** OpenRouter via the OpenAI-compatible API. Nebius is an optional demoted provider behind the same interface, not a primary path.

## Product

Orivoxx benchmarks AI software-engineering agents, not foundation models. A versioned task supplies a `PROJECT_SPEC.md`; a model-agnostic harness runs an agent inside a Docker sandbox; the deterministic engine scores the produced repository on spec conformance, security patterns, and structural maintainability. Every point traces to a named rule and evidence. The model is used only for optional explanations and never enters the score.

Tagline: **Benchmark the agent, not just the model.**

## Current architecture

```text
apps/web (Next.js on Vercel)
  landing · task catalogue · submit · result explorer · leaderboard · compare · docs
  /api/v1/tasks · /api/v1/runs · /api/v1/results · /api/v1/leaderboard
        │
        ├── packages/benchmarks   task registry · rulesets · scoring config · pure score
        ├── packages/harness      adapters · Docker sandbox · artifact capture · model proxy
        └── packages/core         spec parser · deterministic rules · evidence · verdict
        │
        └── Upstash Redis         append-only scorecards + leaderboard index
```

Real adapter runs execute locally in Docker (python-openrouter, aider-openrouter) and write scorecards to Upstash. Vercel serves the UI and read APIs plus the fake self-serve path. Full source artifacts are not stored; the scorecard contains the produced-code diff as text and the repository fingerprint.

## Shipped before this build

- `packages/core`: spec parser, seven deterministic check types, evidence registry, verdict/gate precedence, report builder, safe in-memory ZIP intake, inventory, Zod contracts, TaskBoard fixtures.
- `apps/web`: Next.js shell and health endpoint.
- `apps/web/src/server/nebius`: optional legacy smoke adapter (demoted; not featured).

## In progress / planned in this build

- `packages/benchmarks` with task/ruleset/scoring versions and two tasks.
- `packages/harness` with fake, python-openrouter, and aider-openrouter adapters.
- Pure score function and structural metrics.
- Docker sandbox with quotas and an allowlisted model proxy.
- Leaderboard store and read APIs.
- Benchmark UI, `/docs`, README, screenshots, E2E.
- Narrated demo video.

## Must-preserve invariants

1. No LLM in the score path. The score module imports no provider or adapter code.
2. Only the harness executes agents, and only inside the sandbox. The scoring engine analyzes statically and never executes produced code.
3. Deterministic FAIL cannot be overridden by model output; missing evidence is `UNVERIFIED`, never `PASS`.
4. Unknown requirement IDs, paths, or evidence references are rejected.
5. Every leaderboard-valid result records task/ruleset/adapter/scoring versions and a repository fingerprint.
6. Model output is used only for optional explanations and never changes score, findings, verdicts, or gate.
7. Static import evidence, never model-invented relationships, drives structural metrics.
8. Captured archives/workspaces are bounded in memory; no full source persistence; secrets are redacted.
9. No source, archive bytes, prompts, secrets, or raw model responses in logs.
10. Provider keys stay server-only. No `NEXT_PUBLIC_` secrets.
11. Planned capabilities are documented as planned, not shipped.

## Source of truth

- `docs/VISION.md` — problem, positioning, exclusions.
- `docs/ARCHITECTURE.md` — target architecture and boundaries.
- `docs/BENCHMARKS.md` — bench definitions and scoring.
- `docs/FRONTEND_BENCHMARK_SPEC.md` — UI contract.
- `IMPLEMENTATION_PLAN.md` — P0–P11 plan; historical verifier phases at the bottom.
- `AGENTS.md` — implementation, security, testing rules.

Historical verifier-era references retained: `PROJECT_SPEC.md`, root `ARCHITECTURE.md`, `FRONTEND_DESIGN_SPEC.md`, `ORIVOXX_COMPLETE_BLUEPRINT.md`, `README_TEMPLATE.md`, `HACKATHON_SOURCE_NOTES.md`, `HACKATHON_SUBMISSION_CHECKLIST.md`.

## Verification commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test
pnpm bench:list
pnpm bench:run --task taskboard --adapter fake --variant compliant
```

Real adapter runs require Docker, `OPENROUTER_API_KEY`, and the sandbox image.

## Next task

Continue P1–P11. Update this file at the final audit with deployed URL, commit hash, test evidence, and open submission items.
