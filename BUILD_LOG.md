# BUILD_LOG — Orivoxx benchmark platform

Running log for the autonomous build. Newest entries at the bottom. This is a record, not an approval gate.

## 2026-11-15 — Phase 0 pre-flight

**Inputs received:** defaults accepted; LICENSE holder “Orivoxx Contributors”; push and Vercel deployment authorized; OpenRouter only; Nebius demoted; adapters `fake`, `python-openrouter`, `aider-openrouter`; OpenCode CLI removed as an adapter; reference video at `demo/reference/reference.mp4` (confirmed present, 8.8 MB); Docker/package install/network permissions granted.

**Environment verified:** Linux root shell; Node 22 default but Node 24.22.1 available at `~/.nvm/versions/node/v24.22.1`; pnpm 10.34.5; git 2.43.0; ffmpeg 6.1.1 with libx264/aac; Python 3.12.3; Docker 29.1.3 daemon running; Playwright Chromium cached; network egress to npm/GitHub/Vercel/OpenRouter/ElevenLabs; ~19 GB free; `gh` authenticated as `onyebuchidaniel60`; `vercel` authenticated as `onyebuchidaniel60-1034`; no `Status.txt`.

**Baseline commit:** `docs: reposition Orivoxx as an agent benchmark platform` (19 doc files + `.gitignore`, HEAD before this build `364a112`).

### DECISIONS

- **Provider:** OpenRouter only for the featured path. `MODEL_PROVIDER=openrouter`, `MODEL_BASE_URL=https://openrouter.ai/api/v1`, `MODEL_API_KEY` falls back to `OPENROUTER_API_KEY`. Nebius adapter remains optional/demoted.
- **Models verified available on OpenRouter:** `openai/gpt-4o-mini`, `deepseek/deepseek-chat-v3-0324`, `deepseek/deepseek-v3.2`, `deepseek/deepseek-v4.1-flash-1017:batch`.
- **Model plan:** default `MODEL_NAME=openai/gpt-4o-mini`; fallback `deepseek/deepseek-chat-v3-0324`; demo second model `deepseek/deepseek-chat-v3-0324`; head-to-head harness pair uses `deepseek/deepseek-v3.2` so both harnesses share one model.
- **Scoring:** spec 60 / security 25 / maintainability 15; severity critical 8 / high 4 / medium 2 / low 1; absolute 0–100, one decimal; `UNVERIFIED` = 0 earned, reported separately; critical spec cap 59.9, critical security cap 49.9.
- **Storage:** `ResultStore` interface; local append-only JSON under `.data/results`; Upstash Redis in deployment; checked-in seed results. 90-day artifact retention; scorecard JSON only, no full source artifacts.
- **Sandbox:** Docker, non-root, read-only rootfs, tmpfs workspace, quotas, no platform secrets, internal network + allowlisted model proxy.
- **Task policy:** root `PROJECT_SPEC.md` stays historical; each task owns a versioned spec; `docs/BENCHMARK_TASK_TEMPLATE.md` added.
- **Submission policy:** fake adapter public/self-serve; real adapters organizer-executed and labeled.
- **License:** MIT, “Orivoxx Contributors”, 2026. Recorded under NEEDS_FROM_HUMAN for correction before submission.
- **No music** in the demo unless the reference has it; default hard cuts and restrained lower-thirds.
- **Autonomous build:** P0–P11 continuous; commit per phase.

### NEEDS_FROM_HUMAN

- Confirm the final LICENSE copyright holder before public submission (currently “Orivoxx Contributors”).
- Confirm the public Vercel URL after deployment (generated during P11).
- Optional: provide Claude Code / Codex keys for extra adapters; not required.

## 2026-11-15 — P0 complete

- Added `LICENSE` (MIT).
- Amended `AGENTS.md`: rule 3 now permits sandboxed execution and states the static-scoring invariant; provider section moved to OpenRouter; added score/sandbox/version invariants.
- Rewrote `IMPLEMENTATION_PLAN.md` to P0–P11; appended the old verifier plan under `## Historical (verifier era, superseded)` with demoted headings.
- Updated `AI_HANDOFF.md`.
- Recorded decisions above.
- Next: P1 `packages/benchmarks`.

