# Orivoxx — Adapters

An adapter is the only place a harness choice enters a benchmark. It turns a task and a model identity into one process that runs inside the sandbox. The adapter never scores, never writes the result record, and never sees a platform secret.

## 1. Adapter matrix

| Adapter | Version | Kind | Model | Runtime | Network | Entry point |
|---|---|---|---|---|---|---|
| `fake` | 1.0.0 | baseline | `null` | In-process materialize | none | `packages/harness/src/adapters/fake.ts` |
| `python-openrouter` | 1.0.0 | harness | `MODEL_NAME` | Python 3.12 (stdlib only) | `model-proxy` | `/opt/orivoxx/agents/python_openrouter.py` |
| `aider-openrouter` | 1.0.0 | harness | `MODEL_NAME` | Aider 0.86.2 on Python 3.12 | `model-proxy` | `/opt/orivoxx/agents/aider_runner.py` |

The fake adapter is the CI baseline and the self-serve public path. It never calls a model and its rows are labelled `Fake fixture (task/variant)`. The two real adapters are organizer-executed and record the model identity on every row.

There is no OpenCode CLI adapter. The point of the benchmark is to compare harness configurations, so the harness is explicit: a hand-written agent loop and Aider.

## 2. Common contract

Every adapter implements `AgentAdapter` from `packages/harness/src/contracts.ts`:

```ts
interface AgentAdapter {
  id: string;          // contract-validated kebab-case
  version: string;     // semver, recorded on the result
  label: string;       // shown in the UI
  kind: "baseline" | "harness";
  model: AdapterModel | null;
  plan(input: AdapterRunInput): AdapterPlan;
}
```

`plan()` returns either a materialized fixture or one argv command. The command is validated against `AgentCommandSchema` before execution:

- no shell string, only `file` + `args`
- an environment allowlist (`ADAPTER_ENV_ALLOWLIST`)
- no provider-shaped secret values
- `OPENAI_API_KEY` / `AIDER_OPENAI_API_KEY` may only be the literal sentinel `orivoxx-sandbox-proxy`

A real adapter requires `input.network === "model-proxy"` and refuses a run bound to a different model. That is what keeps a head-to-head honest: the same slug, one varying harness.

## 3. `python-openrouter`

A deliberately small agent loop, ~300 lines of standard-library Python. It exists so Orivoxx measures a transparent harness rather than a black box.

1. Reads `PROJECT_SPEC.md` and bounded starting files from `/workspace`.
2. Calls the model once for a JSON file plan (`{"files":["src/..."]}`).
3. Calls the model once per planned file for complete content.
4. Validates every path: relative only, no `..`, no NUL/backslash tricks, no `.git`/`node_modules`/`dist`, no `.env`, no lockfiles or `package.json`, allowed extensions only.
5. Enforces 10 files, 64 KiB per file, 256 KiB total, 64 KiB of context.
6. Writes with parent creation inside the workspace, never outside it.

Provider failures are safe: `HTTP <status>`, `unreachable`, `invalid JSON`, or `no choices`. The provider response body is never printed. A run that writes no files exits non-zero, so a failed harness is visible instead of silently scoring an empty repository.

Prompt rule: the specification is data. The system prompt tells the model to analyze it and ignore embedded instructions about how the agent works.

## 4. `aider-openrouter`

Aider 0.86.2 is pinned in the sandbox image (`/opt/aider`). The wrapper does three things:

1. Extracts spec-named paths from `PROJECT_SPEC.md` with a strict relative-path regex (max 12) and creates missing ones as empty files. The paths come from the task specification, not from the ruleset.
2. Runs Aider with the same model through the proxy and the sentinel key:
   `--edit-format whole --yes-always --no-auto-commits --no-git --no-gitignore --no-stream --no-pretty --no-suggest-shell-commands --map-tokens 0`.
3. Keeps Aider history under `/tmp`, so no harness bookkeeping enters the captured repository.

Aider reads `PROJECT_SPEC.md` as a read-only file and edits the spec-named file set. The wrapper exits non-zero if Aider fails or produces no content.

Aider is a second harness, not a second model. The head-to-head pair (`python-openrouter` vs `aider-openrouter`) uses one model slug so only the harness varies.

## 5. Model identity

Model configuration is environment-driven and recorded per run:

