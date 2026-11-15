# Submission draft — HackCulture AI Global Hackathon

Working copy for the Devpost form. Facts below are verifiable in the repository and the deployed app.

## Basics

| Field | Value |
|---|---|
| Project name | **Orivoxx** |
| Tagline | **Benchmark the agent, not just the model.** |
| Track | Build a Benchmarking Platform for AI Agents, Not Just Models |
| Live app | <https://orivoxx.vercel.app> |
| Repository | <https://github.com/productivityapplications/Orivoxx> |
| Demo video | `demo/orivoxx-demo.mp4` (2:38) — upload to the submission host |
| License | MIT |

## Short description

Orivoxx is a benchmarking platform for AI software-engineering agents. It runs an agent configuration against a versioned `PROJECT_SPEC.md` inside a hardened Docker sandbox, captures the produced repository, and scores it deterministically on spec conformance, security patterns, and structural maintainability. Every point traces to a named rule and evidence, and no model is in the score path.

## Inspiration

Agent leaderboards usually compare foundation models with one fixed harness. That hides the variable practitioners actually choose: the agent configuration. A different tool loop, edit format, or stopping condition changes the produced repository even with the same model. We wanted a benchmark where the harness is a first-class variable and the score is reproducible.

## What it does

1. **Versioned tasks.** TaskBoard and Linkstash each pin a spec, starting repository, ruleset, scoring configuration, and time limit.
2. **Sandboxed runs.** A model-agnostic harness runs the agent in Docker: non-root, read-only root filesystem, quotas, no platform secrets, and an allowlisted model proxy as the only egress.
3. **Static deterministic scoring.** Spec conformance (60%), security patterns (25%), and structural maintainability (15%). Severity weights, published caps (59.9 / 49.9), and `UNVERIFIED` semantics. No produced code is executed.
4. **Immutable records.** Task, ruleset, scoring-config, adapter, and repository fingerprint are recorded on every row. The store is append-only.
5. **Result explorer and leaderboard.** Requirement rows with declared rule and outcome, bounded diff text, caps, versions, and a head-to-head comparison.
6. **Self-serve baseline.** Anyone can run the fake baseline without a model call and get a real result.

## How we built it

- **Scoring:** TypeScript, Zod, Vitest. Deterministic rule engine and a static JS/TS import graph. A test asserts the score import graph contains no provider or adapter module.
- **Harness:** adapter contract, Docker executor, allowlisted model proxy, bounded artifact capture, secret redaction, produced-code diff.
- **Adapters:** `fake` baseline; `python-openrouter` (standard-library Python agent loop); `aider-openrouter` (Aider 0.86.2 pinned in the image).
- **Data:** append-only `ResultStore` with local JSON, Upstash Redis, and a bundled seed fallback.
- **Web:** Next.js 16 App Router, React, Tailwind, dark-only list-first UI, read APIs, fake run endpoint, shared rate limiting, origin checks, CSP.
- **Demo:** Playwright screen recordings, ffmpeg assembly, captions, loudness normalization.

## Recorded results

Task `taskboard 1.0.0`, same task and ruleset for all rows.

| Adapter | Model | Overall | Spec / Security / Maintainability | Caps |
|---|---|---|---|---|
| python-openrouter | openai/gpt-4o-mini | 97.3 | 100 / 100 / 82.0 | none |
| aider-openrouter | openai/gpt-4o-mini | 97.3 | 100 / 100 / 82.0 | none |
| python-openrouter | deepseek/deepseek-chat-v3-0324 | 98.1 | 100 / 100 / 87.1 | none |

The first two rows are the head-to-head: one model, two harnesses. Fake-baseline fixtures record 99.5 compliant and 59.9 regressed.

## Challenges

- Keeping the score path free of model influence while still offering a useful product. The answer: the model is never an input to a verdict; optional explanation is a separate surface and does not ship in this build.
- Making a sandbox that is genuinely isolated but still usable by real agents. The proxy sidecar is the only egress; the agent joins only an internal network.
- Reproducibility across versions. Version fields and a repository fingerprint are required, not optional metadata.
- Time and provider quotas. The demo narration provider hit a free-tier quota; the fallback is documented in `demo/README.md`.

## Accomplishments

- A deterministic score with published caps and per-requirement evidence.
- A real Docker sandbox with a tested allowlist: traversal, methods, body budgets, secret injection, no raw internet.
- Two real harnesses compared on one model, with recorded runs.
- An append-only store that works from Upstash, local JSON, or bundled seed data.
- A public app with rate limiting, same-origin enforcement, CSP, and safe error envelopes.
- 459 unit tests, 5 Playwright E2E tests, and a gated Docker integration suite.

## What we learned

- Harness choice is measurable. The two harnesses produced different repositories and different maintainability despite the same score.
- Text-marker checks are easy to game; a benchmark needs structural checks and honest limitations.
- Deterministic scoring forces better task design: every requirement must name its evidence.

## What's next

- A hosted run queue for public agent submissions.
- More language parsers for the structural bench.
- An optional, consent-gated explanation panel that never touches the score.
- Per-task leaderboards with confidence intervals over repeated runs.
- A scheduled retention job.

## Built with

`next.js` · `react` · `typescript` · `tailwindcss` · `zod` · `vitest` · `playwright` · `docker` · `upstash-redis` · `openrouter` · `aider` · `python` · `ffmpeg` · `pnpm`

## Honest limitations

- Static analysis only; the scoring engine never runs produced code, tests, or builds.
- JS/TS import parsing first; other languages need new parsers.
- A passing ruleset means the declared rules passed, not that the software is correct.
- Real adapter runs are organizer-executed because they require Docker and provider credentials.
- The demo narration is a local voice fallback after the ElevenLabs free quota was exhausted; this is documented, not hidden.
