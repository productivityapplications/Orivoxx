# TaskBoard — Benchmark Task Specification

> **Benchmark note:** every requirement below is deterministic. The scoring engine parses this file, evaluates declared checks against the produced repository, and never calls a model. The task is derived from the TaskBoard verifier fixtures; the semantic verification mode was projected to a deterministic text-marker check so the score stays model-free.

## Context

Build the project-access API for TaskBoard, a small Next.js task board. Project records are owned by a user. Every read or mutation of a project must verify ownership before returning data. The API must return structured error responses and must not introduce shell-execution dependencies.

## Requirements

### REQ-AUTH-001 — Project access must be owner-scoped
- Severity: critical
- Verification: deterministic
- Description: Every request that reads or mutates a project must verify that the authenticated requester is the project owner. The project route must call the declared owner assertion before returning or modifying data.
- Checks:
  - type: text_contains
    path: src/app/api/projects/[id]/route.ts
    text: assertProjectOwner

### REQ-ERR-001 — Project API returns structured error responses
- Severity: medium
- Verification: deterministic
- Description: The projects API must wrap handler bodies in a try/catch and return a structured error response instead of leaking stack traces.
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

### REQ-TASKS-001 — Task list API route exists
- Severity: high
- Verification: deterministic
- Description: The task list API route must exist so the board can load tasks for the authenticated user.
- Checks:
  - type: file_exists
    path: src/app/api/tasks/route.ts

### REQ-TASKS-002 — Task list reads through the repository layer
- Severity: medium
- Verification: deterministic
- Description: The task list route must read projects through the shared data layer rather than duplicating storage access.
- Checks:
  - type: text_contains
    path: src/app/api/tasks/route.ts
    text: db.listProjects

### REQ-UI-001 — Task list component exists
- Severity: low
- Verification: deterministic
- Description: The TaskBoard client must include a task list component.
- Checks:
  - type: file_exists
    path: src/components/TaskList.tsx

### REQ-SEC-002 — No environment file in the repository
- Severity: critical
- Verification: deterministic
- Description: The produced repository must not contain a `.env` file. Secrets belong in the deployment environment, not in source.
- Checks:
  - type: file_absent
    path: .env

### REQ-SEC-003 — No dynamic code evaluation in the project route
- Severity: critical
- Verification: deterministic
- Description: The project route must not evaluate source strings at runtime.
- Checks:
  - type: text_not_contains
    path: src/app/api/projects/[id]/route.ts
    text: eval(
