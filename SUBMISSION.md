# Submission draft — HackCulture AI Global Hackathon

Working copy for the Devpost form. Facts below are verifiable in the repository and the deployed app.

## Basics

| Field | Value |
|---|---|
| Project name | **Orivoxx** |
| Tagline | **Benchmark the agent, not just the model.** |
| Track | Build a Benchmarking Platform for AI Agents, Not Just Models |
| Live app | <https://orivoxx.vercel.app> |
| App home | <https://orivoxx.vercel.app/app> |
| Repository | <https://github.com/productivityapplications/Orivoxx> |
| Demo video | `demo/orivoxx-demo.mp4` (2:14.7) — final cut, 1920×1080, −16.2 LUFS, −1.6 dBTP, showing the new real tasks and the 0.0 → 100.0 replay proof |
| License | MIT |

## Short description

Orivoxx is a framework-independent benchmark for AI software-engineering agents with **brand-name adapters (Claude Code, Codex CLI, Aider), six metrics, real repository tasks, and deterministic counterfactual failure attribution**. It scores the produced repository statically, then names every failure by layer × mode and proves the attribution with a replay that crosses the pass threshold. No model is in the score path or the attribution path.

## The headline

A trace shows what happened, not why. Orivoxx runs brand-name agents on real repository issues and attributes failures. A failure maps to one of 20 cells — five layers (spec, model, harness, tool, environment) × four modes (decision, execution, recovery, detection) — and a tool fault can be proven with a counterfactual replay: baseline 0.0 → retry the intercepted `apply_patch` at step 2 → 100.0 PASS on the real test command.

## Brand agents and real tasks

| Agent | OpenRouter route | Status |
|---|---|---|
| Claude Code 2.1.329 | Anthropic-compatible endpoint through the proxy | Runs; passed `slugify-max-length` and the fresh community `is-decimal-800937e9` |
| OpenAI Codex CLI 0.171.0 | Responses wire API through the proxy | Runs; passed legacy tasks; failed `is-email-predicate` |
| Aider 0.86.2 | OpenAI-compatible proxy | Runs as the baseline |
| GitHub Copilot CLI | no OpenRouter base-url override; org policy denied | Excluded |
| Cursor | not reliably headless-routeable | Excluded |

Three harder real-repository tasks replace the trivial `is-*` one-liners as the public comparison set: `slugify-max-length` (MIT, two files), `is-email-predicate` (MIT, two files), and `itsdangerous-future-signature` (BSD-3-Clause, three files). Each pins a real base commit, installs dependencies through the allowlisted registry tunnel, and validates through six gates.

## What it does

1. **Versioned tasks.** TaskBoard and Linkstash pin a spec, starting repository, ruleset, scoring configuration, and pass threshold.
2. **Sandboxed runs.** A model-agnostic adapter runs in Docker: non-root, read-only rootfs, quotas, no platform secrets, one allowlisted model proxy.
3. **Six metrics.** Artifact score, steps, tool calls, tokens, cost, duration.
4. **Three chaos modes.** Injected tool error, latency, context pressure.
5. **Deterministic scoring.** Spec 60% / security 25% / maintainability 15%; caps at 59.9 / 49.9; no model in the loop.
6. **Attribution.** Seventeen deterministic rules over the trace; each cell has step-level evidence.
7. **Replay proof.** Memoized counterfactual: byte-identical prefix, one intervention, static rescore.
8. **Reliability profile.** Mean ± std, pass@k, layer distribution, chaos sensitivity, trend.
9. **Public product.** Landing, app home, catalogue, result, trace, replay, leaderboard, compare, docs.
10. **Self-serve baseline.** Anyone can create a real result without a model call.
11. **Community tasks.** Submit a repo issue; six mechanical gates validate it; private tasks are owner-only and promotion is curator-gated.

## Real recorded proof

```text
Result: res_c1ba8d7b… · python (chaos: failing_tools) · anthropic/claude-sonnet-4.5
Score: 0.0 · exit failed
Attribution: harness × recovery
Rule: patch_apply_failed_unhandled
Evidence: step 2, apply_patch → EIO (injected), no retry
Replay: retry_policy at step 2, 3 actions re-applied
Counterfactual: 100.0 PASS · real test command exits 0
```

