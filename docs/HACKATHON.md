# Orivoxx at the HackCulture AI Global Hackathon

## Track

**Build a Benchmarking Platform for AI Agents, Not Just Models**

Event page: https://hackculture.io/hackathons/ai-global-hackathon

The track thesis: most leaderboards compare foundation models on static tasks. Real agent performance depends on the whole agent system — model, harness, tools, and orchestration loop. The track asks for a platform that benchmarks **agents** as compound systems.

## One-paragraph pitch

Orivoxx benchmarks AI software-engineering agents, not foundation models. Give an agent a versioned `PROJECT_SPEC.md`, run it through a model-agnostic harness in a sandbox, and score the repository it produces on spec conformance, security patterns, and structural maintainability. Scoring is deterministic: every deduction traces to a named rule violation with a reproducible artifact. The LLM is used only for optional explanations and never enters the score. The same task can compare Claude Code, Codex CLI, OpenClaw, or a custom Python agent under one reproducible rubric.

## Demo narrative (3 acts)

> Target narrative for submission. The platform layer is still being built; see the shipped/planned split below before recording.

### Act 1 — The problem (≈30s)

Show two agent runs on the same task. One produces a repository that looks plausible but misses an explicit authorization requirement. The other satisfies it. A model-only leaderboard would not distinguish the harnesses that produced these outcomes. State the track thesis: the harness is part of the result, so it must be part of the benchmark.

### Act 2 — Platform walkthrough (≈90s)

1. Open the task catalogue and show a versioned task: `PROJECT_SPEC.md`, starting repository, ruleset version, scoring configuration.
2. Submit an agent configuration. Show the harness and adapter identity, not just a model name.
3. Show the sandbox run: resource limits, captured repository fingerprint, timing.
4. Open the result: overall score, per-bench breakdown, then a single failed requirement. Follow it to the rule, the evidence record, and the source path/line.
5. Show that the explanation panel is clearly labeled as an optional natural-language aid and does not change the score.

### Act 3 — Differentiation (≈40s)

- Deterministic scoring: no LLM judge.
- Model-agnostic harness: same task, multiple agents.
- Spec-conformance as a first-class metric.
- Explainability: every lost point has a rule and an artifact.
- Reproducibility: task version + ruleset version + adapter version recorded in every result.

Close on the leaderboard, with the version columns visible.

## Shipped vs. demo-only vs. roadmap

### Shipped today

- Deterministic verification engine in `packages/core`: spec parser, seven rule types, evidence registry, verdict/gate precedence, report contract, safe archive intake.
- TaskBoard synthetic fixtures with regressed and compliant snapshots.
- Next.js shell with a dark landing page and `/api/v1/health`.
- Server-only Nebius smoke adapter (`pingModel`) and manual smoke script.

### Demo-only (must be labeled)

- Any seeded leaderboard row or precomputed TaskBoard result shown for narrative convenience. It must be reproducible from the checked-in fixture and visibly marked as a seeded demo, not a live agent run.
- The illustrative result-explorer screens, if they are shown before the explorer is wired to real results.

**None of these exist yet.** If we add them for the demo, they must not be presented as live benchmark output.

### Roadmap (not shipped)

- Benchmark task registry and task versioning.
- Agent adapter interface and concrete adapters.
- Sandbox runner and artifact capture.
- Numeric scoring configuration.
- Leaderboard store and public read API.
- Result explorer with map/list views.
- Optional explanation service using Nebius/Nemotron.
- Rate limiting, abuse protection, and production hardening.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for component boundaries and [`BENCHMARKS.md`](BENCHMARKS.md) for the bench definitions.

## Judge-facing honesty note

> **Scoring is deterministic; the LLM is used only for explanations, never in the score.**

In the shipped engine, deterministic rules already produce requirement statuses, findings, evidence, and a gate. The numeric score wrapper and leaderboard are planned. When they ship:

- The score will come from declarative rules over the captured repository.
- The rule engine makes no model calls.
- Model output cannot add requirements, rules, paths, evidence, or verdicts.
- A deterministic failure cannot be overturned by a model.
- Missing evidence is `UNVERIFIED`, never `PASS`.
- If the explanation provider is unavailable, the score and findings are unaffected; the explanation panel shows an unavailable state.

## Internal submission checklist

This is our working checklist, not a restatement of the organizer's rules. Confirm the official requirements on the event page before submitting.

| Item | What we will show | Status |
|---|---|---|
| Track fit | Agent benchmark, not a model leaderboard | Positioning ready; platform planned |
| Working demo | Task catalogue → agent run → deterministic score → evidence | **Not built** |
| Deterministic scoring proof | Rule-level breakdown for one task | Engine exists; benchmark wrapper planned |
| Model-agnostic proof | Two adapters on the same task version | **Not built** |
| Reproducibility | Task/ruleset/adapter versions on every result | Design defined; storage planned |
| Explainability | Failed rule → requirement → path/line → artifact | Engine evidence exists; UI planned |
| Optional LLM use | Explanation panel, clearly outside the score | Adapter smoke only |
| Public repository | README, architecture, benchmark docs | README and docs in this pass |
| Open-source license | MIT | `TODO(verify)`: `LICENSE` file missing |
| Demo video | 3-act narrative above | Not recorded |
| Honest limitations | Static analysis, JS/TS first, no runtime correctness | Documented in `BENCHMARKS.md` |

## Relationship to the old hackathon docs

`HACKATHON_SOURCE_NOTES.md` and `HACKATHON_SUBMISSION_CHECKLIST.md` describe the earlier Nebius x NVIDIA hackathon and its 30 October 2026 deadline. They are retained for history and marked deprecated. This document is the current hackathon reference.