## 2026-11-15 — P1 complete (`packages/benchmarks`)

**Changed files**

- `packages/benchmarks/` new workspace package: `package.json`, `tsconfig.json`, `tsconfig.typecheck.json`, `eslint.config.mjs`, `vitest.config.ts`.
- `src/contracts/scoring.ts`, `src/contracts/task.ts`, `src/contracts/index.ts` — Zod contracts for semver, bench/severity weights, structural thresholds, scoring config, task manifest, ruleset, task definition, task summary.
- `src/fingerprint.ts` — canonical JSON + SHA-256 ruleset fingerprint.
- `src/tasks/build.ts` — deterministic-only enforcement, bench assignment validation, spec/starting-file agreement, ruleset construction.
- `src/tasks/registry.ts` — deterministic registry with semver ordering, pinned tasks, duplicate/empty rejection.
- `src/tasks/taskboard/` — task spec (9 deterministic requirements), starting repo, compliant/regressed fixtures, generated TS.
- `src/tasks/linkstash/` — second task (12 requirements: 9 spec, 3 security), starting repo, compliant/regressed fixtures, generated TS.
- `src/files.ts` — normalized project files: path validation, exclusion, secret redaction, fingerprint, language detection.
- `src/scoring/config.ts` — `scoringConfigVersion 1.0.0`: spec 60 / security 25 / maintainability 15, severity 8/4/2/1, caps 59.9/49.9, structural thresholds.
- `scripts/generate-task-assets.mjs` — regenerates task asset modules from specs/starting/fixtures.
- `docs/BENCHMARK_TASK_TEMPLATE.md` — task authoring contract.
- `packages/core/src/archive/redact.ts` — added OpenRouter key redaction category (`sk-or-v1-…`), needed because produced/starting files may embed keys.

**Verification**

- `pnpm --filter @orivoxx/core test` → 16 files, 217 tests passed.
- `pnpm --filter @orivoxx/benchmarks test` → 2 files, 26 tests passed.
- `pnpm --filter @orivoxx/benchmarks typecheck` → exit 0.
- `pnpm --filter @orivoxx/benchmarks lint` → exit 0.
- `pnpm --filter @orivoxx/benchmarks build` → exit 0, dist emitted (gitignored).

**Decisions**

- TaskBoard's original semantic auth requirement is projected to a deterministic `text_contains` marker (`assertProjectOwner`), so the benchmark keeps a model-free score path. Recorded in the task spec preamble.
- The root `PROJECT_SPEC.md` stays historical; each task owns its own `PROJECT_SPEC.md` inside `packages/benchmarks`.
- Generated task assets are checked in so the web app and CLI do not need the generator at runtime; the generator is the source of truth and is re-run whenever fixtures change.
- `tsconfig.typecheck.json` maps `@orivoxx/core` to source with `rootDir: ../..`; `tsconfig.json` (build) resolves the built package. This avoids emitting core files into the benchmarks package.
- Fixture and starting directories are excluded from typecheck/build: they are untrusted benchmark inputs, not workspace source, and they intentionally contain `next/server` imports and unsafe patterns.

**Known issues**

- `packages/core` build currently emits `.js/.d.ts/.map` into `src` when run without a clean; stray files were deleted. Root cause is the `prebuild` chain invoking `tsc` with a `rootDir` that resolves oddly under `pnpm -r`; tracked for P3 when the package build graph is revisited.

## 2026-11-15 — P2 complete (`packages/harness`)

**Changed files**

