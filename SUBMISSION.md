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
| Demo video | `demo/orivoxx-demo.mp4` (2:21) — upload to the submission host |
| License | MIT |

## Short description

Orivoxx is a framework-independent benchmark for AI software-engineering agents with **six metrics, three resilience modes, and deterministic counterfactual failure attribution**. It scores the produced repository statically, then names every failure by layer × mode and proves the attribution with a replay that crosses the pass threshold. No model is in the score path or the attribution path.

## The headline

A trace shows what happened, not why. Orivoxx attributes a failure to one of 20 cells — five layers (spec, model, harness, tool, environment) × four modes (decision, execution, recovery, detection) — and stores a counterfactual proof: baseline 49.7 → retry at step 2 → 98.3 PASS.

## What it does

1. **Versioned tasks.** TaskBoard and Linkstash pin a spec, starting repository, ruleset, scoring configuration, and pass threshold.
2. **Sandboxed runs.** A model-agnostic adapter runs in Docker: non-root, read-only rootfs, quotas, no platform secrets, one allowlisted model proxy.
3. **Six metrics.** Artifact score, steps, tool calls, tokens, cost, duration.
4. **Three chaos modes.** Injected tool error, latency, context pressure.
5. **Deterministic scoring.** Spec 60% / security 25% / maintainability 15%; caps at 59.9 / 49.9; no model in the loop.
6. **Attribution.** Twelve deterministic rules over the trace; each cell has step-level evidence.
7. **Replay proof.** Memoized counterfactual: byte-identical prefix, one intervention, static rescore.
8. **Reliability profile.** Mean ± std, pass@k, layer distribution, chaos sensitivity, trend.
9. **Public product.** Landing, app home, catalogue, result, trace, replay, leaderboard, compare, docs.
10. **Self-serve baseline.** Anyone can create a real result without a model call.

## Real recorded proof

```text
Result: res_64068a9c… · deepseek/deepseek-chat-v3-0324 · tool_error
Score: 49.7 · exit failed
Attribution: harness × recovery
Evidence: step 2, write_file → EACCES, no retry before exit
Replay: intervention retry_policy at step 2, 6 replayed steps
Counterfactual: 98.3 PASS (threshold 70)
```

The public result page and `/replay/res_64068a9c…` show this. An earlier generated project route did not satisfy the critical marker, and its retry was stored as **insufficient (59.9)** rather than presented as proof.

## Attribution validation

- 12 labeled synthetic fixtures cover 12 taxonomy cells.
- Fixture precision: 12/12 attributed runs correct.
- Fixture recall: 12/12 labeled cells named.
- Real-model sample: 3 tool_error runs; 1 proven sufficient, 2 rule-matched but insufficient.
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

## Honest limitations

- Static analysis only; the scoring engine never runs produced code.
- JS/TS import parsing first; other languages need new parsers.
- Attribution recall depends on rule coverage; precision and recall are reported separately.
- Real adapter runs are organizer-executed because they require Docker and provider credentials.
- Replay is proven for failures whose recorded actions are sufficient; some interventions remain insufficient.
