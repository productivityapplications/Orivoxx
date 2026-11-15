# ORIVOXX — IMPLEMENTATION PLAN

- **Version:** Benchmark Platform v1.0
- **Positioning:** benchmark AI software-engineering agents, not just models.
- **Operating rule:** autonomous build P0–P11. Each phase ends with tests, an inspected diff, a local commit, and a `BUILD_LOG.md` entry. Phase 0 pre-flight was the only human approval gate.
- **Historical plan:** the verifier-era phases are preserved at the bottom under `## Historical (verifier era, superseded)`.

## Source of truth

1. `docs/VISION.md` — problem, positioning, exclusions.
2. `docs/ARCHITECTURE.md` — target architecture and shipped/planned boundaries.
3. `docs/BENCHMARKS.md` — four benches, scoring model, reproducibility.
4. `docs/FRONTEND_BENCHMARK_SPEC.md` — benchmark UI contract.
5. `AI_HANDOFF.md` — current state and next task.
6. `AGENTS.md` — implementation, security, and testing rules.

`PROJECT_SPEC.md`, root `ARCHITECTURE.md`, `FRONTEND_DESIGN_SPEC.md`, and `ORIVOXX_COMPLETE_BLUEPRINT.md` are historical verifier-era references. They are retained, not deleted.

## Decisions carried into the build

| Decision | Value |
|---|---|
| Model provider | OpenRouter through an OpenAI-compatible API. `MODEL_PROVIDER`, `MODEL_BASE_URL`, `MODEL_API_KEY` (or `OPENROUTER_API_KEY`), `MODEL_NAME`, `FALLBACK_MODEL_NAME`, `DEMO_SECOND_MODEL`. The old Nebius adapter is optional and demoted behind the same interface. |
| Scoring weights | Spec conformance 60%, security patterns 25%, structural maintainability 15%. |
| Severity weights | critical 8, high 4, medium 2, low 1. |
| Normalization | absolute 0–100, one decimal. No percentile or rank normalization. |
| Caps | critical spec failure caps overall at 59.9; critical security failure caps at 49.9. Caps appear in the breakdown. |
| `UNVERIFIED` | earns 0, reported separately; never treated as a pass. |
| Storage | append-only local JSON result store behind a `ResultStore` interface; Upstash Redis for deployed reads/writes; checked-in seed results for cold/absent Redis. |
| Retention | 90 days for result artifacts; score/findings metadata retained. No full source or ZIP in storage. |
| Sandbox | Docker: non-root, read-only rootfs, tmpfs workspace, `--network` restricted to an internal network with a host-side allowlisted model proxy, CPU/memory/PID/time quotas, no platform secrets. |
| Task policy | root `PROJECT_SPEC.md` stays historical; tasks carry their own versioned `PROJECT_SPEC.md`; `docs/BENCHMARK_TASK_TEMPLATE.md` is the authoring template. |
| Submission policy | fake adapter is public/self-serve; real adapters are organizer-executed and labeled. |
| Deployment | Next.js on Vercel for UI/APIs; real agent runs execute locally in Docker and write scorecards to Upstash. No separate runner service. |
| License | MIT, “Orivoxx Contributors”, 2026. |

---

## P0 — Pre-flight decisions resolved

**Objective:** Lock the decisions and boundaries before code.

**Inputs:** approved Phase 0 reply; current documentation pass.

**Deliverables:** `LICENSE`; amended `AGENTS.md`; this plan; updated `AI_HANDOFF.md`; `BUILD_LOG.md`; `docs/BENCHMARKS.md` scoring section; `PRIVACY_NOTICE.md` retention section; `.env.example` for the provider interface.

**Acceptance:** license exists; rule 3 explicitly permits sandboxed execution while forbidding execution outside the sandbox; scoring weights, storage, sandbox, and task policy are recorded; the historical verifier plan is preserved.

**Tests:** documentation consistency check; no secret in the diff.

**Commit:** `chore: resolve benchmark pre-flight decisions`.

**Decisions recorded:** provider, weights, storage, sandbox, task policy, license holder, deployment.

---

## P1 — `packages/benchmarks`

**Objective:** Make benchmark tasks and their versions first-class data.

**Inputs:** TaskBoard fixtures; the benchmark suite definitions.

**Deliverables:**