- `packages/harness/` new workspace package with build/typecheck/lint/vitest config.
- `src/contracts.ts` — `AdapterRunInput`, `AgentCommand`, `AdapterRunOutput`, `CapturedFile`, artifact stats, `AgentAdapter`, `AgentExecutor`, hard limits, and the sandbox env allowlist. Command env rejects unknown names, provider-shaped secrets, and non-sentinel API keys.
- `src/capture.ts` — bounded recursive artifact capture: path validation, exclusion denylist, symlink rejection, per-file/aggregate/file-count ceilings, UTF-8 and binary checks, secret redaction, deterministic repository fingerprint, conversion back to `NormalizedFile` for static scoring.
- `src/workspace.ts` — run workspace creation, empty-directory precondition, safe starting-file/produced-file writes with containment checks, guarded cleanup.
- `src/run.ts` — `runAdapter()` orchestration and `buildAdapterRunInput()` from a versioned task; bounded/redacted stdout/stderr summaries; status derivation; output schema validation.
- `src/adapters/fake.ts` — baseline adapter that materializes a compliant or regressed task fixture without a model.
- `src/adapters/registry.ts` — adapter lookup and summaries (only `fake` until P6).
- Tests: 32 across contract validation, capture bounds/symlinks/redaction/fingerprint, fake run, argv-only process execution, timeout/failure status, workspace preconditions, registry, cleanup safety.

**Verification**

- `pnpm --filter @orivoxx/harness test` → 3 files, 32 tests passed.
- `pnpm --filter @orivoxx/harness typecheck` → exit 0.
- `pnpm --filter @orivoxx/harness lint` → exit 0.
- `pnpm --filter @orivoxx/harness build` → exit 0.

**Decisions**

- Capture rejects (does not truncate) aggregate and file-count overruns. Truncation would silently change the score; a bounded failure is the defensible behavior.
- A single oversized file or binary file is excluded with a warning, matching core archive-intake behavior; the run still captures the rest of the repository.
- Symlinks anywhere in the captured tree fail capture. The walk prunes excluded directories first, so dependency trees are never traversed.
- `OPENAI_API_KEY` / `AIDER_OPENAI_API_KEY` inside the sandbox may only hold the `orivoxx-sandbox-proxy` sentinel; the real provider key never enters a container. This lets Aider-style harnesses start while the allowlisted proxy injects the real credential host-side.
- Fake adapter output is explicitly a baseline: model is `null` and the label names the fixture variant, so the leaderboard can never mistake it for an agent result.

**Known issues**

- Process adapters still need the P4 Docker executor. Until then only `fake` is runnable end to end.

## 2026-11-15 — P3 complete (deterministic score)

**Changed files**

- `packages/core/src/report/pipeline.ts` — extracted `computeRepositoryFingerprint()` (path + content fingerprints) so the harness and the scorer share one repository identity.
- `packages/harness/src/capture.ts` — capture fingerprint now delegates to the core function.
- `packages/benchmarks/src/contracts/score.ts` — Zod result contract: version fields, bench scores, structural metrics, requirement outcomes, caps, unverified IDs. Rejects duplicate requirement IDs, a cap without a reason, and an overall above its cap.
- `packages/benchmarks/src/scoring/score.ts` — pure `scoreRun()`: severity-weighted bench scores, `UNVERIFIED` earns zero without capping, critical-failure caps at 59.9/49.9, deterministic ordering, version/fingerprint enforcement.
- `packages/benchmarks/src/scoring/structural.ts` — static import graph: module set, resolved relative edges, Tarjan SCC cycle count, max fan-out, entrypoint-aware orphan ratio, published degradation curves.
- `packages/benchmarks/src/scoring/evaluate.ts` — static evaluation entry point: core checks → outcomes → structural metrics → score. No produced code is executed.
- `packages/benchmarks/src/tasks/registry.ts` — registry now rejects a task without at least one spec and one security requirement.
- Tests: 63 in `@orivoxx/benchmarks`, including determinism, ordering, `UNVERIFIED`, caps, weight changes, version-field rejection, structural thresholds, fixture evaluation, and an import-graph proof test.
- `docs/BENCHMARKS.md` — published maintainability formula and corrected cap reason names.

**Verification**

- `pnpm --filter @orivoxx/benchmarks test` → 6 files, 63 tests passed.
- `pnpm --filter @orivoxx/benchmarks typecheck` → exit 0.
- `pnpm --filter @orivoxx/benchmarks lint` → exit 0.
- `pnpm --filter @orivoxx/benchmarks build` → exit 0.
- `pnpm --filter @orivoxx/core test` → 217 tests passed.
- `pnpm --filter @orivoxx/harness test` → 32 tests passed.
- Manual score check: TaskBoard compliant `99.5` (spec 100, security 100, maintainability 96.7, no cap); regressed `59.9` (spec 52.4, security 100, maintainability 90, `critical-spec-failure` cap).

