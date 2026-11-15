> **Positioning update (15 November 2026):** Orivoxx is being repositioned as a benchmarking platform for AI software-engineering agents. This document describes the verifier-era architecture; its technical contracts for the deterministic engine remain valid and are reused as the benchmark scoring rubric. The target benchmark architecture — task registry, harness, sandbox runner, leaderboard — is in `docs/ARCHITECTURE.md`. This document does not describe that layer.

# ORIVOXX — ARCHITECTURE

- **Version:** Hackathon MVP v2.1
- **Architecture status:** Verifier-era architecture; scoring-engine contracts remain current
- **Primary deployment:** Vercel-hosted Next.js application
- **Inference provider:** Nebius Token Factory
- **Selected model:** `nvidia/Nemotron-3.5-Super-VL`

## 1. System goals and constraints

Build a coherent public app that judges can use immediately, with a bundled safe sample and bounded ZIP upload. It must make a genuine runtime call to Nebius Token Factory using an NVIDIA open-weight/open-source model. It must never execute untrusted source code. The model assists semantic review and education; deterministic logic owns rule checks and verdict precedence.

The MVP is intentionally hosted-first because the hackathon requires a working demo URL. Direct live repository watching/local CLI and agent adapters are future work, not quietly implied by the hosted demo.

## 2. High-level architecture

```text
Browser
  ├── landing / sample chooser
  ├── ZIP picker + consent
  ├── map-first project workspace (dependency graph)
  ├── finding list + read-only source inspector
  └── Details / Insights / Code teaching panel
          │ HTTPS same-origin
          ▼
Next.js server routes (Vercel Node.js runtime)
  ├── request and ZIP validation
  ├── spec parser + repository inventory
  ├── deterministic rule engine
  ├── bounded context builder + redaction
  ├── Nebius Token Factory adapter
  │       └── nvidia/Nemotron-3.5-Super-VL
  ├── Zod output validation
  ├── deterministic verdict aggregator
  └── response/report serializer
          │
          ├── Upstash Redis: shared rate-limit counters only
          └── No application database; no persistent source storage
```

## 3. Fixed technology stack

- **Runtime:** Node.js 24 LTS for development and Vercel-compatible server runtime.
- **Package manager:** pnpm workspaces.
- **Language:** TypeScript strict mode.
- **Web:** Next.js 16.x App Router, React, Tailwind CSS. All routes use the dark-only visual system in `FRONTEND_DESIGN_SPEC.md`.
- **Interactive graph:** `@xyflow/react` for pan/zoom/node interaction, `@dagrejs/dagre` for deterministic hierarchical layout.
- **Static source graph:** existing `typescript` parser API for non-executing JavaScript/TypeScript import extraction; first release resolves local relative imports only.
- **Validation/contracts:** Zod schemas shared between core and API, including a `ProjectGraph` contract.
- **ZIP parsing:** `fflate` or equivalent pure-JS parser selected during Phase 0; must support entry metadata and bounded decompression. Prefer `fflate` unless a Phase 0 test shows a blocker.
- **AI client:** official `openai` Node SDK against Nebius Token Factory's OpenAI-compatible endpoint; no OpenAI-hosted model calls.
- **Inference:** `https://api.tokenfactory.nebius.com/v1/`, model `nvidia/Nemotron-3.5-Super-VL`.
- **Rate limiting:** Upstash Redis REST + `@upstash/ratelimit` for shared serverless rate limits.
- **Testing:** Vitest, React Testing Library, Playwright.
- **Lint/format:** ESLint + Prettier (or the Next.js-supported equivalent, selected once at bootstrap and documented).
- **Hosting:** Vercel for the hosted UI/API. The API's real Token Factory call satisfies the hackathon's platform requirement; no claim that the web host is Nebius AI Cloud.
- **Source control:** public GitHub repository; MIT license.

### Why this stack

One Next.js application keeps the user flow and API deployable together, avoids running a separate backend, and gives judges one URL. TypeScript/Zod enforce request/response shape. A supported OpenAI-compatible API avoids custom HTTP protocol code while calls still run through Nebius. Upstash provides shared rather than per-instance rate-limit state across serverless invocations. SQLite/Drizzle and cloud data persistence are omitted because the MVP does not save projects or source; adding a database would increase complexity without delivering core demo value.