- `TaskManifestSchema` (Zod): id, version, title, summary, difficulty, bench tags, spec path, starting files, ruleset version, scoring-config version, limits, expected artifact contract.
- `RulesetSchema` and ruleset versioning.
- `ScoringConfigSchema` and scoring-config versioning.
- Task registry: `listTasks()`, `getTask(id, version?)`, deterministic ordering.
- First task: `taskboard@1.0.0`, derived from `packages/core/src/fixtures/taskboard-*/PROJECT_SPEC.md`.
- Second task: `linkstash@1.0.0`, a small bookmark API with spec-conformance and security requirements.
- `docs/BENCHMARK_TASK_TEMPLATE.md`.
- Tests: schema validation, duplicate IDs, unknown versions, spec parseability, manifest/spec agreement.

**Acceptance:** every task has explicit task/ruleset/scoring versions; TaskBoard spec matches the fixture contract; the registry is deterministic and importable by the web app and CLI.

**Commit:** `feat: add versioned benchmark task registry`.

---

## P2 — `packages/harness`

**Objective:** Define a model-agnostic adapter and artifact contract before running a real agent.

**Inputs:** task manifest and starting repository; sandbox decisions.

**Deliverables:**

- `AgentAdapter` interface: id, version, label, model identity, command construction, run metadata.
- `AdapterRunInput` / `AdapterRunOutput` Zod contracts.
- Bounded artifact capture: path validation, denylist, symlink rejection, per-file/aggregate limits, secret redaction, repository fingerprint.
- A fake/no-op adapter that writes the TaskBoard compliant fixture; tests only.
- Run metadata: started/completed times, exit status, bounded stdout/stderr summaries, warnings.
- Tests: adapter contract, artifact denial, oversized output, timeout, no shell interpolation.

**Acceptance:** the fake adapter produces a valid captured repository without any real provider; no produced file is executed.

**Commit:** `feat: add agent harness and bounded artifact capture`.

---

## P3 — Pure deterministic score function

**Objective:** Turn rule outcomes into a reproducible 0–100 benchmark score.

**Inputs:** parsed requirements, deterministic check outcomes, verdict output, evidence registry, structural metrics, scoring configuration.

**Deliverables:**

- Pure `scoreRun()` over requirement statuses and structural metrics.
- Bench mapping (spec/security/maintainability) and severity-weighted normalization.
- Caps for critical failures and a `capsApplied` record.
- Structural metrics: module count, import edges, cycles, max fan-out, orphan ratio, with published thresholds.
- Result record with `taskVersion`, `rulesetVersion`, `adapterVersion`, `scoringConfigVersion`, `repositoryFingerprint`.
- Tests: determinism, ordering, `UNVERIFIED` behavior, caps, weight changes, version-field enforcement, and an import-graph test proving no provider/adapter import.
- `docs/BENCHMARKS.md` scoring section updated with the shipped formula and a worked example.

**Acceptance:** the same `(taskVersion, rulesetVersion, scoringConfigVersion, repositoryFingerprint)` produces byte-identical score output; no model call exists in the score path.

**Commit:** `feat: add deterministic benchmark scoring`.

---

## P4 — Sandbox runner

**Objective:** Execute adapters safely and capture their workspace.

**Inputs:** P2 artifact capture; Docker decision.

**Deliverables:**

- Short design note: `docs/SANDBOX.md`.
- `SandboxRunner` interface plus Docker implementation: non-root, read-only rootfs, tmpfs workspace, CPU/memory/PID/time limits, no Docker socket, no platform secrets, internal network.
- Allowlisted model proxy: injects the provider key, forwards only the configured provider base URL, caps request/response sizes, no body logging.
- Artifact capture after the container exits; workspace cleanup.
- Fake adapter run end-to-end inside the sandbox, with a recorded result.
- Tests: quota enforcement, timeout kill, path escape, proxy allowlist, secret non-exposure, cleanup.

**Acceptance:** the fake adapter runs in Docker and produces a scoreable repository; the container has no host secret and no unrestricted egress; the scoring engine still receives only normalized files.

**Commit:** `feat: add isolated sandbox runner`.

---

## P5 — Leaderboard store

**Objective:** Make results append-only, queryable, and reproducible.

**Inputs:** result record; Upstash credentials; Vercel constraints.

**Deliverables:**

- `ResultStore` interface with `append`, `get`, `list`, `listByTask`.
- Local append-only JSON store (`.data/results`, gitignored).
- Upstash Redis implementation (sorted index + bounded scorecard JSON).
- Read API: `GET /api/v1/leaderboard`, `GET /api/v1/results/:id`.
- Checked-in `data/seed-results.json` for a cold/absent Redis.
- Retention and privacy documentation.
- Tests: append-only semantics, sorting/ties, schema validation, missing version fields rejected, seed fallback.