**Deterministic proof**

- `import-graph.test.ts` walks the real import graph from `score.ts`, `evaluate.ts`, `structural.ts`, and `round.ts`. It fails if the graph reaches `@orivoxx/harness`, `apps/web`, Nebius, OpenAI, Anthropic, `undici`, `node:http(s)`, `node:net`, `node:dns`, or `node:child_process`; if the source contains `fetch(`, `process.env`, `Math.random`, `Date.now`, `new Date`, or `child_process`; or if it depends on anything outside `@orivoxx/core`, `node:path`, and `zod`.

**Decisions**

- Scores are absolute, one decimal, with bench scores rounded before the weighted sum so the displayed breakdown adds up.
- `FAIL` and `DRIFT` trigger critical caps; `UNVERIFIED` does not. Missing evidence already earns zero; treating it as a proven critical failure would overstate certainty.
- Only relative, resolvable JS/TS imports become graph edges. Bare package imports and unresolved aliases are not invented into the graph; unresolved relative imports are reported as warnings.
- Test and mock files are excluded from the module graph so the maintainability bench measures production structure.
- Structural degradation is linear between and beyond published thresholds rather than a coarse pass/warn step, so improving a metric always improves the score.

**Known issues**

- The static graph only understands JS/TS-family files and relative imports. Tasks in other languages would need a parser adapter; none are registered.

## 2026-11-15 — P4 complete (isolated sandbox runner)

**Changed files**

- `packages/harness/src/sandbox/docker.ts` — `SandboxRunner` (alias of `AgentExecutor`) and `DockerExecutor`: image preflight, workspace ownership, network setup, proxy sidecar lifecycle with readiness probe, `spawn`-based container run, timeout kill, bounded output, guaranteed cleanup. `ensureSandboxNetworks()` exported for tests and tooling.
- `packages/harness/src/sandbox/proxy.ts` — allowlisted model proxy: `/v1`-only path allowlist, traversal/encoded-traversal rejection, GET/POST only, 1 MiB request budget (declared and streamed), 2 MiB response budget, 60 s upstream timeout, credential strip/inject, header allowlist, pinned target origin, `no-store`.
- `packages/harness/src/sandbox/proxy-server.ts` — sidecar entry point reading `MODEL_BASE_URL`, `MODEL_API_KEY`, `PROXY_PORT`.
- `packages/harness/src/sandbox/index.ts` — sandbox exports.
- `packages/harness/docker/sandbox.Dockerfile` — `node:24-bookworm-slim`, ca-certificates, git, python3 + venv, uid/gid 10001, `HOME=/tmp`.
- `packages/harness/scripts/build-sandbox.mjs` — image build; `packages/harness/scripts/write-proxy-package.mjs` — writes `dist/sandbox/package.json` (`type: module`) so the sidecar runs the ESM build from a read-only mount.
- `packages/harness/package.json` — `sandbox:build` script; build now emits the proxy package marker.
- `packages/harness/src/errors.ts` — sandbox error codes (`sandbox_unavailable`, `sandbox_image_missing`, `sandbox_proxy_misconfigured`, `sandbox_proxy_build_missing`, `sandbox_run_failed`).
- `packages/harness/src/sandbox/proxy.test.ts` — 18 unit tests.
- `packages/harness/src/sandbox/docker.integration.test.ts` — 12 Docker tests gated by `ORIVOXX_DOCKER_TESTS=1`.
- `docs/SANDBOX.md` — container profile, network topology, proxy policy, workspace lifecycle, timeouts, operations, test evidence.
- `docs/ARCHITECTURE.md` — shipped-status corrections for `packages/harness`, `packages/benchmarks`, `apps/runner` (superseded), scoring boundary, execution flow.

**Verification**

