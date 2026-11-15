# Contributing to Orivoxx

## Documentation and positioning

Orivoxx is repositioning as a **benchmarking platform for AI software-engineering agents** for the HackCulture AI Global Hackathon, track **"Build a Benchmarking Platform for AI Agents, Not Just Models."**

- Documentation changes that improve accuracy, reproducibility, or clarity are welcome.
- **Code changes to the benchmarking layer are gated on the documentation pass landing first.** The target design must be reviewed before task registry, harness, runner, scoring, or leaderboard code is added.
- The word "verifier" is reserved for the deterministic rule engine component. The product is a benchmark platform; the rule engine is its scoring mechanism.
- Do not describe planned capabilities as shipped. If you add a claim to a doc, link it to code or mark it `TODO(verify)` / "planned".

Start with [`docs/VISION.md`](docs/VISION.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), and [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md).

## Development setup

Follow the quickstart in [`README.md`](README.md):

1. Copy `.env.example` to `.env.local` and set the Nebius variables.
2. `pnpm install`
3. `pnpm dev`
4. Before opening a pull request: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

The smoke test (`pnpm smoke`) makes a real provider call and requires `NEBIUS_API_KEY`. Do not run it with production credentials in a public environment.

## Pull requests

- Keep changes scoped. One concern per pull request.
- Add or update tests for code changes. Do not claim a test passed unless you ran it.
- Do not commit `.env` files, secrets, uploaded source, or provider output containing source.
- Do not add a dependency, change the model/provider, or expand the security boundary without prior review.
- For documentation-only changes, state which claims you verified against the repository and which remain planned.

## Security and privacy

- Never log archive bytes, source code, secret candidates, prompts, API keys, or raw model responses.
- Keep `NEBIUS_API_KEY` and Upstash credentials server-only. Never use a `NEXT_PUBLIC_` prefix for a secret.
- The scoring engine must never execute the produced repository. Agent execution belongs in the planned harness sandbox and requires an approved design.

## License

MIT. See `LICENSE`.

> `TODO(verify)`: the `LICENSE` file is not present in the repository yet.