## 4. Model and provider contract

### Provider

Nebius Token Factory, OpenAI-compatible endpoint:
`https://api.tokenfactory.nebius.com/v1/`

### Model

`nvidia/Nemotron-3.5-Super-VL`. Nebius published this exact model identifier and API example on 16 October 2026; its product note describes it as suitable for targeted code validation and evidence-led agent workflows. It is the one selected MVP model to make the hackathon's NVIDIA-model use explicit.

### Runtime use

- Verification call: batch up to 8 semantic requirements and a bounded, pre-selected code context.
- Teaching call: one user-triggered explanation for a selected code range or finding.
- Do not call the model once per file or every requirement by default.
- Output tokens capped at 2,000 for verification and 1,500 for explanation; keep input under configured context budget (target 20,000 tokens, hard maximum set by app configuration).
- Request timeout 45 seconds and one retry only for a validation/schema issue; provider/429/timeout retries use limited backoff where safe. Never retry repeatedly.
- All API secrets stay in server runtime environment variables.

### Structured output policy

Request JSON mode/JSON-schema output if supported by the currently configured Token Factory endpoint/model, but do not assume a feature without a smoke test. Regardless of provider mode, parse output and validate with Zod. If invalid: perform one repair retry with schema errors only and bounded output; if still invalid, mark semantic results unverified/partial. Validate every requirement ID and evidence reference against the current request. A model cannot create arbitrary source paths or evidence refs.

## 5. Component boundaries

### UI layer

Routes: `/`, `/workspace`, `/privacy`. The findings list and finding details are modes/panels inside `/workspace`, not separate mandatory navigation routes. Use client-side workspace state for the current archive, source inventory, project graph, verification report, selection and explanations. No auth or database. Refresh clears user upload/report state; explain this visibly. Sample fixture can be loaded again at any time.

### Project graph builder

`packages/core/src/graph` parses eligible JS/TS-family text with the TypeScript compiler parser APIs. It extracts relative static import/export-from references, literal `require`, and literal dynamic imports. It resolves targets only inside the normalized in-memory file inventory. It never evaluates/transpiles/runs source. Unsupported path aliases and unresolved imports become coverage warnings; they must not be treated as confirmed missing modules without a deterministic check. Direct imported packages may be shown only if they match an actual direct dependency in the parsed `package.json`.

Graph node status is decorated from the validated verification report by exact source path. Graph generation does not decide conformance. No validated path = no status-based red coloring. `FAIL` > `DRIFT` > `UNVERIFIED` > `IN_PROGRESS` > `PASS` > `NOT ASSESSED`; unlocalized findings remain in the findings list. The graph payload contains paths/labels/kinds and observed edge metadata, never source contents. Deterministic layout plus a 120-node initial view cap protects readability; every hidden node and finding remains reachable through search/list fallback.

### Shared domain core (`packages/core`)

Pure functions/types for requirement parsing, file inventory, declarative deterministic checks, source reference registry, severity/gate logic, report serialization, and regression/unit fixtures. Core contains no Next.js imports, no network calls, no filesystem writes, and no model SDK client.

### Upload intake

The UI may read ZIP metadata for friendly error messages, but server validation is authoritative. Server receives bounded ZIP bytes or validated file payload. It analyzes in memory only. Never extract to a persistent directory; never use shell tools to unpack the archive.

### Safe archive policy

- Max compressed archive: 3 MiB.
- Max total uncompressed entries/eligible text: 10 MiB.
- Max 300 archive entries; max eligible file 300 KiB; max eligible text aggregate 2 MiB.
- Reject path traversal (`..`), absolute paths, drive prefixes, NULs, duplicate normalized paths, symlink entries, invalid archive metadata, and expansion-limit violations.
- Ignore `.git/`, `node_modules/`, `.next/`, `dist/`, `build/`, `coverage/`, `.orivoxx/`, vendor/generated/minified assets, binaries, lockfile bulk where unnecessary, `.env*`, private-key/certificate files, credential/token files, and files from a denylist.
- Do not include secrets in context. Apply pattern redaction as defence in depth and surface excluded-file warnings.
- No shell command, build, test, or code execution is permitted on uploaded sources.