The public result page and `/replay/res_c1ba8d7b…` show this. The legacy synthetic proof `res_64068a9c…` (49.7 → 98.3) remains in the store as contract history. An earlier generated project route did not satisfy the critical marker, and its retry was stored as **insufficient (59.9)** rather than presented as proof.

## Attribution validation

- 12 labeled synthetic fixtures cover 12 taxonomy cells.
- Fixture precision: 12/12 attributed runs correct.
- Fixture recall: 12/12 labeled cells named.
- Real-model sample: 3 tool_error runs; 1 proven sufficient, 2 rule-matched but insufficient.
- Real chaos sample: `res_c1ba8d7b…` is a real sandbox/model run with a counterfactual that re-runs the real test command and passes.
- Precision and recall are reported separately. Real-world recall depends on rule coverage and is not claimed as complete.

## Replay invariant

A test replays a recorded TaskBoard action set with no intervention and reproduces the baseline score exactly. With a retry at the failed step, it crosses the threshold; with a stop policy and the missing action, it returns insufficient. No model call, no produced-code execution, no filesystem writes.

## Reliability profile

The leaderboard aggregates stored runs by adapter + task: artifact score mean ± std, pass@k (score ≥ 70 and completed), layer distribution, pass rate per chaos condition, and trend. The stacked bar is the layer distribution, not decoration.

## How we built it

- **Scoring:** TypeScript, Zod, Vitest; static import graph; import-graph boundary test.
- **Harness:** adapter contract, Docker executor, proxy trace, bounded capture, diff.
- **Attribution:** pure rule engine; no provider dependency; evidence required.
- **Replay:** in-memory file map + existing deterministic engine; action log ephemeral.
- **Data:** append-only local/Upstash store; reliability aggregation; seed fallback.
- **Web:** Next.js 16, React, Tailwind, dark-only Coderia-derived design, Playwright E2E.
- **Video:** ElevenLabs with word timestamps, Playwright recordings, ASS karaoke captions, ffmpeg.

## Challenges

- Proving attribution without re-running the model: solved by recording actions and replaying only deterministic text writes.
- Keeping full source out of storage while enabling replay: the action log is memory-only; only redacted trace summaries and the proof are persisted.
- Balancing orientation and action in `/app`: numbered sections, real artifacts, explicit empty states.
- Honest numbers: the insufficient proof is visible, and the demo shows it rather than hiding it.

## What we learned

- The harness is measurable: two harnesses on one model produced different repositories.
- Attribution is only credible with a counterfactual; a rule name alone is a hypothesis.
- Redaction and replay pull in opposite directions; the ephemeral action log is the workable boundary.

## What's next

- More rules to cover the remaining taxonomy cells.
- A hosted organizer queue for public agent submissions.
- More language parsers for structural analysis.
- Scheduled 90-day retention.
- Calibrated confidence intervals over repeated runs.

## Built with

`next.js` · `react` · `typescript` · `tailwindcss` · `zod` · `vitest` · `playwright` · `docker` · `upstash-redis` · `openrouter` · `aider` · `python` · `elevenlabs` · `ffmpeg`

Community tasks are auto-validated on six mechanical gates. Promotion is curator-gated. Private tasks return 403 to every other viewer; rate limits are 3 pending / 10 per 24h per user / 20 globally.

## Honest limitations

- Static analysis only; the scoring engine never runs produced code.
- JS/TS import parsing first; other languages need new parsers.
- Attribution recall depends on rule coverage; precision and recall are reported separately.
- Real adapter runs are organizer-executed because they require Docker and provider credentials.
- Replay is proven for failures whose recorded actions are sufficient; some interventions remain insufficient.
- The final brand-agent pass was cut short by the OpenRouter account credit ceiling. Runs that received 402 are excluded rather than mislabelled as model failures; completed runs and costs are reported.
- Codex failed one multi-file task. The failure is stored and attributed to `model × decision` without a counterfactual.
- GitHub OAuth login was not completed end-to-end; the redirect, state cookie, signed session, anonymous fallback, curator promotion, and private 403 were exercised.
