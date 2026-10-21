# TaskBoard — Project Specification

## Requirements

### REQ-AUTH-001 — Project access must be owner-scoped
- Severity: critical
- Verification: semantic
- Description: Every request that reads or mutates a project must verify that the authenticated requester is the project owner before returning or modifying data.
- Checks:
  - type: text_contains
    path: src/app/api/projects/[id]/route.ts
    text: assertProjectOwner

### REQ-ERR-001 — Project API returns structured error responses
- Severity: medium
- Verification: deterministic
- Description: The projects API must wrap handler body in a try/catch and return structured error responses instead of leaking stack traces.
- Checks:
  - type: text_contains
    path: src/app/api/projects/[id]/route.ts
    text: "catch (error)"

### REQ-PATH-001 — Projects API route exists
- Severity: high
- Verification: deterministic
- Description: The projects API route file must exist at the specified path.
- Checks:
  - type: file_exists
    path: src/app/api/projects/[id]/route.ts

### REQ-DEP-001 — No shell execution dependency
- Severity: critical
- Verification: deterministic
- Description: The project must not depend on libraries that allow arbitrary shell execution from within the web server process.
- Checks:
  - type: dependency_absent
    name: shelljs