- `pnpm --filter @orivoxx/harness sandbox:build` → image `orivoxx/sandbox:1.0.0` built (id `771393837211`).
- `pnpm --filter @orivoxx/harness test` → 4 files, 50 tests passed; 12 integration tests skipped without the gate.
- `ORIVOXX_DOCKER_TESTS=1 pnpm --filter @orivoxx/harness test` → 5 files, 62 tests passed in ~39 s.
- `pnpm --filter @orivoxx/harness typecheck` → exit 0.
- `pnpm --filter @orivoxx/harness lint` → exit 0.
- `pnpm --filter @orivoxx/harness build` → exit 0; `dist/sandbox/proxy-server.js` + `package.json` present.
- Manual end-to-end run (agent writes the TaskBoard fixture inside Docker, `network: none`): status `completed`, exit `0`, 1020 ms, 8 captured files / 7 904 bytes, score `99.5` (spec 100, security 100, maintainability 96.7), 9/9 `PASS`, no cap, fingerprint `b6a8435d66ca568f…`.
- Post-run: `docker ps -a --filter name=orivoxx-` empty; no host files created outside the workspace.

**Deterministic boundary proof**

- The scoring import-graph test still passes. Adding the sandbox did not add any import from `packages/benchmarks` to `packages/harness`; `evaluateRepository` consumes `NormalizedFile[]` produced by `toNormalizedFiles(output.files)`.
- The integration test asserts the whole loop: Docker run → capture → score, and that `output.repositoryFingerprint` equals `score.repositoryFingerprint`.

**Sandbox proofs**

- Secrets: container env contains only `HOME`, `TMPDIR`, `NODE_ENV`, plus schema-allowlisted adapter variables. `MODEL_API_KEY`, `MODEL_BASE_URL`, and `OPENROUTER_API_KEY` are absent; host secret values never appear in the dump. `OPENAI_API_KEY` inside the container is exactly the `orivoxx-sandbox-proxy` sentinel.
- Network: with `network: "model-proxy"`, `/healthz` returns 200, a proxied POST reaches a sibling fake-provider container at `/api/v1/chat/completions` with `Authorization: Bearer <provider key>` injected host-side, while a direct request to that sibling container and a raw `1.1.1.1` request both fail.
- Filesystem: writes to `/etc/passwd`, `/escape-root.txt`, and `/workspace/../escape.txt` return `EROFS`/`EACCES`/`EPERM`; `/tmp` is writable; nothing appears on the host.
- Quotas: 2 s timeout kills a 120 s run (`timedOut`, no exit code, container removed); 4 KiB output budget truncates a 2 MiB stream; `pids-limit 64` yields `EAGAIN` for a 300-process fork loop; memory 512 MB, 1 CPU, 64 MB `/dev/shm`, 256 file descriptors.
- Cleanup: no `orivoxx-run-*` or `orivoxx-proxy-*` container survives any test.

**Decisions**

- `SandboxRunner` is exported as the platform's only permitted executor type; `DockerExecutor` is its single implementation. This satisfies the plan's "SandboxRunner interface plus Docker implementation" without inventing a parallel abstraction.
- The proxy sidecar joins the internal network **and** the egress network; the agent joins only the internal network. The plan wording said both containers on one network; splitting them is what makes "no unrestricted egress" testable. Recorded here as the authoritative topology.
- The workspace is an ephemeral host bind mount (chowned to 10001) rather than a tmpfs, because a container-owned tmpfs cannot be captured after exit. See `docs/SANDBOX.md` §5. Root filesystem is still `--read-only` with a bounded tmpfs `/tmp`.
- Proxy request mapping is `/v1/<suffix>` → `${MODEL_BASE_URL}/<suffix>`, so adapters use the standard OpenAI base URL and the provider base path (e.g. `/api/v1` on OpenRouter) is configuration, not adapter code.
- Proxy errors are fixed codes with no provider body, no stack trace, and no key material. Provider error statuses are passed through unchanged so an adapter can react to a 429.
- Container traffic cannot reach `host.docker.internal`: host-gateway is deliberately not added, so a compromised agent cannot probe host services.
- Integration tests are gated by `ORIVOXX_DOCKER_TESTS=1` but are part of the required verification for this phase and for any sandbox change.

**Known issues**

