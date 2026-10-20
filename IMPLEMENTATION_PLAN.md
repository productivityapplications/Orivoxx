# ORIVOXX — IMPLEMENTATION PLAN

**Version:** Hackathon MVP v2.1  
**Submission deadline:** Friday, 30 October 2026, 6:00 p.m. WAT  
**Operating rule:** One phase per coding-agent instruction. Implement → test → inspect → fix → commit → checkpoint → stop.

This plan follows `PROPER_VIBE_CODING_WORKFLOW.md`: specification and architecture before code, small independently testable phases, evidence-based verification, small Git checkpoints, and no automatic progression to the next phase.

## Phase 0 — Bootstrap and Token Factory smoke test

**Objective:** Prove the chosen stack/model/provider before creating product logic.

**Dependencies:** Blueprint approved; Token Factory key and Upstash test credentials available.

**Tasks:** Create pnpm workspace, strict TypeScript, Next.js app, shared `packages/core`, testing/linting; add `.env.example`; include approved graph packages `@xyflow/react` and `@dagrejs/dagre` in the fixed stack; implement a tiny server-only smoke-test route/script that calls Token Factory model `nvidia/Nemotron-3.5-Super-VL` with a benign static prompt and validates a minimal JSON response. Do not yet accept user uploads or build product verification or graph interactions.

**Expected files:** `apps/web`, `packages/core`, root config, environment validation, provider adapter skeleton.

**API/DB/UI:** `/api/v1/health`; landing placeholder; no DB.

**Tests:** clean install; lint; typecheck; package build; provider adapter unit tests with mock; manual real-provider smoke test documenting actual model ID and response shape.

**Acceptance:** workspace builds; health endpoint is safe; API key never appears client-side; live Token Factory call succeeds or an explicit blocker is reported before later product implementation.

**Git checkpoint:** `chore: bootstrap orivoxx hackathon app`.

## Phase 1 — Domain contracts and bundled TaskBoard fixtures

**Objective:** Create the canonical schemas, realistic sample project, and expected results.

**Tasks:** Define Zod contracts for project files, spec requirements, evidence, deterministic checks, AI assessments, findings, reports, explanations, and `ProjectGraph` nodes/edges. Add a pure `packages/core/src/graph` contract and test plan. Add `taskboard-regressed` and `taskboard-compliant` fixture directories with `PROJECT_SPEC.md`; ensure their graph comes from actual static imports in fixture files; document intended critical failure(s), compliant behavior, excluded sample secrets (none), and expected deterministic checks.

**Files:** `packages/core/src/contracts`, `packages/core/src/fixtures`, `packages/core/src/graph/contracts`, test fixture docs.

**Acceptance:** fixture specs parse; expected requirement IDs stable; graph schema validates; no provider call is hardcoded/faked as though it happened; fixture files are synthetic and publicly redistributable.

**Tests:** schema tests, fixture consistency, expected-baseline tests.

**Git checkpoint:** `feat: define verification contracts and demo fixtures`.

## Phase 2 — Secure ZIP intake and specification parser

**Objective:** Accept bounded project ZIPs safely, without executing code or storing files.

**Tasks:** Implement ZIP parser, path normalizer, duplicate path rejection, symlink rejection, decompression limits, eligible text file filter, secret/build/dependency denylist, line index and fingerprints. Parse documented requirement blocks and declarative check subset. Add actionable validation errors.

**Files:** `packages/core/src/archive`, `spec-parser`, `inventory`, upload route validation.

**API:** normalized upload representation; `POST /api/v1/verify` request validator.

**Acceptance:** all hard limits enforced server-side; archive processed in memory; malicious paths cannot escape logical root; no shell calls; no file written to disk; missing/duplicate spec IDs fail safely; secret files excluded with warnings.

**Tests:** zip slip, symlink, duplicate normalized paths, zip bomb/size/count, binary files, `.env`, key pattern redaction, malformed Markdown, duplicate requirement IDs, Unicode/path edge cases.

