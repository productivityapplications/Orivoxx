# ORIVOXX — PROJECT SPECIFICATION

**Version:** Hackathon MVP v2.1  
**Last reviewed:** 20 October 2026  
**Status:** Product decisions frozen for MVP; implementation not started  
**Primary hackathon track:** Best Apps and Agents  
**Submission deadline:** Friday, 30 October 2026, 6:00 p.m. WAT (Nigeria)

## 1. Product overview

### Product definition

**Orivoxx** is a developer copilot that verifies whether AI-built software follows its project specification and teaches the developer to understand the code and verification findings.

**Product promise:** *Verify what AI builds. Understand why it matters.*

### Problem

AI coding assistants can rapidly produce plausible code while missing requirements, weakening security assumptions, deviating from an intended architecture, or hiding uncertainty behind confident explanations. Developers need an independent check against their own specification and a way to understand the implementation rather than blindly trust it.

### Target users

Primary: solo developers, AI-assisted builders, technical founders, and early-career developers who use coding assistants and want a better way to verify and understand the code they produce. Secondary: small engineering teams evaluating AI-generated changes.

### Alternatives/workarounds

Manual specification-to-diff review; unit tests and CI; generic static analysis; asking the same coding agent to review its own work; general AI code review; reading unfamiliar code unaided. Orivoxx joins requirement-level verification and contextual teaching in one evidence-centred flow.

### Differentiator

Orivoxx ties each finding to a requirement and concrete repository evidence, uses deterministic checks whenever possible, uses NVIDIA Nemotron on Nebius Token Factory for semantic judgments and explanations, and teaches from the code currently being inspected. Explanation text never changes a verification verdict.

### Primary use case

A developer exports a repository as a ZIP after an AI coding session, selects it in Orivoxx, confirms source-sharing disclosure, and runs a verification. Orivoxx parses `PROJECT_SPEC.md`, inventories eligible files, runs deterministic checks, asks Nemotron to assess requirements that need semantic judgment, combines the results under fixed precedence rules, and presents a report with file/line evidence. The developer then asks Orivoxx to explain a finding or selected code at their preferred depth.

### Secondary use cases

- Explore the included sample project to understand the product before uploading anything.
- Compare a deliberately broken sample with its compliant counterpart.
- Explain a function, component, API route, database operation, or verification finding.
- Export a machine-readable JSON report for manual sharing.

### Explicit non-goals

The hackathon MVP does not generate or edit code; execute uploaded code or project scripts; autonomously run tests; watch a live repository; integrate into private coding-agent protocols; connect to GitHub/GitLab; host accounts or teams; guarantee correctness/security; act as a generic course platform; offer quizzes/curricula/progress tracking; accept payments; or persist uploaded source code on Orivoxx servers. It does not infer undocumented requirements as authoritative truth.

## 2. Hackathon fit and constraints

### Selected track: Best Apps and Agents

This is a developer copilot that a person uses to inspect and understand software. The official description invites practical apps/copilots powered by Nemotron models on Nebius through Token Factory. The Coding and Agentic Engineering track focuses on agents that write, run, and test code in Token Factory; Orivoxx is not an autonomous code-writing agent in this MVP, so Best Apps and Agents is the better fit.

### Compliance requirements

1. The running application must make a genuine runtime call to Nebius Token Factory or run on Nebius AI Cloud. The MVP will make server-side Token Factory inference calls.
2. The application must use at least one NVIDIA open-source model. The MVP's selected model is `nvidia/Nemotron-3.5-Super-VL`, served by Token Factory.
3. A working demo URL must be submitted.
4. A public source repository on GitHub/GitLab/Bitbucket must include a visible open-source license and a README with setup/run instructions.
5. The README/submission must explain the Nemotron model and where Token Factory is used.
6. A public YouTube demo under three minutes must show the app working and its use of Token Factory/Nemotron.
7. Submit requested feedback on Nebius/NVIDIA tools used.
8. The official rules require a written explanation of significant updates only if the project existed before the Submission Period began on 26 August 2026. Confirm the actual project/code history before answering that field; do not claim the application existed before that date unless true. If applicable, describe concrete changes made during the Submission Period.

