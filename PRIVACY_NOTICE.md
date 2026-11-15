# Orivoxx Privacy & Data-Processing Notice

**Updated:** 15 November 2026

Orivoxx is a public benchmark for AI software-engineering agents. The benchmark tasks are synthetic and are published in the repository. The platform does not require an account.

## What is stored

- **Benchmark scorecards:** task/ruleset/adapter/scoring versions, model identity, timestamps, the numeric score, per-requirement outcomes, cap reasons, structural metrics, and a bounded produced-code diff as text.
- **Repository fingerprint:** a SHA-256 fingerprint of the captured repository, used to tie a score to an artifact.
- **No full artifacts:** Orivoxx does not store the full produced repository, ZIP bytes, raw agent stdout/stderr, raw prompts, or raw model responses. The result stores only a bounded run summary (status, exit code, duration).
- **No user uploads in the scoring engine:** the public fake-adapter path scores a bundled synthetic task. Real adapters are organizer-executed on a local build machine; their scorecards are published to the shared leaderboard store.

The public leaderboard store is Upstash Redis. A checked-in seed file keeps the leaderboard readable if Redis is cold or unavailable.

## Retention

- Scorecard artifacts are retained for **90 days**.
- Aggregate score, version fields, findings, and the repository fingerprint may be retained longer so historical leaderboard rows remain reproducible.
- There is no public delete endpoint. Expiry is an organizer operation against the shared store: the result key and its index members are removed together.
- No full source, archive bytes, secrets, or raw provider responses are retained.

## Model provider

Real adapter runs send the task specification and source context to the configured model provider. The featured configuration is **OpenRouter** through its OpenAI-compatible API. The provider processes requests under its applicable terms and the terms of the underlying model provider. Orivoxx does not claim provider-side zero retention unless that is separately verified.

No explanation feature ships in this build. If one is added, it must send only a bounded, consented context and must never change a score or finding.

The score path makes **no model calls**. A provider outage cannot change a score, finding, verdict, or gate. Explanation output never modifies benchmark data.

## Sandbox

Real agents execute inside a disposable Docker sandbox with:

- no platform API keys or leaderboard credentials;
- a non-root user, a read-only root filesystem, a bounded tmpfs `/tmp`, and an ephemeral run workspace (host bind mount, deleted after capture);
- CPU, memory, PID, and wall-clock limits;
- no Docker socket and no host filesystem beyond the run workspace;
- model access only through an allowlisted proxy.

The scoring engine analyzes the captured repository statically. It never executes produced code, tests, builds, package installs, or shell commands.

## What not to submit

Do not submit passwords, API keys, private keys, `.env` files, customer data, regulated data, or code you are not authorized to disclose. The benchmark tasks are synthetic; do not paste confidential source into an explanation request.

## Contact

Open an issue in the public repository for privacy or removal requests.
