# Orivoxx — Benchmark Suite

**Status:** shipped benchmark contract. `packages/benchmarks` implements the task registry, rulesets, scoring configuration, and pure score function; `packages/harness` implements the adapters and Docker sandbox. The scorecard and leaderboard are live in `apps/web`. The exact model/provider is configuration, not a benchmark invariant.

This document defines what each bench measures, how it is scored, and what it deliberately does **not** measure. The last part is as important as the first: a deterministic benchmark is only honest if its boundaries are explicit.

## Design principles

1. **Deterministic scoring.** No LLM in the score. Rules are declared, versioned, and reproducible.
2. **Model-agnostic.** The same task can score Claude Code, Codex CLI, OpenClaw, or a custom Python agent through an adapter.
3. **Spec-first.** The task is a `PROJECT_SPEC.md`, not a hidden unit-test file. The agent is told what to build.
4. **Explainable.** Every point lost maps to a named rule, a requirement, an evidence record, and a source path/line where available.
5. **Versioned.** A score is only meaningful alongside its task version, ruleset version, and adapter version.

## 1. Spec-Conformance Bench

**Question:** did the agent build what the spec asked for?

**What it measures:** the fraction of declared requirements that pass their deterministic checks. Requirement types include required/forbidden files, required/forbidden text markers, required/forbidden dependencies, and required static source references.

**How it is scored (design):**

- Each requirement has a severity weight (`critical`, `high`, `medium`, `low`).
- `PASS` earns the requirement's weight; `FAIL` earns zero; `UNVERIFIED` earns zero and is reported separately so it cannot be mistaken for a pass.
- The bench score is `earned weight / total weight`, normalized to 0–100.
- A `critical` failure can cap the overall score or mark the run `BLOCKED`, depending on the task's scoring configuration. This is a per-task policy, not a global rule.

**What it does not measure:**

- Whether the software actually works at runtime.
- Whether the implementation is the best way to satisfy the requirement.
- Requirements that were not written as deterministic checks.
- Subjective interpretation of ambiguous prose in the spec.

**Current state:** the rule engine and verdict logic exist. A versioned benchmark task registry and scoring configuration do not. The TaskBoard fixtures are the first usable task candidate.

## 2. Security-Pattern Bench

**Question:** did the agent avoid known vulnerable patterns?

**What it measures:** rule pass-rate over a versioned security ruleset. Example rule families:

- Unsanitized input flowing into a dangerous sink.
- Hardcoded secrets or credentials in source.
- Unsafe deserialization.
- Missing authorization checks on mutating routes.
- Dangerous dependency presence.

The existing engine can express several of these as `text_not_contains`, `dependency_absent`, `file_absent`, and `source_reference_exists` checks. Richer data-flow rules are **not** implemented and would require a new rule type.

**How it is scored (design):**

- Each security rule is a binary pass/fail with a severity weight.
- The bench score is the weighted pass rate, normalized to 0–100.
- A critical security failure is always reported, even if the aggregate score is high.

**What it does not measure:**

- Complete vulnerability coverage. A passing ruleset means "none of these known patterns were detected", not "secure".
- Runtime exploitability.
- Vulnerabilities that require interprocedural data-flow analysis or dynamic testing.
- Secrets that do not match the redaction/rule patterns.
- Supply-chain risk beyond declared dependencies.

**Current state:** the rule types and secret redaction exist. There is no named security ruleset, no vulnerability database, and no data-flow analysis.

## 3. Maintainability Bench

**Question:** is the produced code structurally understandable?

**What it measures (planned):** graph metrics over the captured repository:

- Module count and file-size distribution.
- Fan-in/fan-out and coupling.
- Dependency cycles.
- Orphaned modules.
- Depth of the import graph.

**How it is scored (design):**

- Metrics are computed from the static import graph, not from model judgment.
- Each metric has a threshold or normalized curve defined in the task's scoring configuration.
- The bench score is a weighted combination of the metric scores, normalized to 0–100.
- Thresholds must be published with the task so the score is reproducible.

**What it does not measure:**

- Readability, naming, comments, or "code elegance".
- Architectural appropriateness.
- Test coverage or test quality.
- Whether the module boundaries match the domain.
- Runtime performance.

**Current state:** only the graph **contract** exists (`packages/core/src/graph/contracts`). The graph builder, path resolution, cycle detection, and metric computation are planned. Do not claim a maintainability score until those land.

## 4. Harness Bench (stretch)

**Question:** how much of the result comes from the harness rather than the model?

**What it measures:** two or more agent configurations run against the **same task version** and **same ruleset version**, with the model held constant where possible. The comparison isolates the effect of the harness: tool set, retry policy, context management, stopping conditions.

**How it is scored (design):**

- Each configuration receives the same deterministic score treatment as the other benches.
- The bench reports the score delta and per-rule differences between configurations.
- Results are grouped by task version so a harness comparison is never made across different tasks.

**What it does not measure:**

- A universal "best harness" ranking. Results are task-specific.
- Statistical significance from a single run. Multiple seeds/runs are required before claiming a reliable difference.
- Model quality independent of the harness.

**Current state:** no harness, no adapters, no runner. This is a stretch bench for after the core platform works.

## Reproducibility