Official rules: https://nebiusglobalaihackathon.devpost.com/rules  
Hackathon page: https://nebiusglobalaihackathon.devpost.com/  
Model overview/API example: https://nebius.com/blog/posts/three-new-open-weight-models-from-us-companies-give-builders-more-choice

The deadline shown in the official rules is 30 October 2026 at 10:00 a.m. Pacific Daylight Time, which is 6:00 p.m. West Africa Time (Nigeria). Recheck the official page before submission in case the organizer updates details.

## 3. MVP scope

### MUST HAVE

1. Hosted, responsive, dark-only web application with a clear first-run experience.
2. A bundled synthetic demo project that works without uploading personal code.
3. An interactive project dependency map as the primary workspace view once verification begins; nodes use only grounded evidence to show deviations.
3. ZIP upload for a small source project containing `PROJECT_SPEC.md` and source files.
4. Strict ZIP/file limits, path validation, denylist filtering, secret redaction, and no code execution.
5. A deterministic requirement parser for a documented Markdown requirement format.
6. A static file inventory and deterministic checks: required/forbidden path, required/forbidden text marker, dependency presence/absence, and spec/requirement completeness.
7. A real server-side runtime call to Nebius Token Factory using `nvidia/Nemotron-3.5-Super-VL` for bounded semantic review and user-triggered teaching.
8. Structured model output validated with Zod. Invalid outputs may be retried once, then fail visibly.
9. A verdict engine where deterministic FAIL always wins; model opinion without valid source evidence cannot cause PASS.
10. Requirement results: `PASS`, `FAIL`, `DRIFT`, `UNVERIFIED`. Run state also includes `COMPLETE`, `PARTIAL`, `FAILED`, or `RATE_LIMITED`.
11. Finding cards containing requirement ID, severity, reason, validated file/line references, and evidence summary.
12. Contextual explanations for selected code and findings with Beginner, Intermediate, and Advanced levels.
13. An explicit disclosure/consent step before any user-uploaded source context is sent to Token Factory.
14. Read-only source viewer for eligible files; source line ranges are bounded and path-validated.
15. Explain output that distinguishes what code visibly does, conceptual explanation, inference/assumptions, and caveats.
16. A clear statement that uploaded code is not executed and is not persisted by Orivoxx after request processing; the third-party provider's applicable handling terms still apply.
17. Downloadable JSON verification report; current report/explanation state may be kept in browser memory only.
18. Public demo deployment and submission assets.

### SHOULD HAVE — only if MUST HAVE is stable

- Side-by-side baseline/regressed sample comparison.
- Downloadable Markdown report.
- One-click reset to demo sample.
- A small amount of browser-side state retained while the current tab is open.

### NICE TO HAVE

- Compact evidence timeline.
- Keyboard-accessible file picker/source tree polish beyond baseline accessibility.
- An explanation usefulness button stored only in ephemeral browser state.

### FUTURE

- Local CLI that reads a live repository.
- Git diff/checkpoint/regression tracking across real coding sessions.
- Optional local watch mode.
- MCP/provider adapters for OpenCode, Cline, Codex, Claude Code, Cursor, etc.
- Test execution in a separately isolated sandbox or user-controlled local runner.
- Persistent project history; Git provider integrations; team workspaces; role-based access.
- IDE integration, policy packs, learning paths, quizzes, and progress tracking.

### OUT OF SCOPE

Any arbitrary shell execution, building/running user projects on the web server, database persistence of uploaded source, automatic fixes, code generation, accounts/authentication, payments, general web search, extra AI providers, agent-specific protocols, and direct live monitoring of local folders.

## 4. User roles and permissions

### Visitor / Developer

