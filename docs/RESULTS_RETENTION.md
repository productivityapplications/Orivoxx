# Orivoxx — Results, Retention, and Privacy

This document describes exactly what a stored benchmark result contains, where it lives, how long it is kept, and what is never stored.

## 1. What a result contains

One result is a JSON document produced by `runBenchmark()` and validated against `BenchmarkResultSchema` in `packages/results/src/contracts.ts`.

| Field group | Contents | Bound |
|---|---|---|
| Identity | `resultId`, `schemaVersion`, `createdAt` | Fixed format, immutable |
| Versions | `taskId`, `taskVersion`, `rulesetVersion`, `scoringConfigVersion`, `adapterVersion`, `repositoryFingerprint` | Required; a row missing one is rejected |
| Adapter | `adapter.id`, `adapter.version`, `adapter.label`, `adapter.kind`, `model.provider`, `model.name`, `model.baseUrl` | Model is `null` for the fake baseline |
| Run | `status`, `exitCode`, `durationMs` | Integers only |
| Score | `overall`, `benches`, `capsApplied`, `appliedCap`, `tally`, `score.requirements[]` | Published formula, one decimal place |
| Evidence | Per-requirement status, rule id, and validated source references | Requirement ids come from the task, never the model |
| Produced-code diff | `diff.text` unified diff, `diff.files[]` summary, counts, `truncated` | 256 KiB / 200 files / 400 lines per file |

The leaderboard index stores a projection without `score.requirements` and without `diff`, so a list read is bounded to a few hundred bytes per row.

## 2. What is never stored

- Full source trees or ZIP archives.
- Raw agent prompts, raw model responses, or provider request bodies.
- Provider API keys, Upstash tokens, or any secret candidate.
- A server-side execution handle. The scoring engine consumes normalized text only.

The produced-code diff is **text**, not an artifact. Files excluded by capture (`.env*`, keys, certificates, credentials, `.git`, `node_modules`, build output, binaries, generated assets) are not in the diff either.

## 3. Where results live

| Context | Store | Path or keys |
|---|---|---|
| Local organizer run | `LocalResultStore` | `.data/results/res_<id>.json` (gitignored) |
| Deployed / shared | `UpstashResultStore` | `orivoxx:v1:result:<id>`, `orivoxx:v1:rank:all`, `orivoxx:v1:rank:task:<taskId>` |
| Cold start / store down | `SeedResultStore` | `data/seed-results.json` (checked in, read-only) |

Upstash is written with a single Lua script: the result document and both sorted indexes commit together, and an existing id aborts the whole append. The local store uses `writeFile` with `flag: "wx"`, so the filesystem rejects an overwrite.

There is no update and no delete in the `ResultStore` interface. A re-run produces a new row with a new id; evidence is never rewritten.

## 4. Retention

| Data | Retention | Rationale |
|---|---|---|
| Result JSON (all stores) | 90 days from `createdAt` | Long enough for a hackathon demo and a public leaderboard; short enough to bound growth |
| Leaderboard index entries | 90 days, removed with the result | An index row without a fetchable result is a dead entry |
| Seed rows (`data/seed-results.json`) | Until the next regeneration commit | They are checked-in sample data, not user data |
| Produced-code diff | Same 90 days as the result that contains it | Bounded text inside the result document |
| Request logs | 30 days, safe metrics only | Request id, status, timing; never archive bytes or source |

Expiry is an organizer operation against the shared store: delete `orivoxx:v1:result:<id>` and the matching index members. The public app has no deletion endpoint and no account system, so there is nothing for a visitor to delete.

## 5. Privacy

- The public deployment is **read-only** for results. Visitors can read the leaderboard and individual results; they cannot write one.
- Real agent runs are executed by the organizer with `packages/harness` on an organizer machine. The model provider is OpenRouter through its OpenAI-compatible API; model identity is recorded per run.
- The scoring path makes **no model calls**. A result is reproducible from the task, ruleset, and captured repository text alone.
- When a model is used for an optional explanation, the context is disclosed in `PRIVACY_NOTICE.md`, sent only after explicit consent, and never stored in the result.
- The seed rows are fake-baseline runs of checked-in fixtures. They are labelled `Fake fixture (task / variant)` in the adapter name, so a sample row cannot be mistaken for a model result.
- Provider-side retention is governed by the provider's terms. Orivoxx does not claim zero retention.

## 6. Public API surface

| Route | Purpose | Notes |
|---|---|---|
| `GET /api/v1/leaderboard` | Ranked rows | `?taskId=` filter, `?limit=` 1–200, `cache-control: no-store` |
| `GET /api/v1/results/:id` | Full result by id | Same-origin reads only; 404 envelope for unknown or malformed ids |
| `GET /api/v1/health` | Non-secret status | Provider configured boolean, leaderboard store kind, seed availability |

Every response is `no-store` and includes `x-content-type-options: nosniff`. Error bodies are fixed envelopes with a code and a message; no stack traces, no store bodies, no provider errors.
