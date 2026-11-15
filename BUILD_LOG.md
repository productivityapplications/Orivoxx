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