- The image ships Python 3.12 and Node 24 with no package manager cache. A `python-openrouter` adapter that wants `requests` must use the standard library or the image must be extended and versioned; adapter dependencies are pinned in the image, not installed at run time.
- Docker Desktop on macOS/Windows may refuse `chown` on bind mounts; `prepareWorkspace` falls back to `chmod -R a+rwX`. Linux organizer machines are the supported path.
- The proxy exposes no streaming-specific handling; it buffers responses up to 2 MiB. Streaming adapters still work if the whole response fits the budget, otherwise they receive `502 response_too_large`.

## 2026-11-15 — P5 complete (append-only leaderboard store)

**Changed files**

- `packages/results/` — new package.
  - `src/contracts.ts` — `BenchmarkResult` and `LeaderboardEntry` Zod contracts, `buildBenchmarkResult`, `tallyRequirements`, `deriveBenches`, `toLeaderboardEntry`. A `superRefine` enforces internal consistency: denormalized `overall`/`benches`/`tally`/`capsApplied`/version fields must equal the embedded scorecard, and a completed run must exit 0.
  - `src/store.ts` — `ResultStore` interface (`append`, `get`, `list`, `listByTask`), `ResultStoreError` codes, `compareLeaderboardEntries` (score desc, earlier `createdAt`, then `resultId`), `rankLeaderboard`, `clampLimit`.
  - `src/local.ts` — `LocalResultStore`: one immutable file per result under `.data/results`, `writeFile` with `flag: "wx"` so a duplicate id cannot overwrite evidence.
  - `src/upstash.ts` — `UpstashResultStore`: single Lua `EVAL` writes the result document plus `rank:all` and `rank:task:<id>` indexes atomically; an existing id aborts the whole append. Bounded ZRANGE with overscan, per-member validation, `store_unavailable` on transport/HTTP failures without leaking a response body.
  - `src/seed.ts` — `SeedResultStore`: read-only bundled rows; an invalid row is dropped with a `seed_res_<n>_invalid` diagnostic instead of failing the page.
  - `src/read.ts` — `readLeaderboard`/`readResult` fallback reads with an explicit `degraded` flag; `createResultStore` factory (Upstash when both env vars exist, local otherwise).
  - `src/id.ts`, `src/samples.ts`, `src/index.ts`, package/tsconfig/eslint/vitest config.
  - Tests: `contracts.test.ts`, `ordering.test.ts`, `local.test.ts`, `seed.test.ts`, `upstash.test.ts` — 53 tests.
- `packages/harness/src/diff.ts` — `buildProducedDiff`: bounded unified diff between the starting repository and the captured repository, LCS-based edit script, byte/file/lines-per-file budgets, `truncated` flag, deterministic file order. `src/diff.test.ts` — 11 tests.
- `packages/harness/src/benchmark.ts` — `runBenchmark`: adapter run → capture → `evaluateRepository` → diff → `buildBenchmarkResult`. `src/benchmark.test.ts` — 5 tests.
- `packages/harness/scripts/record-seed.mjs` — records `data/seed-results.json` from real Docker sandbox runs of the fake baseline.
- `packages/harness/scripts/publish-results.mjs` — organizer publisher: appends recorded results to the configured store, skips duplicates.
- `data/seed-results.json` — 4 rows (taskboard 99.5 / taskboard 59.9, linkstash 99.3 / linkstash 49.9), each a real recorded sandbox run.
- `apps/web/src/server/env.ts` — model provider env (`MODEL_PROVIDER`, `MODEL_BASE_URL`, `MODEL_API_KEY` with `OPENROUTER_API_KEY` alias, `MODEL_NAME`, `FALLBACK_MODEL_NAME`, `DEMO_SECOND_MODEL`), Upstash env, `ORIVOXX_DATA_DIR`. Nebius stays as an optional demoted block.
- `apps/web/src/server/results.ts` — server-only read layer: bundled seed store, store factory, `webLeaderboard`, `webResult`, `getSeedStatus`, fallback policy.
- `apps/web/src/app/api/v1/leaderboard/route.ts` — `GET /api/v1/leaderboard` with `taskId`/`limit` validation, `no-store`.
- `apps/web/src/app/api/v1/results/[id]/route.ts` — `GET /api/v1/results/:id`, fixed 404 envelope for unknown and malformed ids.
- `apps/web/src/app/api/v1/health/route.ts` — non-secret provider and leaderboard status.
- `apps/web/next.config.ts`, `apps/web/tsconfig.json`, `apps/web/vitest.config.mts`, `apps/web/package.json` — build/runtime wiring.
- `docs/RESULTS_RETENTION.md` — stored fields, exclusions, store layout, 90-day retention, privacy, API surface.
- `docs/ARCHITECTURE.md` — results package, read APIs, shipped statuses.
- `.gitignore` — `.data/`.
- Tests: web `src/server/results.test.ts`, `leaderboard/route.test.ts`, `results/[id]/route.test.ts` — 18 tests.

