# @orivoxx/core

**Role in the benchmark platform:** this package is the deterministic scoring rubric. It parses a task's `PROJECT_SPEC.md`, runs declarative rules over the captured repository, records evidence, applies verdict precedence, and produces a schema-validated report. It never executes the produced code and never calls a model.

## Status

Shipped modules: `spec-parser`, `checks`, `evidence`, `verdict`, `report`, `archive`, `inventory`, `verify-input`, and Zod `contracts` (including `graph/contracts`). The graph builder and graph metrics are planned.

## Commands

```bash
pnpm --filter @orivoxx/core test
pnpm --filter @orivoxx/core typecheck
pnpm --filter @orivoxx/core build
```

See the root [`README.md`](../../README.md) and [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) for the platform context.
