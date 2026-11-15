# apps/web

**Role in the benchmark platform:** this app is intended to host the public benchmark surface — task catalogue, run submission, result explorer, leaderboard, and optional explanation panel. It also exposes the deterministic engine's report through server routes.

## Status

Current: Next.js 16 shell with a dark landing placeholder and `GET /api/v1/health`, plus a server-only Nebius smoke adapter.

Planned: benchmark API, score/leaderboard read API, result explorer, and explanation routes. The `/workspace` dashboard described in `FRONTEND_DESIGN_SPEC.md` is not implemented.

## Commands

```bash
pnpm --filter web dev
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
pnpm --filter web smoke   # requires NEBIUS_API_KEY
```

See the root [`README.md`](../../README.md) and [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md).
