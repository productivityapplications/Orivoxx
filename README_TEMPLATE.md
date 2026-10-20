# Orivoxx

**Verify what AI builds. Understand why it matters.**

Orivoxx is a developer copilot that checks code against a project specification, ties findings to file/line evidence, and teaches users through explanations of actual code and verification findings.

> Hackathon MVP note: Orivoxx does not execute uploaded code, run user scripts, or persist uploaded source on its server. The hosted demo supports a bundled synthetic TaskBoard sample and bounded ZIP analysis.

## Why it exists

AI coding agents can produce plausible code while missing requirements or weakening intended constraints. Orivoxx offers an independent, evidence-centred verification pass plus contextual teaching so developers can understand the code instead of trusting it blindly. Its dark map-first workspace visualizes statically observed source dependencies and highlights deviations only when findings are tied to validated source paths.

## How it works

1. Load the sample project or upload a small ZIP containing a root `PROJECT_SPEC.md`.
2. Review the source-processing notice and explicitly consent before source context is sent for AI analysis.
3. Orivoxx parses the spec and runs deterministic checks.
4. It uses NVIDIA Nemotron via Nebius Token Factory for semantic checks that cannot be decided reliably by simple rules.
5. It combines the output using fixed rules: deterministic failures cannot be overturned by the model, and missing evidence is unverified.
6. Inspect red FAIL/DRIFT nodes in the project map, follow each finding to source evidence, and ask Orivoxx to explain code or a finding at beginner, intermediate or advanced level.

## Frontend design

The app uses a dark-only Linear-inspired interface, GitHub-like line evidence navigation, Sentry-like finding investigation, and a dependency-map workspace. See `FRONTEND_DESIGN_SPEC.md` for the authoritative visual tokens, node-state rules, graph interactions, responsive behavior and accessibility requirements.

## Nebius / NVIDIA usage

Orivoxx makes server-side runtime calls to Nebius Token Factory at `https://api.tokenfactory.nebius.com/v1/` using `nvidia/Nemotron-3.5-Super-VL` for bounded semantic verification and contextual teaching. Provider/model state is visible in the app. The model is not treated as an unquestioned source of truth; code evidence and deterministic rules govern verdict aggregation.

## Privacy and safety

- User-uploaded code is processed in memory and not persisted by Orivoxx after the request.
- Selected source context is sent to Nebius Token Factory only after consent; provider terms govern provider-side processing.
- Do not upload secrets, API keys, personal data, or confidential code unless you are authorized to share it.
- Orivoxx does not run uploaded code, tests, builds, scripts or package install commands.
- Large/unsafe ZIPs and secret/build/dependency paths are rejected or excluded.
- This MVP does not offer accounts, a persistent project history, live repository watch, code fixing or autonomous coding.

## Local development

Prerequisites: Node.js 24 LTS, pnpm, a Nebius Token Factory API key, and an Upstash Redis REST database for shared rate limits.

1. Copy `.env.example` to `.env.local`.
2. Set `NEBIUS_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `APP_BASE_URL`.
3. Install dependencies with `pnpm install`.
4. Run `pnpm dev`.
5. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before submitting changes.

Exact scripts may be finalized during Phase 0; update this README with the tested commands rather than claiming unrun steps work.

## Configuration

See `.env.example`. Secrets are server-only and must never use `NEXT_PUBLIC_` prefixes.

## Tests

Vitest covers parser, archive security, deterministic checks, schema validation and verdict precedence. Playwright covers sample/upload/verify/explain/export. A separate manual smoke test verifies a real Token Factory request in the deployed environment. Never treat mocked provider tests as evidence of a live API call.

## Open source

MIT License. See `LICENSE`.

## Hackathon

Submitted to the Nebius x NVIDIA Global AI Hackathon, Best Apps and Agents track. Official rules: https://nebiusglobalaihackathon.devpost.com/rules