Every result must record:

| Field | Why it is required |
|---|---|
| `taskId` + `taskVersion` | The spec and starting repository can change between versions. |
| `rulesetVersion` | The same repository can score differently under a changed rule set. |
| `adapterId` + `adapterVersion` | The harness is part of the measured system. |
| `scoringConfigVersion` | Weights, thresholds, and caps change the score. |
| `repositoryFingerprint` | Ties the result to the exact captured artifact. |
| `sandboxImage` | Tool and runtime differences can change agent behaviour. |
| `modelId` | Reported for attribution, not as the sole unit of comparison. |

A result missing any of the first five fields is not a valid leaderboard entry.

### Determinism rules

- The same `(taskVersion, rulesetVersion, scoringConfigVersion, repositoryFingerprint)` must produce the same score.
- Findings and evidence are ordered deterministically.
- The scoring engine makes no network calls and reads no ambient state.
- Time, randomness, and model output must not influence the score.
- If a rule cannot be evaluated because evidence is missing, the requirement is `UNVERIFIED`, never `PASS`.

## Score aggregation (shipped)

The score is a pure function of declared rule outcomes, structural metrics, and a versioned scoring configuration. It makes no model calls.

```text
benchScore   = 100 * sum(severityWeight[req] * pass[req]) / sum(severityWeight[req])
overall      = 0.60 * specScore + 0.25 * securityScore + 0.15 * maintainabilityScore
```

- **Severity weights:** critical 8, high 4, medium 2, low 1.
- **`pass[req]`:** `1` for `PASS`, `0` for `FAIL`, `DRIFT`, and `UNVERIFIED`. `UNVERIFIED` is reported separately and never counted as a pass.
- **Normalization:** absolute 0–100, rounded to one decimal. No percentile, rank, or cohort normalization.
- **Caps:** a critical spec `FAIL`/`DRIFT` caps `overall` at 59.9; a critical security `FAIL`/`DRIFT` caps it at 49.9. The cap is applied after the weighted sum and recorded in `capsApplied`. `UNVERIFIED` earns zero but does not trigger a cap: missing evidence is not a proven failure.
- **Versions:** `taskVersion`, `rulesetVersion`, `adapterVersion`, `scoringConfigVersion`, and `repositoryFingerprint` are mandatory on every result. A result missing any of them is rejected by `ScoreResultSchema` and is not leaderboard-valid.

### Maintainability score (shipped)

The import graph is built statically from JS/TS-family files. Test and mock files are excluded. Only relative imports that resolve to a captured module become edges; bare package imports are external and are not counted. Framework entrypoints (`app/**/{page,layout,route,error,...}`, `pages/**`, `middleware`, `instrumentation`, common `src/index|main` files) are not orphans.

```text
cycles       = strongly connected components with >1 module, plus self-imports
maxFanOut    = maximum distinct internal modules imported by one module
orphanRatio  = modules with zero internal in-edges and not an entrypoint / moduleCount
moduleCount  = captured JS/TS-family modules, excluding tests and mocks
```

For `cycles`, `maxFanOut`, and `orphanRatio`, with published `good` and `warn` thresholds:

```text
metricScore = 100                                       if value <= good
            = 100 - 30 * (value - good) / (warn - good)  if good < value <= warn
            = max(0, 70 - 30 * (value - warn) / warn)    if value > warn
```

`moduleCount` scores 100 inside the published `[min, max]` range, then degrades linearly to 60 at zero modules or at twice the maximum. `maintainabilityScore` is the mean of the four metric scores, rounded to one decimal. Default thresholds (`scoringConfigVersion 1.0.0`): cycles good 0 / warn 1, max fan-out good 8 / warn 12, orphan ratio good 0.10 / warn 0.25, module count 3–60.

### Worked example

Suppose a task has 10 requirements:

| Bench | Requirements | Earned weight | Total weight | Bench score |
|---|---|---:|---:|---:|
| Spec | 6 | 26 | 32 | 81.3 |
| Security | 3 | 12 | 16 | 75.0 |
| Maintainability | metrics | — | — | 90.0 |

`overall = 0.60 * 81.3 + 0.25 * 75.0 + 0.15 * 90.0 = 48.78 + 18.75 + 13.50 = 81.0`

If the failed requirement is a critical spec failure, the 59.9 cap applies and the result records `capsApplied: ["critical-spec-failure"]`.

Weights live in the task's scoring configuration, not in code. The UI must show the per-bench breakdown and the rule-level deductions. A single number without the breakdown is not sufficient evidence.

## Known limitations

- **Static only.** The engine reads text and manifests. It does not run tests, builds, or the produced application.
- **JavaScript/TypeScript first.** Static reference parsing covers JS/TS-family files. Other languages need new parsers.
- **Rules can be gamed.** An agent can satisfy a text marker without implementing the behaviour. Tasks should combine multiple checks and review the ruleset over time.
- **Coverage is not completeness.** A passing ruleset means the declared rules passed, not that the software is correct or secure.
- **Spec quality is a dependency.** Ambiguous requirements produce weak benchmarks. Task specs must be reviewed and versioned like code.
- **No human judgment in the score.** That is the point, but it means the benchmark cannot evaluate qualities that require judgment.