Can open the demo, choose a sample, upload a ZIP, acknowledge source processing, run analysis, inspect the report, browse eligible source files, request explanations, and download the report. No sign-in is required for this hackathon build.

### Orivoxx application

Can read the submitted bytes in memory for the duration of the request; parse the spec; run allowlisted static checks; select bounded code context; make server-side calls to Token Factory; validate and combine results; and return a report. It cannot execute uploaded code, access arbitrary URLs, or write to the uploaded project.

### Administrator/operator

No admin dashboard or user-management role exists in the MVP. Deployment secrets and global rate limits are managed through deployment configuration, not a product UI.

## 5. User flows

### Flow A — Try sample

1. Visitor opens `/`.
2. Frontend explains Verify + Teach and offers `Try sample project` or `Upload project ZIP`.
3. Visitor chooses the bundled `TaskBoard` sample; the app shows that it is synthetic and safe for demo.
4. Visitor confirms that sample code will be processed by Nemotron through Nebius Token Factory.
5. User clicks `Run verification`.
6. Frontend sends sample manifest + spec to `POST /api/v1/verify`.
7. API validates payload; core parser creates requirements; deterministic checks run; context builder selects bounded relevant code; Token Factory is called for semantic requirements; Zod validates output; verdict engine applies deterministic precedence.
8. Result returns with run status, requirement statuses, findings, evidence references, elapsed time, and model metadata (never the API key).
9. UI opens the map-first workspace: a real dependency graph, overall gate and counts, and red FAIL/DRIFT nodes only where validated evidence maps to a source path. The inspector exposes Details, Insights and Code; findings also remain available in list mode.
10. User may switch between the intentionally broken and compliant sample versions if the fixture-comparison enhancement is completed.

Failure paths: invalid fixture schema -> visible sample-load error; Token Factory timeout/429/5xx -> deterministic results remain visible, AI-dependent requirements become `UNVERIFIED`, run becomes `PARTIAL`; invalid model JSON -> one constrained retry then `PARTIAL`; rate limit -> `RATE_LIMITED` with retry guidance.

### Flow B — Upload a project ZIP

Preconditions: ZIP is within limits and contains a root-level `PROJECT_SPEC.md`; visitor accepts disclosure and explicitly authorizes analysis.

1. Visitor chooses a ZIP file. Browser displays file name and size; it does not automatically submit it.
2. User reads disclosure: eligible source context will be sent to Nebius Token Factory for AI analysis; Orivoxx does not persist uploaded files, but provider terms apply; secrets and confidential material must not be uploaded.
3. User checks acknowledgement and clicks `Analyze project`.
4. Browser posts ZIP bytes or validated archive entries to `POST /api/v1/projects/analyze` with an explicit consent marker.
5. API independently enforces byte/file/expanded-size limits, rejects unsafe paths/symlinks, filters binary/build/dependency/secret files, normalizes line endings, and builds a bounded manifest. Never trust browser-only validation.
6. API parses the project spec. Missing/malformed spec returns actionable errors without calling the model.
7. Deterministic checks run first. The model receives only the minimum relevant eligible source and requirement context needed for semantic assessment.
8. Validated report is returned to the browser; source is not written to disk or persisted. UI retains current report in memory only.
9. User can inspect files and request explanations. A second explanation request sends only the selected, bounded, redacted context and finding context after the same consent is active for that uploaded project.
10. User can download report JSON or close/reset the session.

Failure paths: reject oversized ZIP, invalid archive, zip bomb, traversal, duplicate normalized paths, symlinks, missing spec, unsupported encoding, no source files, model failure, and provider rate limit. No failed request may be represented as a successful verification.

### Flow C — Explain selected code

Preconditions: a report/session contains an eligible text file; source-sharing acknowledgement is active; selected range stays inside file and configured limits.