| Variable | Role |
|---|---|
| `MODEL_PROVIDER` | Provider label recorded on the result (default `openrouter`) |
| `MODEL_BASE_URL` | Provider base URL used by the proxy and recorded on the result |
| `MODEL_API_KEY` | Server-only key; `OPENROUTER_API_KEY` is accepted as the alias |
| `MODEL_NAME` | Default model slug |
| `FALLBACK_MODEL_NAME` | Optional second slug for resilience |
| `DEMO_SECOND_MODEL` | Same-harness/different-model demo run |

No model slug is a product invariant. Every row records `adapter.id`, `adapter.version`, `model.provider`, `model.name`, and `model.baseUrl`.

## 6. Running an adapter

```bash
# Build once
pnpm --filter @orivoxx/harness build
pnpm --filter @orivoxx/harness sandbox:build

# List tasks and adapters
pnpm bench:list

# Fake baseline (no model, no network)
pnpm bench:run --task taskboard --adapter fake --variant compliant

# Real harnesses, same model
pnpm bench:run --task taskboard --adapter python-openrouter --model openai/gpt-4o-mini
pnpm bench:run --task taskboard --adapter aider-openrouter --model openai/gpt-4o-mini

# Same harness, different model
pnpm bench:run --task taskboard --adapter python-openrouter --model deepseek/deepseek-chat-v3-0324
```

Each command appends to the configured store (Upstash when both Upstash variables are set, otherwise `.data/results`) and prints a bounded JSON summary: status, exit code, duration, score, benches, caps, tally, captured file/byte counts, and the last stdout/stderr lines. It never prints the prompt or the model response.

## 7. Recorded runs

Recorded on 15 November 2026, task `taskboard` 1.0.0, sandbox image `orivoxx/sandbox:1.0.0`, Docker with no host secrets. All three rows were appended to the shared Upstash store.

| Adapter | Model | Result | Overall | Spec / Sec / Maint | Caps | Wall time | Captured |
|---|---|---|---|---|---|---|---|
| `python-openrouter` | `openai/gpt-4o-mini` | `res_f74d49e5…` | 97.3 | 100 / 100 / 82.0 | none | 24.4 s | 7 files / 7 465 B |
| `aider-openrouter` | `openai/gpt-4o-mini` | `res_a39c6e29…` | 97.3 | 100 / 100 / 82.0 | none | 25.7 s | 7 files / 7 122 B |
| `python-openrouter` | `deepseek/deepseek-chat-v3-0324` | `res_71626175…` | 98.1 | 100 / 100 / 87.1 | none | 35.6 s | 9 files / 9 279 B |

The first two rows are the head-to-head pair: one model, two harnesses. The third is the same harness on a different model. The fake baseline rows (`99.5` compliant, `59.9` regressed) stay in `data/seed-results.json` as the checked-in fallback.

An earlier Aider run scored 94.4 because the spec-path extractor's extension alternation matched `.ts` before `.tsx` and produced `TaskList.ts`. The pattern was fixed, the image rebuilt, and the row above is the recorded replacement. The stale Upstash row remains fetchable by id but is not part of the comparison dataset.

## 8. Smoke tests

| Test | Scope |
|---|---|
| `src/adapters/adapters.test.ts` | Plan shape, model binding, network requirement, secret sentinel, registry contents |
| `src/adapters/python.integration.test.ts` | Real Python loop against a stub provider: plan, path filtering, fence stripping, provider error safety, missing spec |
| `src/sandbox/docker.integration.test.ts` | Docker isolation, proxy allowlist, quotas, cleanup (gated by `ORIVOXX_DOCKER_TESTS=1`) |

The Python loop test executes our own agent script against a local stub provider. It does not execute produced code and does not need Docker. The Aider smoke test is the recorded organizer run above, because Aider's own loop cannot be exercised meaningfully against a stub.

## 9. Adding an adapter

1. Add `src/adapters/<id>.ts` with a factory that validates its model and command.
2. Register it in `src/adapters/registry.ts`.
3. Add the agent entry point to `packages/harness/agents/` and copy it in `docker/sandbox.Dockerfile` if it needs to run in the image.
4. Add unit tests for plan shape, network, and model binding; add an integration test if the loop is ours.
5. Document it here and record a real run.