### Specification parser

Accept only documented Markdown requirement headings/metadata and a safe subset of declarative checks. Do not interpret YAML object tags, HTML, embedded scripts, shell snippets, or arbitrary commands. Duplicate requirement IDs are fatal parse errors. Free text not attached to parseable requirement blocks is retained only as contextual prose and is not treated as an authoritative check.

### Deterministic engine

Support: `file_exists`, `file_absent`, `text_contains`, `text_not_contains`, `dependency_present`, `dependency_absent`, and `source_reference_exists`. Use relative normalized paths only. Checks return immutable evidence records. No user-defined command execution.

### Context builder

Select only source snippets needed for requirements/findings. Prioritize spec excerpt, related file paths, bounded line ranges, and stable server-generated reference IDs (`SRC-001`, etc.). Include file fingerprints and line numbers. Exclude secrets/binary/build files, obey budgets, and label the context as untrusted data because repository source may contain prompt injection.

### Semantic verifier

Sends explicit system/developer policy + structured request data to Nemotron. Treat source/spec content as untrusted input. The model cannot use tools, access network, or run commands. Schema fields: request ID, assessments per known requirement, status (`PASS`, `FAIL`, `INCONCLUSIVE`), short rationale, confidence (`LOW`, `MEDIUM`, `HIGH`), evidence reference IDs. Only valid references count as evidence.

### Verdict aggregator

Deterministic rules are the source of truth for machine-checkable requirements. Deterministic FAIL cannot be reversed. A semantic PASS requires at least one valid reference and no conflicting deterministic failure. A semantic FAIL with valid evidence becomes FAIL unless it indicates an explicit architecture/constraint conflict, which becomes DRIFT. Missing, invalid, contradictory, or unavailable evidence becomes UNVERIFIED. Overall run is PARTIAL when the model provider fails but deterministic evidence exists.

### Teaching service

Separate prompt, Zod output schema, route, rate-limit bucket, and UI components. It receives a bounded current code range or finding evidence and user-selected depth. It may explain concepts but may not change code, invent source references, update findings, or influence the gate. Output includes observed behavior, concept explanation, relevance, assumptions, caveats, and verified source refs.

## 6. State and persistence

No application database in hackathon MVP. Source, findings, and explanations are not persisted by Orivoxx servers; analysis requests process the payload in memory and return a report. The browser keeps current session state only. Users may download JSON report summaries. Do not place request bodies, ZIP bytes, source code, API keys, or explanations in logs. Upstash persists only rate-limit counters, not source data.

No authenticated user or cross-session ownership model exists. This limitation must be stated in UI and README. Browser refresh clears the current upload/report. Do not claim to provide project history or regression detection across sessions. Compare two sample fixture snapshots only if implemented as a clearly labeled demo-only control.

## 7. API design

All routes use same-origin requests, bounded body size, Zod validation, consistent errors, and server-only secrets. API version prefix `/api/v1`.

### `GET /api/v1/health`
No auth. Returns `{ status: "ok", providerConfigured: boolean, modelId: string, appVersion: string }`. Must not reveal secret values or raw exception data.

### `GET /api/v1/demo-project`
No auth. Returns the safe static sample descriptor or source fixture if the implementation bundles it. No external network. Cacheable as immutable assets.

### `POST /api/v1/verify`
Purpose: verify bundled sample or a validated project manifest.
Auth: no login; rate-limited.
Request: `{ projectName, specText, files: [{ path, content }], sourceSharingAcknowledged: boolean, sourceKind: "sample"|"upload" }` where aggregate size limits apply. ZIP intake may occur at `/api/v1/projects/analyze` and normalize to the same internal input.
Validation: explicit disclosure acknowledgment; file/path/count/byte limits; parse spec; filter secret paths; never trust client-side checks.
Success `200`: `{ runId, projectName, runState, gate, summary, requirements[], findings[], evidence[], warnings[], graph: { nodes[], edges[], coverageWarnings[] }, model: { provider: "nebius-token-factory", modelId, called, latencyMs? }, snapshotFingerprint }`. `graph` contains paths/labels/kinds and observed static edge metadata only, never source contents. Node status is derived by the frontend from validated report/evidence paths; the graph builder does not decide compliance.
Errors: `400` invalid input/archive, `413` limits exceeded, `422` invalid spec, `429` rate limit, `502` provider failed without partial deterministic result, `200 PARTIAL` when deterministic output is valid but semantic checks are unavailable.
Side effects: transient provider call; no persistent source/report storage.