1. User opens Source Explorer.
2. UI shows eligible path, line numbers, and a bounded source window.
3. User selects up to 120 lines and clicks `Explain this code`.
4. UI offers Beginner (default), Intermediate, or Advanced.
5. API validates path/source reference, content size, depth, redaction, and input length.
6. Explanation service calls Nemotron with a teaching-only prompt and a strict output contract.
7. API validates output, discards any source-reference identifier not issued by the server, and returns a structured explanation.
8. UI renders `What it does`, `Why it matters`, `Concepts`, `Caveats / assumptions`, and `Source references`.
9. If the browser source snapshot changes, cached display is invalidated; for MVP, explanations are not durable across refresh and are tied to a content fingerprint.

Failure paths: selected range too large -> reject; unsafe path -> reject; API unavailable -> visible retry; fabricated citation -> reject/retry once; source-sharing disabled -> no call; explanation content never changes report verdicts.

### Flow D — Explain a verification finding

1. User selects a finding and clicks `Explain finding`.
2. API receives finding ID/reference, requirement text, bounded relevant source excerpt(s), and depth.
3. Service explains the defect, likely impact, relevant concept, and what to inspect next without providing/applying an automatic fix.
4. UI links explanations back to validated code lines. Explanation is clearly labeled educational and not a new verification result.

### Flow E — Download report

1. User clicks `Download JSON report`.
2. Browser exports the current validated report (requirement states, finding evidence, model/run metadata and warnings) without API secrets, raw uploaded archive, or full raw source.
3. A generated file name includes project slug and timestamp. Download failure is surfaced with copy-to-clipboard fallback if feasible.

## 6. Functional requirements

### FR-001 — Landing and sample project

Actor: visitor. Preconditions: app loaded. Inputs: sample selection. Processing: load repository-bundled synthetic TaskBoard fixture, not remote files. Output: sample workspace with spec and source inventory. Acceptance: sample works without account; sample contents are checked into public repository; no external project access is required.

### FR-002 — Safe ZIP intake

Actor: visitor. Preconditions: explicit source-sharing consent required before AI call. Inputs: ZIP archive. Processing: limits, path normalization, duplicate checks, file filter, spec presence, text decoding, byte budgets. Acceptance: archives over 3 MiB compressed, over 10 MiB expanded text/eligible content, over 300 files, any single source file over 300 KiB, traversal entries, symlink entries, or duplicate normalized paths are rejected or safely excluded with a visible warning; no archive commands are executed; no extraction to persistent disk occurs.

### FR-003 — Specification parsing

Support a documented Markdown structure in `PROJECT_SPEC.md` with requirement blocks using stable IDs, description, severity, verification mode, and optional declarative check. Missing IDs may be generated only in memory and flagged as inferred; duplicate IDs are a hard parse error. The parser must not execute Markdown, YAML tags, shell snippets, or embedded code.

Acceptance: valid fixture specs parse deterministically; malformed or duplicate IDs return errors with line references; unsupported free-form statements stay visible as unstructured context and never become a machine-authoritative requirement silently.

### FR-004 — Repository inventory and static rules

Eligible inventory contains relative path, file size, detected text encoding/language, line count, content fingerprint, and bounded line access. Required checks: `file_exists`, `file_absent`, `text_contains`, `text_not_contains`, `dependency_present`, `dependency_absent`, and `source_reference_exists`. No command execution. All checks emit status + evidence IDs.

### FR-005 — Semantic verification via Nebius

Use Token Factory runtime API and model ID `nvidia/Nemotron-3.5-Super-VL`. The model receives a bounded batch of semantic requirements plus source references generated by Orivoxx. It returns a structured assessment containing requirement ID, `PASS`/`FAIL`/`INCONCLUSIVE`, rationale, confidence band, and only supplied evidence reference IDs. Model output is untrusted and validated by Zod.

Acceptance: valid assessments map only to known requirement IDs; references not in the request are rejected; timeout/429/5xx/malformed output never become PASS; one schema-repair retry maximum; model unavailability produces partial findings and explicit warning.