**Verification**

- `pnpm -r test` → core 217, benchmarks 63, results 53, web 18, harness 66 passed + 12 Docker tests skipped.
- `pnpm -r typecheck` → all packages and the web app pass.
- `pnpm -r lint` → all packages and the web app pass.
- `pnpm -r build` → all packages and `next build` pass; routes `/api/v1/health`, `/api/v1/leaderboard`, `/api/v1/results/[id]` are dynamic (`ƒ`).
- `node packages/harness/scripts/record-seed.mjs` → 4 rows written from real Docker sandbox runs.
- `SeedResultStore` load of `data/seed-results.json` → 4 rows, 0 diagnostics; first row `res_1ab24b38…` has a 3 611-byte diff over 4 files.
- `node --env-file=.env.local packages/harness/scripts/publish-results.mjs data/seed-results.json` → 4 appended to Upstash, 0 duplicates, 4 rows visible.
- Production server (`next start`, port 3101) against Upstash:
  - `GET /api/v1/health` → `{"model":{"provider":"openrouter","name":"openai/gpt-4o-mini","configured":true},"leaderboard":{"store":"upstash","seed":{"available":true,"rows":4}}}`
  - `GET /api/v1/leaderboard` → `store: "upstash"`, `degraded: false`, 4 rows ordered 99.5, 99.3, 59.9, 49.9.
  - `GET /api/v1/results/res_1ab24b38…` → 200, `cache-control: no-store`, `x-content-type-options: nosniff`, 9 requirement outcomes, 3 611-byte diff.
  - Unknown id → 404 `{"error":{"code":"not_found","message":"No result with that id is stored."}}`.
  - `?limit=999` → 400 `invalid_query` without echoing the input.
- Dev server without Redis config → `store: "seed"`, 4 rows, so the read path works from seed data alone.

**Decisions**

- The store interface has no update or delete. A re-run produces a new id; stored evidence is immutable. `ResultStoreError` codes are stable and safe to expose.
- Upstash ZSET score is `-overall` with the leaderboard JSON as the member, so `ZRANGE` is already ranked and the tie-break is completed in memory with a 50-row overscan.
- The seed file is imported as JSON at build time rather than read from a computed runtime path. The runtime-path version worked but made Next trace the whole project into the server bundle; bundling the JSON keeps the deployment small and independent of `process.cwd()`.
- Web fallback policy: shared-store error → seed with `degraded: true`; empty local store → seed, labelled sample data; production without a shared store → seed, read-only. An Upstash store that answers with zero rows stays empty (an empty shared store is a real state, not an error).
- Local development uses one root `.env.local`; `apps/web/.env.local` is a gitignored symlink to it so `next dev` and `next start` see the same values. Vercel uses dashboard env vars.
- `apps/web/tsconfig.json` no longer aliases `@orivoxx/core` to TypeScript source. The app consumes the built packages (`dist`), which keeps `.js` specifiers in package output resolvable by Turbopack.
- The web app depends on `@orivoxx/benchmarks` and `@orivoxx/results`; `pnpm -r build` orders the build topologically.

**Known issues**

- The local store scans every result file for `list()`. That is fine for a demo-scale directory; the shared store is indexed.
- The 90-day retention is documented and enforced by an organizer cleanup, not by a scheduled job. No scheduler exists in this build.
- The public leaderboard is read-only in deployment by design; writes are organizer-executed.
