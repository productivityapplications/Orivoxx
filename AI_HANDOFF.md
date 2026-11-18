# AI_HANDOFF.md — ORIVOXX

- **Updated:** 18 November 2026
- **Project state:** attribution extension complete. Deployed, tested, and pushed.
- **Live:** https://orivoxx.vercel.app · app home `/app`
- **Repository:** https://github.com/productivityapplications/Orivoxx
- **Deadline:** 21 November 2026 (hard)
- **Provider:** OpenRouter via the OpenAI-compatible API. Nebius remains optional and demoted.

## Product

Orivoxx benchmarks AI software-engineering agents and attributes their failures. A versioned task supplies a `PROJECT_SPEC.md`; a model-agnostic harness runs the agent in Docker; the deterministic engine scores the produced repository on six metrics; a rule engine names the failure by layer × mode; a counterfactual replay proves the attribution.

Tagline: **Benchmark the agent, not just the model.**

## Shipped

- `packages/core`: spec parser, deterministic rules, evidence, verdict, trace/attribution contracts.
- `packages/benchmarks`: TaskBoard + Linkstash, versioned rulesets, score, static graph.
- `packages/harness`: fake / python-openrouter / aider-openrouter, Docker executor, allowlisted proxy, trace, capture, diff, chaos CLI.
- `packages/attribution`: 12 deterministic rules over trace + scorecard.
- `packages/replay`: memoized counterfactual replay, no model calls.
- `packages/results`: append-only local/Upstash stores, reliability aggregation, seed fallback.
- `apps/web`: marketing landing `/`, app home `/app`, catalogue, task, submit, result, trace, replay, leaderboard, compare, docs, privacy, read APIs, fake run endpoint, rate limiting.
- Demo: `demo/orivoxx-demo.mp4` (2:21.5, ElevenLabs, word-synced captions).
- Docs: `OBSERVABILITY_SPEC.md`, `ATTRIBUTION_SPEC.md`, `FRONTEND_BENCHMARK_SPEC.md`, UI/app/landing reference notes.

## Recorded evidence

- Real proof: `res_64068a9c…` — 49.7, harness × recovery, retry at step 2 → 98.3 PASS.
- Insufficient proof: `res_0427d9f5…` — 49.9, rule-matched, retry → 59.9 not sufficient.
- Baseline: `res_df4fc568…` — 96.4 with 45 trace events and six metrics.
- Reliability group: python/openai/gpt-4o-mini, 8 runs, 50% pass@k.
- Fixture attribution: 12/12 precision, 12/12 recall. Real tool_error: 1/3 proven precision, 3/3 cell recall.

## Must-preserve invariants

1. No LLM in the score path or the attribution path.
2. Only the harness executes agents, only inside the sandbox.
3. Deterministic FAIL overrides model output; missing evidence is `UNVERIFIED`.
4. Attribution requires evidence and (when claimed proven) a counterfactual proof.
5. Unknown ids/references are rejected; no fabricated cell or path.
6. Trace stores redacted summaries only; replay actions stay in memory.
7. Static import evidence drives structural metrics.
8. No source, prompts, secrets, or raw model responses in logs or results.
9. Leaderboard-valid rows carry task/ruleset/scoring/adapter versions + fingerprint.

## Verification commands

```bash
pnpm -r test          # 480 unit tests
pnpm -r typecheck
pnpm -r lint
pnpm -r build          # run with AI_AGENT/AGENT/OPENCODE unset to avoid the Next security nudge
pnpm test:e2e          # 5 Playwright tests
ORIVOXX_DOCKER_TESTS=1 pnpm --filter @orivoxx/harness test   # 95 tests
```

## Open items for the human

- Submit the Devpost form from `SUBMISSION.md` and upload `demo/orivoxx-demo.mp4`.
- Confirm the MIT copyright holder.
- Decide on the Next.js security upgrade (`16.4.2 → 16.4.6`); builds pass, but the CLI nudge requires an upgrade decision.