### FR-006 — Verdict engine

Per requirement:
- `FAIL` if any applicable deterministic check fails.
- `DRIFT` if evidence shows the implementation conflicts with an explicit architecture/constraint or the spec itself marks the detected change as forbidden.
- `PASS` only when required deterministic checks pass and, if semantic verification is required, a valid semantic assessment is PASS with at least one validated evidence reference.
- `UNVERIFIED` when required evidence is missing, the model is unavailable, semantic result is inconclusive, or evidence refs are invalid.

Precedence: deterministic failure > grounded semantic failure/drift > semantic pass. AI cannot override deterministic failure. A requirement with no applicable check or usable source evidence is `UNVERIFIED`, not PASS. Overall run is `COMPLETE` only if all requested checks returned; `PARTIAL` if some checks fail operationally; `FAILED` for invalid request/analysis; `RATE_LIMITED` for throttle. Project gate is `BLOCKED` if any Critical/High requirement is FAIL/DRIFT/UNVERIFIED; `WARN` for Medium/Low unresolved requirements; otherwise `PASS`.

### FR-007 — Evidence and finding UX

Each finding includes stable finding ID, requirement ID, severity, status, short summary, reason, evidence reference IDs, path + start/end line where known, deterministic/semantic origin, and confidence label for model-supported conclusions. Source references must be generated by the server and validated against the exact uploaded snapshot. Never render raw HTML from code/model output.

### FR-008 — Contextual teaching

Support user-triggered explain-code and explain-finding. Depth: Beginner, Intermediate, Advanced. Output schema: `summary`, `what_it_does`, `why_it_matters`, `concepts[]`, `assumptions[]`, `caveats[]`, `source_refs[]`, `suggested_next_question` (optional). No automatic fixes or patches. Default language is English. Explanations are stored only in current browser memory, not on server. Source ref IDs must be in the input context.

### FR-009 — Provider transparency and costs

AI routes include server-side timeout, token/output budgets, concurrency limits and per-IP rate limits. UI shows “Verified with Nemotron on Nebius Token Factory” only when the real provider request succeeds; otherwise it shows the partial/unavailable state. Do not imply model-generated results were deterministic or guaranteed.

### FR-010 — Report export

Export schema-versioned JSON with project name, created timestamp, file inventory summary (not full source), spec requirement IDs, statuses, evidence summaries, warnings, model ID/provider call state, and overall gate. Never include API keys, full archive bytes, or raw secret candidates.

### FR-011 — UI states/accessibility

Every screen includes loading, empty, success, error and partial states as applicable. Keyboard navigation, labels, visible focus, adequate contrast, semantic headings, responsive layouts, reduced-motion support and a text/list alternative for the graph are required. Use status text/icons in addition to colors. Follow `FRONTEND_DESIGN_SPEC.md`.

### FR-012 — Operational safe failure

Provider outage, missing `NEBIUS_API_KEY`, rate limit, parsing errors, rejected archive, or invalid AI output must be visible and actionable. Deterministic results should still be returned when AI is unavailable. Never fabricate a completed analysis.

### FR-013 — Map-first project structure visualization

Actor: visitor/developer. Preconditions: an included sample or accepted ZIP has been inventoried and verification is running or has returned a report. The workspace displays an interactive static dependency graph derived from parsed source files. For the MVP, JavaScript/TypeScript-family local static imports are parsed without executing code; external package nodes are shown only when a bare import matches a direct dependency declared in `package.json`. The graph must not invent edges or claim runtime relationships.

Node status is derived only from validated report evidence mapped to the exact file path. `FAIL` and `DRIFT` use red-family states; `UNVERIFIED` uses amber; `IN_PROGRESS` uses violet; `PASS` uses teal; `NOT ASSESSED` is neutral. Labels/icons accompany all colors. A finding with no validated source path stays in the findings list/Unmapped findings section and must not color a guessed node. Node aggregation priority is `FAIL > DRIFT > UNVERIFIED > IN_PROGRESS > PASS > NOT ASSESSED`.