**Git checkpoint:** `feat: safely ingest project archives`.

## Phase 3 — Deterministic verifier and evidence registry

**Objective:** Make repeatable non-AI checks useful before model reasoning.

**Tasks:** Implement checks `file_exists`, `file_absent`, `text_contains`, `text_not_contains`, `dependency_present`, `dependency_absent`, `source_reference_exists`; evidence registry with generated IDs and line ranges; requirement/result status model; severity-aware gate; report serializer.

**Files:** `packages/core/src/checks`, `evidence`, `verdict`, `report`.

**Acceptance:** deterministic output repeatable for identical spec+file snapshot; failures include evidence; missing evidence never passes; deterministic FAIL cannot be overwritten by any semantic output; sample baseline expectations pass.

**Tests:** table-driven tests, property/fuzz tests for paths, gate precedence tests.

**Git checkpoint:** `feat: add deterministic specification checks`.

## Phase 4 — Nebius Token Factory integration and semantic verification

**Objective:** Add a real runtime Nemotron call for semantic requirements.

**Tasks:** Implement server-only Token Factory adapter; timeouts; bounded input/output; safe prompt that treats uploaded spec and source as untrusted data; batch maximum 8 requirements; request structured JSON when supported; validate with Zod; verify requirement IDs and evidence refs; allow one repair retry; output partial result on provider failure.

**Files:** `apps/web/src/server/nebius`, `context-builder`, `semantic-verifier`, `/api/v1/verify`.

**Acceptance:** verified by a manual call in dev; response states actual model ID; invalid refs rejected; no key in client bundle; provider fail produces UNVERIFIED for AI-dependent requirements, not PASS; deterministic results remain visible.

**Tests:** mocks for success/empty/malformed/unknown ID/fabricated citation/timeout/429/5xx/token-budget overflow; contract test for returned shape.

**Git checkpoint:** `feat: verify semantic requirements with Nemotron on Nebius`.

## Phase 5 — Dark map-first verification workspace

**Objective:** Implement the visual identity and the main differentiated view: a dependency graph that gives users a quick visual scan of where verified deviations occur.

**Read first:** `FRONTEND_DESIGN_SPEC.md`. Do not invent a light theme or redesign the layout.

**Screens/surfaces:** Dark landing/sample map; upload/consent; map-first `/workspace`; right inspector (`Details`, `Insights`, `Code`); findings list fallback; privacy; loading/empty/error/partial/no-graph/large-project states.

**Tasks:** Build the shared design tokens and AppShell; sample loader and upload/consent; map canvas with pan/zoom/fit/search/status filters/legend; deterministic graph layout; evidence-derived node colors; project/requirements rail; top gate/counts; inspector tabs; evidence navigation; findings list; JSON export/reset; responsive map/list mode and keyboard-accessible alternative. Graph node/edge construction comes from `packages/core/src/graph`; status colors come only from validated report evidence.

**Acceptance:** every route/state is dark-only; landing preview is labeled illustrative; active map is generated from actual static imports; selecting a red node opens the exact finding/evidence; FAIL/DRIFT red nodes always have validated source paths; unknown/unsupported imports do not create invented edges; unlocalized findings remain in the findings list; graph filters do not change counts; map click does not trigger AI; provider status is truthful; mobile has a usable findings/list fallback; keyboard/accessibility checks pass.

**Tests:** Playwright sample flow, invalid ZIP, consent not granted, provider partial, report export; unit/integration tests for graph parsing, path resolution, status aggregation and unknown references; keyboard and responsive checks; visual smoke checks against design tokens.

**Git checkpoint:** `feat: build dark map-first verification workspace`.

## Phase 6 — Contextual teaching

**Objective:** Deliver explain-code and explain-finding using the same live Nemotron provider while keeping education separate from verification.