**Acceptance:** the leaderboard renders at least two real rows; a result can be fetched by ID; the deployed app works read-only from seed data when Redis is unavailable.

**Commit:** `feat: add append-only leaderboard store`.

---

## P6 — Real adapters

**Objective:** Compare real harnesses on the same task and model.

**Inputs:** OpenRouter key; Docker image; task registry.

**Deliverables, in order:**

1. `fake` adapter (already shipped in P2) as the CI baseline.
2. `python-openrouter`: a custom Python agent loop using the OpenAI-compatible proxy.
3. `aider-openrouter`: Aider as a second harness, same model and task.
4. Optional `claude-code` / `codex-cli` adapters if keys are provided; not required.

Each adapter has a smoke test, a recorded sample run, and an entry in `docs/ADAPTERS.md`. Head-to-head runs use the same model slug so only the harness varies. A second python run uses `DEMO_SECOND_MODEL` for same-harness/different-model.

**Acceptance:** at least two adapters are runnable; the head-to-head pair uses one model; results record adapter version and model identity; the comparison view has data.

**Commit:** `feat: add real OpenRouter agent adapters`.

---

## P7 — Web surfaces

**Objective:** Ship the public benchmark product.

**Inputs:** task registry, result store, UI spec.

**Deliverables:**

- `docs/FRONTEND_BENCHMARK_SPEC.md` written first: task catalogue, submit flow, scorecard, result explorer, leaderboard, comparison, states, accessibility, component inventory.
- Dark-only app shell and shared components.
- `/` landing, `/benchmarks`, `/benchmarks/[taskId]`, `/submit`, `/results/[resultId]`, `/leaderboard`, `/compare`, `/privacy`.
- API routes for tasks, runs, results, leaderboard, and optional explanations.
- Replace the old landing copy and `layout.tsx` metadata.
- Tests: component tests for score breakdown, empty/error states, keyboard navigation, responsive layout.

**Acceptance:** the catalogue shows task/ruleset versions; a fake run produces a scorecard with per-rule evidence; the leaderboard sorts correctly; comparison shows two adapters on one task.

**Commit:** `feat: build benchmark web surfaces`.

---

## P8 — Hardening

**Objective:** Make the public endpoints safe enough for judging.

**Inputs:** P7 routes.

**Deliverables:** Upstash rate limiting with fail-closed production behavior; same-origin/Host checks on mutating routes; body-size and concurrency limits; safe error envelopes; request IDs; CSP and security headers; consent gate for explanations; no source logging; abuse tests.

**Acceptance:** rate limits block repeat submissions; cross-origin POSTs are rejected; errors do not leak stack traces or provider details; the app remains usable when the provider is down.

**Commit:** `security: harden benchmark APIs`.

---

## P9 — README and in-app docs

**Objective:** Make the project legible to judges and new contributors.

**Inputs:** working app; screenshots.

**Deliverables:**

- Comprehensive root `README.md`: TOC, true badges, hero screenshot, problem, flow diagram, differentiators, four benches, quickstart, adding a task, adding an adapter, architecture, docs link, hackathon note, license, acknowledgements.
- At least six Playwright-captured screenshots under `docs/assets/`: leaderboard, catalogue, submit, scorecard, result explorer, comparison.
- `/docs` and `/docs/[...slug]` with sidebar, breadcrumb, search, and the required sections.
- Fresh-clone quickstart verification in a temp directory.
- Updated `docs/ARCHITECTURE.md`, `docs/BENCHMARKS.md`, `docs/HACKATHON.md`, `PRIVACY_NOTICE.md`, `AI_HANDOFF.md`.

**Acceptance:** README claims are verifiable; screenshots are real; `/docs` covers Overview through Hackathon; quickstart works from a clean clone.

**Commit:** `docs: add benchmark README and in-app documentation`.

---

## P10 — Demo video

**Objective:** Produce a narrated ~2:45 demo.

**Inputs:** reference video; ElevenLabs key/voice; running app; real results.

**Deliverables:** `demo/REFERENCE_NOTES.md`; `demo/SCRIPT.md`; per-scene audio; Playwright capture scripts; ffmpeg assembly; `demo/orivoxx-demo.mp4` (H.264/AAC, 1920×1080, ≤3:00); thumbnail; `demo/README.md`.