### `POST /api/v1/explanations/code`
Request: `{ projectFingerprint, filePath, startLine, endLine, sourceText, depth }` plus consent marker. Limit 120 lines, 20 KiB source text. Server validates path syntax and bounds but cannot independently prove a client-supplied context belonged to prior report; therefore the web UI must create this request directly from the current in-memory verified snapshot, and the response returns the fingerprint it describes. Do not claim cryptographic integrity across browser clients.
Success: structured explanation + validated source refs + model metadata.
Errors: `400` invalid range/payload; `403` missing consent; `413` oversized source; `429`; `502` provider unavailable; invalid model output after one retry is `502 EXPLANATION_UNAVAILABLE`.

### `POST /api/v1/explanations/findings`
Request: `{ projectFingerprint, finding, requirement, sourceRefs, depth, sourceSharingAcknowledged }`. Server schema-checks sizes and reference format. The current report drives the frontend payload. Returns the same explanation schema.

### `POST /api/v1/reports/export`
Not required: JSON export is client-side from validated report state. Do not add this endpoint unless architecture changes are approved.

### Error format

`{ error: { code: string, message: string, retryable: boolean, requestId: string } }`. User-facing messages must not include stack traces, provider headers, or secret values. Internal logs use request ID only plus timing/status/estimated token counts where available; do not log source payloads.

## 8. AI call sequence

```text
POST verify
  -> validate request/consent and size limits
  -> normalize paths and filter files
  -> parse spec
  -> run deterministic checks
  -> map requirements to eligible files/context
  -> if semantic requirements remain and provider configured:
       call Nebius Token Factory / Nemotron
       validate structured output + reference IDs
  -> aggregate statuses with fixed precedence
  -> return result + provider metadata + warnings

POST explain
  -> validate user-triggered action and consent
  -> clamp range, redact, and bound source/context
  -> call Nemotron with teach-only instruction
  -> validate output + source refs
  -> return explanation only (no verifier writes or verdict updates)
```

## 9. Security architecture

- API key is server-only; never use `NEXT_PUBLIC_` for secrets.
- ZIP and JSON body limits enforced on server, not only browser.
- ZIP path traversal, symlink entries, duplicate paths and expansion bombs rejected.
- No arbitrary network fetches (SSRF avoided by design); no command execution or package install.
- All files treated as untrusted; prompt-injection-like text inside source/spec is quoted data, not instruction.
- Secret file denylist + regex redaction, with warning of limits; advise users not to upload secrets.
- Same-origin API only; explicit Host/Origin checks and no wildcard CORS. SameSite cookies not needed for authless POST but still apply origin checks.
- Shared rate limit: suggested verification limit 5 calls/15 minutes/IP and explanation limit 10 calls/15 minutes/IP; tune lower if provider credits require. Fail closed if rate limiting cannot protect the public AI endpoints in production.
- Output sanitization: React escaping, never render model HTML; code uses text/code components.
- Maximum input/context/output tokens and 45-second timeout. Limit concurrent model calls per request; no loops over individual files.
- Do not log request bodies; configure hosting request-body logging off where possible.
- Privacy notice explains third-party processing and user consent; do not assert provider zero-retention unless verified from configured account/terms.
- Public demo has no auth, so no source is persisted and no user-specific history is offered. Rate limit is mandatory before the live endpoint is made public.

## 10. Frontend design system

The app is dark-only and map-first for the hackathon MVP. Exact tokens, typography, layout dimensions, status colors, page state designs, interaction requirements, inspiration references and acceptance criteria are in `FRONTEND_DESIGN_SPEC.md`, which is the visual/interaction source of truth. Do not use an off-white/light theme in any route or state.

References: Linear for restrained dark UI and information hierarchy; GitHub code review for evidence/path navigation; Sentry for finding details and progressive disclosure; the user-provided repository-map screenshot for map/canvas + side-inspector composition. Use these as pattern references, not as UI assets to copy.

