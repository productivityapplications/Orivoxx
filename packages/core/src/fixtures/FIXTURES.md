# TaskBoard fixtures

TaskBoard is a fictional, synthetic task-management project used as Orivoxx's bundled demo. It is not a real product and contains no real user data. Both snapshots are safe to redistribute and are intended to be read as static text only. They are never installed, built, run, or otherwise executed by Orivoxx.

## Snapshots

| Fixture | Purpose |
|---|---|
| `taskboard-regressed` | Demonstrates a critical owner-scoping authorization flaw and a missing structured-error requirement. Expected gate: `BLOCKED`. |
| `taskboard-compliant` | Corrects both defects while keeping the same specification and project structure. Expected gate: `PASS`. |

The two `PROJECT_SPEC.md` files are byte-identical. The fixtures differ only in source code.

## Requirement baseline

| Requirement | Severity | Verification | Regressed | Compliant |
|---|---|---|---|---|
| `REQ-AUTH-001` | critical | semantic | `FAIL` | `PASS` |
| `REQ-ERR-001` | medium | deterministic | `FAIL` | `PASS` |
| `REQ-PATH-001` | high | deterministic | `PASS` | `PASS` |
| `REQ-DEP-001` | critical | deterministic | `PASS` | `PASS` |

The manifests also record the expected run state (`COMPLETE`), expected gate, and known deviations. `taskboard-regressed` is blocked because the critical authorization requirement fails. `taskboard-compliant` passes.

### Run-state and semantic caveat

`expectedRunState: "COMPLETE"` describes the intended deterministic/baseline outcome when every requested check and required semantic assessment returns successfully. `REQ-AUTH-001` is a semantic requirement, so a live run depends on the model provider:

- If Nebius Token Factory returns a valid assessment, a fully successful run may be `COMPLETE`.
- If the provider is unavailable or returns invalid output, the semantic requirement must be `UNVERIFIED` and the run must become `PARTIAL` (with the gate derived from the product's fixed severity rules). The manifests deliberately do not encode `PARTIAL`; that state is operational, not a fixture baseline.

Phase 3 must apply the verdict precedence in `PROJECT_SPEC.md` rather than treating a manifest status as a final report status for a semantic requirement when no valid assessment exists.

## Content markers relied on by tests

- `src/app/api/projects/[id]/route.ts` in `taskboard-regressed` does **not** contain `assertProjectOwner` and does **not** contain `catch (error)`. Its `GET` and `PUT` handlers read and update a project by the route parameter without an ownership check or error wrapper.
- `src/app/api/projects/[id]/route.ts` in `taskboard-compliant` contains `assertProjectOwner` and `catch (error)`. It resolves a session, asserts ownership before returning or mutating the project, and returns structured errors.
- Both route files import `db` from `../../../../lib/db`.
- Both `src/lib/auth.ts` files export `assertProjectOwner`, import `getSession` from `./session`, and carry the comment `// Synthetic fixture: no real auth.` In the regressed fixture the helper exists but is never used by the route, which is the realistic defect.
- Both `package.json` files declare `next`, `react`, and `react-dom`, and neither declares `shelljs`.
- Both `src/lib/session.ts` files return a synthetic placeholder session. Both `src/lib/db.ts` files use an in-memory `Map` and contain no connection strings.
- Both `src/app/api/tasks/route.ts` and both `src/components/TaskList.tsx` files import from `lib/db`, giving the Phase 5 graph real cross-file edges.

## Safety confirmation

- No `.env*` files, private keys, certificates, credentials, tokens, or API keys are present.
- No shell commands, package scripts, install hooks, setup scripts, or executable payloads are present.
- No network calls, external URLs, or real database connections are present. The only identifiers are synthetic values such as `user-synthetic-001`.
- Fixture source is excluded from the core package build and typecheck (`packages/core/tsconfig.json`). It is disk data for later phases, not compiled library code.

## Contract for Phase 3

`fixture.manifest.json` is the ground truth for expected deterministic outcomes. Phase 3 must:

1. Load each fixture from disk.
2. Validate the manifest with `FixtureManifestSchema` from `@orivoxx/core`.
3. Parse the fixture spec and run deterministic checks against fixture files.
4. Compare the deterministic result for each requirement and the derived gate with `expectedRequirementStatuses` and `expectedGate`.
5. Treat any mismatch as a regression unless the fixture baseline is deliberately updated through an approved change. Do not weaken assertions or hardcode a pass.

The manifest baseline must remain consistent with the content markers above. Changing a marker requires updating the fixture, manifest, this document, and the corresponding tests together.

## Contract for Phase 5

Phase 5 loads these same directories as the bundled `TaskBoard` sample for `/workspace` (no upload required). The sample descriptor should preserve `sourceKind: "sample"` and the original spec text. The dependency map must be produced by the real Phase 5 graph builder from the fixtures' static imports and resolved within this inventory. It must not be a hardcoded graph or screenshot. The regressed/compliant pairing may power the optional sample comparison, but neither snapshot may be presented as a real user's verified repository.

Because the core build excludes fixture directories, Phase 5 must intentionally bundle or copy the fixture files into the web application (or expose a documented loader) rather than relying on `@orivoxx/core`'s compiled `dist` output.