**Tasks:** Separate teaching prompts and Zod schemas; Beginner/Intermediate/Advanced depth; source line selection capped at 120 lines; finding explanation with evidence; concept/caveat/source-ref fields; redaction and current fingerprint; stale explanation behavior within current session; no raw snippets persist server-side.

**API:** `POST /api/v1/explanations/code`; `POST /api/v1/explanations/findings`.

**Acceptance:** teaching call is user-triggered, uses Token Factory, shows actual source refs only, identifies assumptions, output cannot mutate report state or gate, invalid citation fails safely, disclosure applies.

**Tests:** prompt-injection source fixtures, made-up reference rejection, depth schema tests, source-range bounds, explanation/verification independence, provider failure/retry.

**Git checkpoint:** `feat: teach code and verification findings`.

## Phase 7 — Abuse protection, privacy and accessibility hardening

**Objective:** Make public API safe enough for hackathon judging.

**Tasks:** Upstash shared rate limits; body-size limits; same-origin Host/Origin checks; request IDs; safe errors; non-sensitive telemetry; no source body logging; CSP/security headers where applicable; privacy page; keyboard/screen reader pass; responsive pass; reduced motion; loading/error/empty states; cost guardrails.

**Acceptance:** rate limiting blocks repeat requests; API fails closed if rate limiting protection is unavailable in production; no source code/secrets appear in logs; no `NEXT_PUBLIC` secrets; app still loads sample if provider fails; archive security suite passes.

**Tests:** API abuse tests, security suite, axe/accessibility smoke tests, deployed environment config checks.

**Git checkpoint:** `security: harden public Orivoxx demo`.

## Phase 8 — End-to-end release verification and deployment

**Objective:** Deploy the complete working app and prove the hackathon-required runtime path.

**Tasks:** Deploy to Vercel; configure live Token Factory and Upstash secrets; execute actual deployed sample verification and explanation; fix issues; add README, MIT LICENSE, screenshots, architecture summary, contribution/setup steps, model/provider attribution; add `.env.example`; ensure public repository is open-source and demo accessible without login.

**Acceptance:** live URL works on desktop/mobile; one real Token Factory/Nemotron request visible in demo; sample produces grounded findings; source upload/analyze/explain/export journey works; all CI checks pass; public repository and license accessible.

**Tests:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, Playwright against deployed URL, manual real-provider test.

**Git checkpoint:** `release: deploy Orivoxx hackathon MVP`.

## Phase 9 — Submission pack and final audit

**Objective:** Submit before the deadline with all evidence complete.

**Tasks:** Record a public YouTube video less than three minutes; prepare Devpost title/description/track, demo URL, repo URL, video URL; fill provider/model explanation and required feedback; if deemed pre-existing, clearly document substantial changes made during submission period; recheck official page and deadline.

**Suggested video beats (2:35 max):** 0:00 problem; 0:15 load TaskBoard sample; 0:30 run verification showing real Nemotron/Token Factory step; 1:05 inspect failed requirement/evidence; 1:30 ask Orivoxx to teach authorization concept; 2:00 contrast compliant snapshot or JSON export; 2:20 architecture/model/infrastructure attribution; finish by 2:35.

**Acceptance:** Devpost required fields complete; public YouTube link plays without login; video under three minutes; demo/API still live; repository open-source license visible; submission confirmed before 6:00 p.m. WAT on Friday, 30 October 2026.

**Git checkpoint:** `docs: finalize Nebius hackathon submission package`.

## Phase boundaries

- Do not begin the next phase automatically.
- Each phase must conclude with actual commands/results, inspected diff, known limitations, and a commit only if its acceptance criteria pass.
- If a requirement cannot be met due to platform/model/API incompatibility, STOP and report the evidence. Do not silently swap providers or models.
- `watch`, live Git, local CLI, test execution, direct coding-agent adapters, accounts, history, and quizzes are not permitted unless the human explicitly revises scope.