Desktop workspace: compact left project/requirements rail, central dependency graph, right Details/Insights/Code inspector, top-level gate and counts. Landing `/` has a clearly labeled illustrative graph; after the user starts a run, `/workspace` shows the real project graph. Mobile has map/list switching and inspector drawer rather than a squeezed three-column layout.

## 11. Required screens

1. `/` — dark product promise, `Try TaskBoard demo`, `Upload project ZIP`, explicitly illustrative mini-map, track/model/privacy disclosure.
2. `/workspace` — primary project map; overall gate and counts; graph filters/legend; project/requirement rail; finding list fallback; Details/Insights/Code inspector; upload/reset, consent notice, rerun/export actions.
3. Upload/consent overlay — selected archive metadata, size/exclusion notice, unchecked source-sharing consent, inline validation.
4. Source Code inspector — read-only, line-numbered code, validated range, highlighted evidence, Explain action.
5. Finding Details inspector — requirement, severity/status, evidence, origin, confidence where relevant, linked code path.
6. Insights/Teaching inspector — user-triggered beginner/intermediate/advanced explanation, assumptions/caveats/source refs; cannot alter verdicts.
7. `/privacy` — source-processing explanation, exclusions, limits, provider disclosure, no-execution/no-persistence promise.
8. Shared loading, empty, partial, provider-down, no-supported-graph, large-graph, error, confirmation and reset states.

## 12. Environment variables

Required for public production deployment:
- `NEBIUS_API_KEY` — secret Token Factory API key; server-only.
- `NEBIUS_BASE_URL` — server-only; default `https://api.tokenfactory.nebius.com/v1/`.
- `NEBIUS_MODEL_ID` — server-only; fixed production default `nvidia/Nemotron-3.5-Super-VL`; allow override only for testing/operations, document any change.
- `UPSTASH_REDIS_REST_URL` — server-only shared rate-limit database URL.
- `UPSTASH_REDIS_REST_TOKEN` — server-only Redis REST token.
- `APP_BASE_URL` — deployment origin used for origin checks and links; not secret.
- `NODE_ENV` — platform runtime setting.
- `ORIVOXX_MAX_ARCHIVE_BYTES` — optional server-only numeric override, default 3145728 (must not be set above hardcoded maximum).
- `ORIVOXX_MAX_SOURCE_BYTES` — optional server-only numeric override, default 2097152 (must not be set above hardcoded maximum).

Never expose the API key or Upstash token to browser code. `.env.example` contains empty placeholders only and is committed; `.env.local` is ignored.

## 13. Deployment and operations

- Primary deployment: Vercel. Build, lint, unit tests and E2E smoke checks must pass before promotion.
- Token Factory must be exercised from the deployed environment using a real request (not only mocked tests) before recording the demo.
- Deployment preview and production should use separate secrets if possible.
- Provide graceful degraded mode for provider failures; sample page can load even if provider is unavailable, but report must clearly state no semantic model verification occurred.
- Maintain a daily manual credit/key health check while building; no background work assumed.
- Add a request correlation ID; report model ID, request success/failure and latency, not source text or prompt contents.
- No background queues, webhooks, payments, notifications, search, object storage, or application database in MVP.

## 14. Alternatives rejected

- **OpenAI Responses API / OpenAI-hosted model:** rejected for MVP because the competition specifically expects a runtime on Nebius Token Factory or Nebius AI Cloud and NVIDIA open-source model usage.
- **Hosted source storage/database:** rejected because judges need an easy demo, not persistent accounts; avoiding persistence lowers privacy/security complexity.
- **Executing uploaded tests/builds:** rejected due untrusted code execution risk and schedule. Future local runner or isolated sandbox only.
- **Direct integrations for every coding agent:** rejected because adapters consume time and are not needed for core demo.
- **Vector database/RAG service:** rejected; source is small and bounded, direct retrieval by requirement/path is sufficient.
- **Queue/worker system:** rejected; requests fit within bounded synchronous serverless calls; timeout and partial states are explicit.

## 15. Future architecture decisions

A separate approved architecture revision is required before adding local CLI/watch, test execution, persistent project history, accounts, GitHub OAuth, IDE/MCP adapters, or team features. Do not implement those implicitly during hackathon MVP.
