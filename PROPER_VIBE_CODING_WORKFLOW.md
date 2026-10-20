# Proper Vibe Coding Workflow

## Purpose

This document defines a disciplined workflow for building software with AI coding agents such as Cline, OpenCode, Codex, Claude Code, Cursor, and similar tools.

The core principle is:

> Good vibe coding is not telling AI to build everything. It is managing an AI software engineer with clear requirements, controlled scope, checkpoints, tests, and verification.

---

## 1. Start With the Problem, Not the Code

Before opening the coding agent, define:

- What are we building?
- Who is it for?
- What problem does it solve?
- What does the user actually do?
- What does success look like?
- What is explicitly out of scope?

Example:

> Takeover allows someone who cannot attend an appointment to transfer the opportunity to another qualified person without the original organizer having to find a replacement manually.

This is better than:

> Build an appointment marketplace.

The first describes a problem and user outcome. The second leaves too much open to interpretation.

---

## 2. Define the MVP

Separate features into:

### Must Have

The minimum functionality required for the product to work.

### Nice to Have

Useful enhancements that can wait.

### Later

Features that should not distract from the initial build.

Example:

**Must have**
- User registration
- Create appointment
- Mark appointment transferable
- Someone claims it
- Original appointment holder confirms
- Transfer is recorded

**Nice to have**
- AI matching
- Reputation
- Payments
- Notifications
- Calendar integrations

**Later**
- Mobile app
- Advanced recommendation engine
- Advanced analytics

The AI should initially build only the must-have functionality.

---

## 3. Write a Specification Before Implementation

Create a source-of-truth document such as:

```text
PROJECT_SPEC.md
```

Recommended sections:

```text
1. Product overview
2. Users
3. Core user flows
4. Features
5. Business rules
6. Data model
7. Authentication
8. API requirements
9. UI requirements
10. Security requirements
11. Out-of-scope features
12. Acceptance criteria
```

The specification prevents the AI from inventing requirements while coding.

---

## 4. Decide the Architecture

Do not allow the AI to randomly select technologies while implementation is already underway.

Define the stack first.

Example:

```text
Frontend
Next.js
TypeScript
Tailwind

Backend
Next.js API / Node

Database
PostgreSQL

Authentication
Clerk / Supabase Auth

Payments
Stripe

AI
OpenAI API

Deployment
Vercel
```

Tell the agent:

> Do not change the architecture without asking me first.

This prevents architecture drift and unnecessary migrations.

---

## 5. Have the AI Understand the Existing Project First

Before implementation, have the agent inspect:

- Repository structure
- package.json
- Existing code
- Environment
- Database schema
- Configuration
- Documentation
- Entry points
- Existing components

A useful instruction is:

> Do not modify anything. Inspect the repository and explain the architecture, existing components, dependencies, entry points, risks, and what needs to change to implement the specification.

This is one of the biggest differences between good and bad AI-assisted development.

---

## 6. Create an Implementation Plan

Do not immediately ask:

> Build the application.

Instead:

> Create an implementation plan based on PROJECT_SPEC.md. Break it into independently testable phases. Do not write code yet.

A good plan might look like:

```text
Phase 1 — Foundation
  ├── project setup
  ├── database
  └── authentication

Phase 2 — Core entities
  ├── users
  ├── appointments
  └── transfers

Phase 3 — Transfer flow
  ├── create transfer
  ├── claim transfer
  └── confirmation

Phase 4 — UI
  ├── dashboard
  ├── appointment page
  └── transfer page

Phase 5 — Security
  ├── authorization
  ├── validation
  └── abuse prevention

Phase 6 — Testing
  ├── unit tests
  ├── integration tests
  └── E2E tests
```

---

## 7. Build One Phase at a Time

This is one of the most important rules.

Do NOT tell the agent:

> Implement phases 1–6.

Instead:

> Implement Phase 1 only.

Then:

1. Stop.
2. Run tests.
3. Inspect the changes.
4. Fix anything wrong.
5. Commit.
6. Move to the next phase only after verification.

AI coding agents can make large numbers of changes extremely quickly. Small controlled phases reduce the damage when something goes wrong.

---

## 8. Give the AI Explicit Constraints

A reusable instruction set:

```text
Rules:

1. Follow PROJECT_SPEC.md.
2. Do not invent requirements.
3. Do not change the architecture without asking.
4. Do not modify unrelated files.
5. Reuse existing components where possible.
6. Run tests after implementation.
7. Do not proceed to the next phase automatically.
8. If something is ambiguous, stop and explain the ambiguity.
9. Never claim something works without testing it.
10. At the end, provide a summary of files changed and tests run.
```

This changes the agent from an uncontrolled code generator into an engineer operating within a specification.

---

## 9. Use Small, Independently Testable Tasks

Instead of:

> Build authentication.

Break it down.

Example:

```text
Implement email/password registration.

Requirements:
- ...
- ...
- ...

Acceptance criteria:
- ...
- ...
- ...

Do not implement login yet.
Do not modify unrelated functionality.
Run the relevant tests when finished.
STOP after completing this task.
```

Then separately implement:

- Login
- Password reset
- Authorization middleware
- Session handling
- etc.

Small tasks reduce hallucination, unintended changes, and architectural drift.

---

## 10. Make the AI Test Its Own Work

Every meaningful feature should follow:

```text
IMPLEMENT
    ↓
TEST
    ↓
INSPECT
    ↓
FIX
    ↓
COMMIT
```

Do not follow:

```text
IMPLEMENT
    ↓
IMPLEMENT
    ↓
IMPLEMENT
    ↓
IMPLEMENT
    ↓
"Hopefully it works"
```

Useful verification commands may include:

```bash
npm test
npm run build
npm run lint
```

and, depending on the project:

```text
Unit tests
Integration tests
API tests
End-to-end tests
Database tests
```

For UI features, have the agent verify the actual user flow.

---

## 11. Do Not Trust "It Works"

If the agent says:

> Authentication is now working.

Ask it to prove it.

A better instruction:

> Run the relevant tests and verify the complete registration → login → dashboard flow. Report the actual test results. Do not claim success without evidence.

Core principle:

> Evidence > AI's claim.

---

## 12. Use Git Aggressively

Create small, meaningful commits.

Good examples:

```text
feat: add authentication
feat: add appointment creation
feat: add transfer claims
fix: prevent duplicate claims
test: add transfer flow tests
```

Avoid giant unclear commits such as:

```text
BIG UPDATE FINAL FINAL 2
```

Git is the safety net that allows you to roll back bad AI changes.

---

## 13. Create Checkpoints

For serious projects:

```text
CHECKPOINT 1
    ↓
VERIFY
    ↓
COMMIT
    ↓
CHECKPOINT 2
    ↓
VERIFY
    ↓
COMMIT
```

At each checkpoint, record:

```text
Current phase:
Completed:
Tests:
Known issues:
Next task:
Blocked by:
```

This is particularly useful when:

- The AI session ends.
- Model quota runs out.
- Switching between Cline, OpenCode, Codex, or another agent.
- Returning to the project after a break.
- Handing the project to another developer/agent.

---

## 14. Maintain an AI Handoff File

For larger projects, maintain:

```text
AGENTS.md
```

and/or:

```text
AI_HANDOFF.md
```

Recommended information:

```text
PROJECT
Current architecture
Important decisions
Current phase
Completed work
Known bugs
Commands
Environment
Important files
Things NOT to change
Next task
```

This gives a new AI session enough context to continue without repeatedly explaining the project.

---

## 15. Separate Product Decisions From Implementation Decisions

The human should control product decisions.

Example:

**Human/product decision:**

> Users should be able to transfer appointments.

**AI/implementation decision:**

> Implement this using a Transfer table with a unique constraint.

The human should retain control over:

- Product requirements
- Architecture
- Security model
- Data ownership
- Business rules
- Scope
- Acceptance criteria

The AI should primarily accelerate implementation.

---

## 16. Perform AI Code Reviews

After a major feature, ask:

> Review everything you just implemented as a senior engineer. Look specifically for security vulnerabilities, race conditions, incorrect assumptions, edge cases, broken business logic, unnecessary complexity, and missing tests. Do not modify anything yet. Report findings first.

Then decide what should be fixed.

This is much better than asking:

> Is the code good?

---

## 17. Perform a Dedicated Security Pass

Before deployment, explicitly review:

```text
AUTHENTICATION
AUTHORIZATION
INPUT VALIDATION
RATE LIMITING
SECRET HANDLING
SQL INJECTION
XSS
CSRF
IDOR
PRIVILEGE ESCALATION
RACE CONDITIONS
PAYMENT SECURITY
WEBHOOK SECURITY
API SECURITY
```

A particularly useful approach is to ask the AI to act as an attacker:

> Assume you are a malicious user. Try to claim another user's appointment, manipulate IDs, bypass authorization, replay requests, submit malformed input, and exploit race conditions. Do not fix anything yet. Report vulnerabilities.

This encourages adversarial testing instead of simply asking the AI to praise its own implementation.

---

# The Complete Vibe-Coding Loop

```text
                 IDEA
                   ↓
              SPECIFICATION
                   ↓
                 MVP
                   ↓
              ARCHITECTURE
                   ↓
             REPOSITORY REVIEW
                   ↓
          IMPLEMENTATION PLAN
                   ↓
        IMPLEMENT ONE SMALL TASK
                   ↓
                 TEST
                   ↓
                REVIEW
                   ↓
                FIX BUGS
                   ↓
               GIT COMMIT
                   ↓
              CHECKPOINT
                   ↓
             NEXT TASK
                   ↓
                  ...
                   ↓
             SECURITY AUDIT
                   ↓
             E2E TESTING
                   ↓
               DEPLOY
                   ↓
             MONITOR / FIX
```

---

# The Golden Rule

> Never let the AI's ability to generate code determine the size of the task.

AI can generate thousands of lines of code very quickly.

That does not mean you should ask it to.

Your job is to maintain:

- Direction
- Scope
- Product intent
- Architecture
- Security requirements
- Acceptance criteria
- Verification

The AI's job is to accelerate:

- Implementation
- Testing
- Debugging
- Refactoring
- Documentation

---

# Recommended Structure for Serious Projects

For substantial builds, use:

```text
PROJECT/
│
├── PROJECT_SPEC.md
├── ARCHITECTURE.md
├── IMPLEMENTATION_PLAN.md
├── AGENTS.md
├── AI_HANDOFF.md
│
├── src/
├── tests/
├── docs/
└── ...
```

### PROJECT_SPEC.md

The product source of truth.

### ARCHITECTURE.md

The technical architecture and important technical decisions.

### IMPLEMENTATION_PLAN.md

The phased build plan.

### AGENTS.md

Persistent instructions and rules for AI coding agents.

### AI_HANDOFF.md

Current state, completed work, known issues, and the exact next step.

---

# Recommended Operating Model

For future builds, use this division of responsibility:

```text
YOU
↓
Product architect / technical decision maker

AI AGENT
↓
Senior implementation engineer

PROJECT_SPEC.md
↓
Source of truth

AGENTS.md
↓
Persistent AI rules

AI_HANDOFF.md
↓
Continuity / session memory

GIT
↓
Safety net

TESTS
↓
Truth

CHECKPOINTS
↓
Control
```

The objective is not simply to "code with AI."

The objective is to create a repeatable system where AI can build quickly **without losing control of the software.**