**Acceptance:** narration fits each scene; no gap over 600ms except deliberate beats; sync within 150ms; no spinners or half-rendered frames; audio normalized to −16 LUFS; every visual is a real screen recording.

**Commit:** `docs: add narrated Orivoxx demo`.

---

## P11 — Final audit and submission pack

**Objective:** Prove the build and prepare submission.

**Inputs:** all phases.

**Deliverables:** Playwright E2E for submit → run → score → leaderboard; deterministic-scoring proof; sandbox proof; final test run; deployed URL smoke test; Devpost field draft; final report; updated `BUILD_LOG.md` and `AI_HANDOFF.md`.

**Acceptance:** all tests green; E2E green; no secrets in the diff; repository pushed if authorized; Vercel deployment live; video within limits; final report covers every required section.

**Commit:** `chore: finalize benchmark submission pack`.

---

## Phase boundaries

- The autonomous build runs P0–P11 continuously. Do not stop for confirmation except for a true blocker.
- Each phase must conclude with actual commands/results, an inspected diff, and a local commit.
- If a requirement cannot be met, record the evidence and the smallest safe fallback in `BUILD_LOG.md`; do not invent a provider or silently drop a security invariant.
- Never execute produced code outside the harness sandbox. Never put an LLM in the score path.

---

## Historical (verifier era, superseded)

The plan below described the earlier deterministic-verifier product and the Nebius × NVIDIA hackathon. It is retained for contract history. It is not the current build plan.


> **Positioning update (15 November 2026):** This plan covers the verifier-era build and the earlier Nebius x NVIDIA hackathon. The current product is a benchmarking platform for AI software-engineering agents. Do not start benchmark-layer code from this plan; see `docs/ARCHITECTURE.md` and `docs/HACKATHON.md` for the target scope.

#### ORIVOXX — IMPLEMENTATION PLAN

- **Version:** Hackathon MVP v2.1
- **Submission deadline:** Friday, 30 October 2026, 6:00 p.m. WAT — historical
- **Operating rule:** One phase per coding-agent instruction. Implement → test → inspect → fix → commit → checkpoint → stop.

This plan follows `PROPER_VIBE_CODING_WORKFLOW.md`: specification and architecture before code, small independently testable phases, evidence-based verification, small Git checkpoints, and no automatic progression to the next phase.

##### Phase 0 — Bootstrap and Token Factory smoke test

**Objective:** Prove the chosen stack/model/provider before creating product logic.

**Dependencies:** Blueprint approved; Token Factory key and Upstash test credentials available.

**Tasks:** Create pnpm workspace, strict TypeScript, Next.js app, shared `packages/core`, testing/linting; add `.env.example`; include approved graph packages `@xyflow/react` and `@dagrejs/dagre` in the fixed stack; implement a tiny server-only smoke-test route/script that calls Token Factory model `nvidia/Nemotron-3.5-Super-VL` with a benign static prompt and validates a minimal JSON response. Do not yet accept user uploads or build product verification or graph interactions.

**Expected files:** `apps/web`, `packages/core`, root config, environment validation, provider adapter skeleton.

**API/DB/UI:** `/api/v1/health`; landing placeholder; no DB.

**Tests:** clean install; lint; typecheck; package build; provider adapter unit tests with mock; manual real-provider smoke test documenting actual model ID and response shape.

**Acceptance:** workspace builds; health endpoint is safe; API key never appears client-side; live Token Factory call succeeds or an explicit blocker is reported before later product implementation.

**Git checkpoint:** `chore: bootstrap orivoxx hackathon app`.

##### Phase 1 — Domain contracts and bundled TaskBoard fixtures

**Objective:** Create the canonical schemas, realistic sample project, and expected results.

**Tasks:** Define Zod contracts for project files, spec requirements, evidence, deterministic checks, AI assessments, findings, reports, explanations, and `ProjectGraph` nodes/edges. Add a pure `packages/core/src/graph` contract and test plan. Add `taskboard-regressed` and `taskboard-compliant` fixture directories with `PROJECT_SPEC.md`; ensure their graph comes from actual static imports in fixture files; document intended critical failure(s), compliant behavior, excluded sample secrets (none), and expected deterministic checks.

**Files:** `packages/core/src/contracts`, `packages/core/src/fixtures`, `packages/core/src/graph/contracts`, test fixture docs.

**Acceptance:** fixture specs parse; expected requirement IDs stable; graph schema validates; no provider call is hardcoded/faked as though it happened; fixture files are synthetic and publicly redistributable.

