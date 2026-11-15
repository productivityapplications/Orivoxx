# Orivoxx at the HackCulture AI Global Hackathon

## Track

**Build a Benchmarking Platform for AI Agents, Not Just Models**

Event page: https://hackculture.io/hackathons/ai-global-hackathon

The track thesis: most leaderboards compare foundation models on static tasks. Real agent performance depends on the whole agent system — model, harness, tools, orchestration, and stopping conditions. A platform that benchmarks **agents** must hold the task constant and make the harness a first-class variable.

## One-paragraph pitch

Orivoxx benchmarks AI software-engineering agents, not foundation models. Give an agent a versioned `PROJECT_SPEC.md`, run it through a model-agnostic harness in a Docker sandbox, and score the repository it produces on spec conformance, security patterns, and structural maintainability. Scoring is deterministic: every deduction traces to a named rule and evidence, and no model is in the score path. The same task compares a Python agent loop and Aider on one model slug, so the harness is measured, not assumed.

## Demo narrative

### Act 1 — The problem

Two agents run the same task with the same model. One misses an explicit ownership check; the other satisfies it. A model-only leaderboard reports the same model twice and cannot explain the difference. State the thesis: the harness is part of the result, so it must be part of the benchmark.

### Act 2 — Platform walkthrough

1. Task catalogue: `taskboard 1.0.0`, ruleset `1.0.0`, scoring config `1.0.0`, nine declared requirements.
2. Leaderboard: one task, one model, two harnesses. `python-openrouter` and `aider-openrouter` at 97.3, with `deepseek/deepseek-chat-v3-0324` at 98.1 on the same harness.
3. Result: overall 97.3, spec 100, security 100, maintainability 82.0, no caps. Version strip and repository fingerprint visible.
4. Requirement rows: expand a PASS to see the declared check (rule type, path, expected marker) and the outcome.
5. Produced-code diff: bounded unified diff text, escaped, never rendered as HTML.
6. Compare: python vs aider on the same model, bench deltas and a requirement matrix.
7. Fake baseline submit: self-serve, no model call, creates a real immutable result.

### Act 3 — Differentiation

- Deterministic scoring: no LLM judge, no preference model.
- Model-agnostic harness: same task and model across two adapters.
- Spec conformance as a first-class bench.
- Traceability: rule, path, versions, fingerprint.
- Sandbox execution: hardened container, allowlisted proxy, no platform secrets.
- Reproducibility: task, ruleset, scoring-config, and adapter versions on every row.

Close on the leaderboard with the version fields visible.

## Shipped in this build

- `packages/core`: spec parser, seven deterministic check types, evidence registry, verdict precedence, report contract, bounded archive intake.
- `packages/benchmarks`: versioned task registry (TaskBoard, Linkstash), rulesets, scoring configuration, deterministic score, static import graph and structural metrics.
- `packages/harness`: adapter contract, `fake` / `python-openrouter` / `aider-openrouter`, Docker sandbox, allowlisted model proxy, bounded capture, produced-code diff, organizer CLI.
- `packages/results`: append-only result contracts, local and Upstash stores, seed fallback, leaderboard ordering.
- `apps/web`: landing, task catalogue, task detail, submit, result explorer, leaderboard, compare, privacy, `/docs`, read APIs, fake run endpoint, rate limiting and origin checks.
- `data/seed-results.json`: four recorded fake-baseline rows.
- Real recorded runs: python and Aider on `openai/gpt-4o-mini`, python on `deepseek/deepseek-chat-v3-0324`.

## Demo-only or roadmap

- A hosted run queue for arbitrary public agent submissions. Real adapters are organizer-executed.
- An optional explanation panel. It does not exist in this build; if added, it must be consent-gated and outside the score path.
- More language parsers beyond JS/TS for the structural bench.
- A scheduled retention job. Retention is documented and enforced by an organizer cleanup.

## Judge-facing honesty note

> **Scoring is deterministic; no model is used in the score path.**

- The score comes from declarative checks and static structural analysis over captured text.
- The rule engine makes no model calls.
- Model output cannot add requirements, rules, paths, evidence, or verdicts.
- A deterministic failure cannot be overturned by a model.
- Missing evidence is `UNVERIFIED`, never `PASS`.
- Caps are stored and shown; they are never hidden.
- A provider outage cannot change a stored score.

## Internal submission checklist

| Item | What we show | Status |
|---|---|---|
| Track fit | Agent benchmark, not a model leaderboard | Shipped |
| Working demo | Catalogue → fake submit → deterministic scorecard → evidence | Shipped |
| Deterministic scoring proof | Import-graph test + rule-level breakdown | Shipped |
| Model-agnostic proof | Python and Aider on one task and one model | Recorded |
| Reproducibility | Task/ruleset/scoring/adapter versions + fingerprint on every row | Shipped |
| Explainability | Requirement → declared rule → path → outcome | Shipped (no line-level stored evidence) |
| Optional LLM use | None in this build; no score impact | Not shipped |
| Public repository | README, architecture, benchmark, sandbox, adapter docs | Shipped |
| Open-source license | MIT | `LICENSE` present |
| Demo video | Problem → solution → demo → tagline | P10 |
| Honest limitations | Static analysis, JS/TS first, no runtime correctness | Documented in `BENCHMARKS.md` |

## Relationship to the old hackathon docs

`HACKATHON_SOURCE_NOTES.md` and `HACKATHON_SUBMISSION_CHECKLIST.md` describe the earlier Nebius x NVIDIA hackathon and its 30 October 2026 deadline. They are retained for history and marked deprecated. This document is the current hackathon reference.
