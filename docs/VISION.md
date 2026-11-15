# Orivoxx — Vision

**Benchmark the agent, not just the model.**

## The problem

Most agent leaderboards are model leaderboards in disguise. They fix one harness, one prompt, one tool set, and one stopping policy, then compare foundation models on a static task suite. The resulting rank tells you how those models performed under that one configuration. It does not tell you how well an agent — the compound system — performs when the harness changes.

That gap matters because real agent performance is won or lost in the harness: how tools are described, how failures are retried, how context is compacted, when the loop stops, and whether the agent verifies its own work before declaring success. A strong model with a weak harness can lose to a weaker model with a disciplined one.

## The insight

If the harness is where much of the performance lives, then the benchmark must measure the harness. That means:

- The unit of evaluation is an **agent configuration**, not a model ID.
- The task must be a **versioned specification**, not a hidden test file.
- The score must be **deterministic** so two runs of the same agent on the same task can be compared.
- The result must be **explainable** so a lost point can be traced to a rule, a requirement, and a source location.

## The Orivoxx answer

Orivoxx is a benchmarking platform for AI software-engineering agents. A benchmark task supplies a `PROJECT_SPEC.md`. A harness runs an agent against that spec in a sandbox and captures the repository it produces. The scoring engine then analyzes the repository **statically** against a versioned ruleset:

- **Spec conformance** — did the agent build what the spec asked for?
- **Security patterns** — did it avoid known vulnerable patterns?
- **Structural maintainability** — is the produced code modular and free of obvious dependency cycles?

Every task, ruleset, and adapter is versioned. Every score is reproducible from those versions plus the captured repository. Every deduction is designed to point to a named rule violation with an artifact.

## What we are not

- **Not an LLM judge.** The model does not decide pass or fail. Deterministic rules do.
- **Not a static QA benchmark.** The task is a product specification, not a unit-test suite. We measure whether the agent built the requested software, not whether it can guess a hidden assertion.
- **Not a leaderboard of foundation models.** A result is attributed to an agent configuration (model + harness + tools + orchestration), not to a bare model name.
- **Not a code generator or fixer.** Orivoxx does not write or patch the agent's output.
- **Not a general code-quality grader.** Subjective style, readability, and architectural taste are outside the score.

## Not in scope

These are explicit exclusions, not backlog items:

- Model training, fine-tuning, or inference hosting.
- Subjective code-quality grading (style, naming, "elegance") in the score.
- LLM-judged correctness or LLM-generated scores.
- Automatic code fixes or agent-authored patches applied by the platform.
- A general-purpose coding course, quiz platform, or progress tracker.
- Accounts, teams, billing, or persistent user project history in the hackathon build.
- Runtime correctness guarantees for the agent's software. Orivoxx measures static evidence, not production behaviour.

## Current status

The deterministic verification engine described here exists in `packages/core`: spec parser, rule engine, evidence registry, verdict/gate logic, report contract, and safe archive intake. The benchmark layer — task registry, harness, sandbox runner, scoring service, leaderboard, and result explorer — is planned and is the current hackathon build. See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`BENCHMARKS.md`](BENCHMARKS.md).

> `TODO(verify)`: numeric scoring and leaderboard persistence do not exist yet. Do not describe them as shipped until the code lands.