**Tests:** schema tests, fixture consistency, expected-baseline tests.

**Git checkpoint:** `feat: define verification contracts and demo fixtures`.

##### Phase 2 — Secure ZIP intake and specification parser

**Objective:** Accept bounded project ZIPs safely, without executing code or storing files.

**Tasks:** Implement ZIP parser, path normalizer, duplicate path rejection, symlink rejection, decompression limits, eligible text file filter, secret/build/dependency denylist, line index and fingerprints. Parse documented requirement blocks and declarative check subset. Add actionable validation errors.

**Files:** `packages/core/src/archive`, `spec-parser`, `inventory`, upload route validation.

**API:** normalized upload representation; `POST /api/v1/verify` request validator.

**Acceptance:** all hard limits enforced server-side; archive processed in memory; malicious paths cannot escape logical root; no shell calls; no file written to disk; missing/duplicate spec IDs fail safely; secret files excluded with warnings.

**Tests:** zip slip, symlink, duplicate normalized paths, zip bomb/size/count, binary files, `.env`, key pattern redaction, malformed Markdown, duplicate requirement IDs, Unicode/path edge cases.

**Git checkpoint:** `feat: safely ingest project archives`.

##### Phase 3 — Deterministic verifier and evidence registry

**Objective:** Make repeatable non-AI checks useful before model reasoning.

**Tasks:** Implement checks `file_exists`, `file_absent`, `text_contains`, `text_not_contains`, `dependency_present`, `dependency_absent`, `source_reference_exists`; evidence registry with generated IDs and line ranges; requirement/result status model; severity-aware gate; report serializer.

**Files:** `packages/core/src/checks`, `evidence`, `verdict`, `report`.

**Acceptance:** deterministic output repeatable for identical spec+file snapshot; failures include evidence; missing evidence never passes; deterministic FAIL cannot be overwritten by any semantic output; sample baseline expectations pass.

**Tests:** table-driven tests, property/fuzz tests for paths, gate precedence tests.

**Git checkpoint:** `feat: add deterministic specification checks`.

##### Phase 4 — Nebius Token Factory integration and semantic verification

**Objective:** Add a real runtime Nemotron call for semantic requirements.

**Tasks:** Implement server-only Token Factory adapter; timeouts; bounded input/output; safe prompt that treats uploaded spec and source as untrusted data; batch maximum 8 requirements; request structured JSON when supported; validate with Zod; verify requirement IDs and evidence refs; allow one repair retry; output partial result on provider failure.

**Files:** `apps/web/src/server/nebius`, `context-builder`, `semantic-verifier`, `/api/v1/verify`.

**Acceptance:** verified by a manual call in dev; response states actual model ID; invalid refs rejected; no key in client bundle; provider fail produces UNVERIFIED for AI-dependent requirements, not PASS; deterministic results remain visible.

**Tests:** mocks for success/empty/malformed/unknown ID/fabricated citation/timeout/429/5xx/token-budget overflow; contract test for returned shape.

**Git checkpoint:** `feat: verify semantic requirements with Nemotron on Nebius`.

##### Phase 5 — Dark map-first verification workspace

**Objective:** Implement the visual identity and the main differentiated view: a dependency graph that gives users a quick visual scan of where verified deviations occur.

**Read first:** `FRONTEND_DESIGN_SPEC.md`. Do not invent a light theme or redesign the layout.

**Screens/surfaces:** Dark landing/sample map; upload/consent; map-first `/workspace`; right inspector (`Details`, `Insights`, `Code`); findings list fallback; privacy; loading/empty/error/partial/no-graph/large-project states.

**Tasks:** Build the shared design tokens and AppShell; sample loader and upload/consent; map canvas with pan/zoom/fit/search/status filters/legend; deterministic graph layout; evidence-derived node colors; project/requirements rail; top gate/counts; inspector tabs; evidence navigation; findings list; JSON export/reset; responsive map/list mode and keyboard-accessible alternative. Graph node/edge construction comes from `packages/core/src/graph`; status colors come only from validated report evidence.

**Acceptance:** every route/state is dark-only; landing preview is labeled illustrative; active map is generated from actual static imports; selecting a red node opens the exact finding/evidence; FAIL/DRIFT red nodes always have validated source paths; unknown/unsupported imports do not create invented edges; unlocalized findings remain in the findings list; graph filters do not change counts; map click does not trigger AI; provider status is truthful; mobile has a usable findings/list fallback; keyboard/accessibility checks pass.