Users can pan/zoom, fit the map, search files, filter by status, select a node, inspect adjacent dependencies, and open finding details/source/teaching in the Details/Insights/Code inspector. A findings-list alternative must expose the same findings and statuses, including files outside the graph display cap. No-import/unsupported import graphs show a clear coverage note and list/tree fallback.

Acceptance: same sample snapshot produces deterministic graph nodes/edges; tests prove relative static import parsing and file resolution; unknown/unsupported imports never become invented edges; only evidence-backed paths receive red deviations; graph selection does not trigger an AI call; full finding list remains available under filters and map node caps.

### FR-014 — Dark-first interface and map-centered workspace

All routes and states use the dark-only design tokens in `FRONTEND_DESIGN_SPEC.md`; no light theme or theme toggle is included in the MVP. The design uses Linear as a restrained dark UI reference, GitHub for evidence navigation patterns, Sentry for finding detail/progressive disclosure, and the user's supplied repository map screenshot for graph composition. These references must be adapted, not copied.

After a project starts verification, `/workspace` uses the graph as the main canvas, a compact project/requirements rail on the left, a Details/Insights/Code inspector on the right, and a top status bar. The landing page `/` has a clearly labeled illustrative sample map, not a fake current result. Design/loading/empty/error/provider-partial/no-graph/large-graph/mobile states are specified in `FRONTEND_DESIGN_SPEC.md`.

Acceptance: UI visual checks pass for dark-only surfaces, responsive layouts and accessible contrast; node selection opens the inspector; map states remain truthful during pending/partial analysis; the UI does not use color as the only status cue.

## 7. Requirement syntax

A requirement can be represented in Markdown as:

```md
### REQ-AUTH-001 — Project access must be owner-scoped
- Severity: critical
- Verification: semantic
- Description: Every request that reads or mutates a project must verify that the authenticated requester owns the project or has an explicit role granting access.
- Checks:
  - type: file_exists
    path: src/app/api/projects/[id]/route.ts
```

Only the documented check types are parsed. The model may suggest additional concerns, but those are findings requiring human interpretation, not new authoritative requirements.

## 8. Sample project definition

Bundled fictional project: **TaskBoard**, a small task-management API and UI. It has a human-readable spec and two snapshots:
- `taskboard-regressed`: one known critical owner-scope authorization flaw and one lower-severity missing error-state requirement;
- `taskboard-compliant`: corrected fixture that should pass the built-in checks and give the model enough source to return a grounded assessment.

No real user data, API secrets, network calls, or executable setup are included. Judges can run the sample without uploading anything. Sample source and known expected findings are documented so regression tests are reproducible. The model is still called at runtime for semantic verification and teaching; the app must not fake or hardcode the model response as if it came from Token Factory.

## 9. Acceptance definition for hackathon release

A release is acceptable only when:
1. hosted demo loads on desktop and mobile;
2. `Try sample` runs real deterministic checks and a successful runtime Token Factory call using the selected NVIDIA model;
3. the sample returns expected critical failure evidence, and compliant sample returns expected result where the provider supports it;
4. unavailable provider state is visible and deterministic output remains valid;
5. user can upload an allowed ZIP containing the spec, grant explicit source-sharing consent, review results, explain one code range and one finding, and export JSON;
6. malicious/oversized/invalid archives are rejected safely;
7. uploaded code never executes and is not persisted by Orivoxx;
8. explanation cannot change verification results;
9. tests, build, lint, deployment smoke test, and accessibility checks pass;
10. public repository has MIT or Apache-2.0 license, README, screenshots, setup instructions, and explicit model/provider attribution;
11. a public YouTube demo is shorter than three minutes and shows the real app and real provider integration;
12. Devpost description, category, live demo URL, repository URL, video URL, tool feedback, and required pre-existing-project explanation are ready before the deadline.
