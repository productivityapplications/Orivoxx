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
