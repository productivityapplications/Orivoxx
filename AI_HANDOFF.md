# AI_HANDOFF.md — ORIVOXX

**Updated:** 20 October 2026  
**Project state:** Pre-implementation; hackathon blueprint and map-first dark frontend design revised on 20 October 2026  
**Current task:** Phase 0 only

## Product

Orivoxx verifies whether AI-built software follows its project specification and teaches the developer to understand the code and findings. Hackathon tagline: **Verify what AI builds. Understand why it matters.**

## Hackathon constraints

- Track: **Best Apps and Agents**.
- Required runtime use: Nebius Token Factory or Nebius AI Cloud. The designed app makes a real Token Factory runtime API call.
- NVIDIA model: `nvidia/Nemotron-3.5-Super-VL` through Token Factory.
- Submission deadline: Friday, 30 October 2026 at 6:00 p.m. Nigeria time. Recheck official page immediately before submission.
- Needs working demo URL, public repo with visible open-source license, README, and public YouTube video under three minutes. Need explain model/provider use and provide requested tool feedback.
- Official rules: https://nebiusglobalaihackathon.devpost.com/rules

## Fixed architecture

Hosted-first Next.js 16.x App Router + TypeScript + Tailwind on Vercel; dark-only Linear-inspired UI; map-first `/workspace` using `@xyflow/react` + `@dagrejs/dagre`; static JS/TS import graph parsing in shared pure TypeScript core; Zod; safe in-memory ZIP parsing; deterministic checks; Nemotron semantic assessment/teaching via the Token Factory OpenAI-compatible API; Upstash Redis REST shared rate limits; Vitest/Playwright. No app DB and no source persistence. The user can try the bundled synthetic TaskBoard sample or upload a bounded ZIP containing `PROJECT_SPEC.md`.

The hosted app MUST NOT execute uploaded project files, shell commands, package install scripts, builds, or tests. It processes source in memory, filters/redacts secrets, and does not log source. Source goes to the AI provider only after explicit consent. State that provider terms govern provider processing; do not promise zero provider retention without confirmation.

## Must-preserve invariants

1. Deterministic FAIL cannot be overridden by model PASS.
2. Missing or invalid evidence cannot become PASS.
3. Unknown requirement IDs/evidence references from model output are rejected.
4. A real Token Factory call is required; do not fake a successful model call.
5. Provider outage gives honest PARTIAL/UNVERIFIED output.
6. AI teaching is user-triggered and never changes verification findings or gate.
7. Graph relationships come from parsed source evidence; the model never invents graph edges.
8. Red FAIL/DRIFT nodes require a validated finding/evidence path mapped to that exact file. Unmapped findings remain visible in the findings list.
9. The frontend is dark-only on all pages and states; `/workspace` is map-first with Details/Insights/Code inspector and a findings-list fallback.
10. No uploaded code execution, no persistent upload storage, no app DB, no auth system, no live watch, no local CLI, no agent adapters in this MVP.
11. Do not start another phase after completing the assigned phase.

## Current source-of-truth files

- `PROJECT_SPEC.md` — product requirements, user flows, acceptance criteria.
- `ARCHITECTURE.md` — fixed stack, API, AI, privacy, security, deployment.
- `FRONTEND_DESIGN_SPEC.md` — dark-only visual system, UI layouts, map interactions, grounded node states, responsive/accessibility rules, and reference patterns.
- `IMPLEMENTATION_PLAN.md` — phases and checkpoints.
- `AGENTS.md` — executor restrictions.
- `ORIVOXX_COMPLETE_BLUEPRINT.md` — consolidated design and 30-section audit.
- `PROPER_VIBE_CODING_WORKFLOW.md` — user's governing implementation methodology.

## Exact next task: Phase 0

Create the pnpm workspace and Next.js/TypeScript skeleton, testing/linting, shared core package, environment validation, `/api/v1/health`, and a minimal server-only Token Factory smoke-test adapter. Do not implement ZIP intake, spec parser, verification engine, upload UI, teaching, user flows, or report pages yet.

The assigned Phase 0 must prove that `nvidia/Nemotron-3.5-Super-VL` can actually be called with configured Token Factory credentials. If the endpoint/model/response format is incompatible, document the exact evidence and STOP; do not silently choose another provider or model.

## Required Phase 0 verification

- clean dependency install;
- lint and typecheck;
- unit test runner starts;
- workspace build succeeds;
- `/api/v1/health` exposes safe status only;
- server-side smoke test succeeds with a real provider request (do not put API key in logs or client bundle);
- verify no `.env` or credentials in diff;
- commit only if acceptance criteria pass: `chore: bootstrap orivoxx hackathon app`.

## End-of-task report

List files changed; exact commands run; actual outcomes; result of real Token Factory smoke test; known issues; acceptance pass/fail; commit hash if committed. Then STOP.
