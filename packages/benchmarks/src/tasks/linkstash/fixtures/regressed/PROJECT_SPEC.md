# Linkstash — Benchmark Task Specification

> **Benchmark note:** this is a synthetic benchmark task. Every requirement is deterministic; the scoring engine never calls a model.

## Context

Build the bookmark API for Linkstash, a small authenticated bookmark manager. Users can list their own bookmarks and create new ones. The API must reject unauthenticated access, validate request bodies with Zod, return structured errors, and avoid shell-execution or dynamic-evaluation patterns.

## Requirements

### REQ-API-001 — Bookmark API route exists
- Severity: high
- Verification: deterministic
- Description: The bookmark API route must exist at the specified path.
- Checks:
  - type: file_exists
    path: src/app/api/bookmarks/route.ts

### REQ-API-002 — Bookmark API exposes a read handler
- Severity: high
- Verification: deterministic
- Description: The route must export a GET handler so clients can list bookmarks.
- Checks:
  - type: text_contains
    path: src/app/api/bookmarks/route.ts
    text: "export async function GET"

### REQ-API-003 — Bookmark API exposes a create handler
- Severity: high
- Verification: deterministic
- Description: The route must export a POST handler so clients can create bookmarks.
- Checks:
  - type: text_contains
    path: src/app/api/bookmarks/route.ts
    text: "export async function POST"

### REQ-AUTH-001 — Bookmark routes require an authenticated user
- Severity: critical
- Verification: deterministic
- Description: Every bookmark handler must resolve the authenticated user before reading or writing data.
- Checks:
  - type: text_contains
    path: src/app/api/bookmarks/route.ts
    text: requireUser

### REQ-VALID-001 — Bookmark creation validates input
- Severity: high
- Verification: deterministic
- Description: The POST handler must validate the request body with the declared Zod schema before writing to the data layer.
- Checks:
  - type: text_contains
    path: src/app/api/bookmarks/route.ts
    text: bookmarkSchema

### REQ-ERR-001 — Bookmark API returns structured errors
- Severity: medium
- Verification: deterministic
- Description: The route must catch handler failures and return a structured error response.
- Checks:
  - type: text_contains
    path: src/app/api/bookmarks/route.ts
    text: "catch (error)"

### REQ-DB-001 — Shared data layer exists
- Severity: medium
- Verification: deterministic
- Description: Bookmark persistence must go through the shared data layer.
- Checks:
  - type: file_exists
    path: src/lib/db.ts

### REQ-UI-001 — Bookmark list component exists
- Severity: low
- Verification: deterministic
- Description: The client must include a bookmark list component.
- Checks:
  - type: file_exists
    path: src/components/BookmarkList.tsx

### REQ-SEC-001 — No shell execution dependency
- Severity: critical
- Verification: deterministic
- Description: The project must not depend on libraries that allow arbitrary shell execution from the web server process.
- Checks:
  - type: dependency_absent
    name: shelljs

### REQ-SEC-002 — No environment file in the repository
- Severity: critical
- Verification: deterministic
- Description: The produced repository must not contain a `.env` file.
- Checks:
  - type: file_absent
    path: .env

### REQ-SEC-003 — No dynamic code evaluation
- Severity: critical
- Verification: deterministic
- Description: The bookmark route must not evaluate source strings at runtime.
- Checks:
  - type: text_not_contains
    path: src/app/api/bookmarks/route.ts
    text: eval(

### REQ-DEP-001 — Zod is declared as a dependency
- Severity: low
- Verification: deterministic
- Description: Input validation uses Zod, so the runtime dependency must be declared.
- Checks:
  - type: dependency_present
    name: zod