**Tests:** Playwright sample flow, invalid ZIP, consent not granted, provider partial, report export; unit/integration tests for graph parsing, path resolution, status aggregation and unknown references; keyboard and responsive checks; visual smoke checks against design tokens.

**Git checkpoint:** `feat: build dark map-first verification workspace`.

##### Phase 6 — Contextual teaching

**Objective:** Deliver explain-code and explain-finding using the same live Nemotron provider while keeping education separate from verification.

**Tasks:** Separate teaching prompts and Zod schemas; Beginner/Intermediate/Advanced depth; source line selection capped at 120 lines; finding explanation with evidence; concept/caveat/source-ref fields; redaction and current fingerprint; stale explanation behavior within current session; no raw snippets persist server-side.

**API:** `POST /api/v1/explanations/code`; `POST /api/v1/explanations/findings`.

**Acceptance:** teaching call is user-triggered, uses Token Factory, shows actual source refs only, identifies assumptions, output cannot mutate report state or gate, invalid citation fails safely, disclosure applies.

**Tests:** prompt-injection source fixtures, made-up reference rejection, depth schema tests, source-range bounds, explanation/verification independence, provider failure/retry.

**Git checkpoint:** `feat: teach code and verification findings`.

##### Phase 7 — Abuse protection, privacy and accessibility hardening

**Objective:** Make public API safe enough for hackathon judging.

**Tasks:** Upstash shared rate limits; body-size limits; same-origin Host/Origin checks; request IDs; safe errors; non-sensitive telemetry; no source body logging; CSP/security headers where applicable; privacy page; keyboard/screen reader pass; responsive pass; reduced motion; loading/error/empty states; cost guardrails.

**Acceptance:** rate limiting blocks repeat requests; API fails closed if rate limiting protection is unavailable in production; no source code/secrets appear in logs; no `NEXT_PUBLIC` secrets; app still loads sample if provider fails; archive security suite passes.

**Tests:** API abuse tests, security suite, axe/accessibility smoke tests, deployed environment config checks.

**Git checkpoint:** `security: harden public Orivoxx demo`.

##### Phase 8 — End-to-end release verification and deployment

**Objective:** Deploy the complete working app and prove the hackathon-required runtime path.

**Tasks:** Deploy to Vercel; configure live Token Factory and Upstash secrets; execute actual deployed sample verification and explanation; fix issues; add README, MIT LICENSE, screenshots, architecture summary, contribution/setup steps, model/provider attribution; add `.env.example`; ensure public repository is open-source and demo accessible without login.

**Acceptance:** live URL works on desktop/mobile; one real Token Factory/Nemotron request visible in demo; sample produces grounded findings; source upload/analyze/explain/export journey works; all CI checks pass; public repository and license accessible.

**Tests:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright against deployed URL, manual real-provider test.

**Git checkpoint:** `release: deploy Orivoxx hackathon MVP`.

##### Phase 9 — Submission pack and final audit

**Objective:** Submit before the deadline with all evidence complete.

**Tasks:** Record a public YouTube video less than three minutes; prepare Devpost title/description/track, demo URL, repo URL, video URL; fill provider/model explanation and required feedback; if deemed pre-existing, clearly document substantial changes made during submission period; recheck official page and deadline.

**Suggested video beats (2:35 max):** 0:00 problem; 0:15 load TaskBoard sample; 0:30 run verification showing real Nemotron/Token Factory step; 1:05 inspect failed requirement/evidence; 1:30 ask Orivoxx to teach authorization concept; 2:00 contrast compliant snapshot or JSON export; 2:20 architecture/model/infrastructure attribution; finish by 2:35.

**Acceptance:** Devpost required fields complete; public YouTube link plays without login; video under three minutes; demo/API still live; repository open-source license visible; submission confirmed before 6:00 p.m. WAT on Friday, 30 October 2026.

**Git checkpoint:** `docs: finalize Nebius hackathon submission package`.

##### Phase boundaries

- Do not begin the next phase automatically.
- Each phase must conclude with actual commands/results, inspected diff, known limitations, and a commit only if its acceptance criteria pass.
- If a requirement cannot be met due to platform/model/API incompatibility, STOP and report the evidence. Do not silently swap providers or models.
- `watch`, live Git, local CLI, test execution, direct coding-agent adapters, accounts, history, and quizzes are not permitted unless the human explicitly revises scope.
