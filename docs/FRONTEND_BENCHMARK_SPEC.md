# Orivoxx — Benchmark Frontend Specification

**Version:** 1.0 · **Status:** source of truth for the benchmark UI · **Updated:** 15 November 2026

This document defines the public product surface. It replaces the verifier-era map-first workspace (`FRONTEND_DESIGN_SPEC.md`) as the current UI contract. The map-first document stays in the repository as visual history; the benchmark UI is **list-first**.

## 1. Design intent

Orivoxx should read as a precise measurement instrument. The primary object is a **result**: a score, its three benches, the requirement outcomes behind it, and the versions that make it reproducible.

- **List first, evidence second.** Requirements and their outcomes are rows. Selecting a row opens its rule, evidence, and source reference. There is no canvas requirement and no chat surface.
- **Score first, explanation optional.** The scorecard is above the fold. A model explanation is a separate, explicit action and never changes a number.
- **Show the machinery.** Versions, caps, tally, fingerprint, and the produced-code diff are visible. Nothing about the score is hidden.
- **Calm density.** Thin borders, 4px spacing scale, no gradients, no decorative charts, no oversized marketing cards.
- **Honest states.** `PASS`, `FAIL`, `DRIFT`, `UNVERIFIED`, `DEGRADED`, `ORGANIZER-RUN`, `SAMPLE` are labelled in text as well as color.

## 2. Dark tokens

Every screen and state uses these tokens. No light theme, no toggle. Components must not carry one-off hex values.

| Token | Value | Use |
|---|---|---|
| `--bg-app` | `#0B0D10` | Page background |
| `--bg-panel` | `#101319` | Panels, tables |
| `--bg-raised` | `#151922` | Hovered/selected rows |
| `--bg-inset` | `#0D1117` | Code and diff blocks |
| `--border-subtle` | `#232A35` | Dividers, card borders |
| `--border-strong` | `#3A4351` | Focus, emphasized outline |
| `--text-primary` | `#F2F4F8` | Primary text |
| `--text-secondary` | `#B0B8C5` | Supporting text |
| `--text-muted` | `#808A99` | Metadata only, never sole body copy |
| `--accent` | `#A78BFA` | Primary action, active nav |
| `--accent-secondary` | `#75A7FF` | Links, keyboard focus |
| `--status-pass` | `#48C9A4` | Verified pass |
| `--status-fail` | `#FF5D6C` | Confirmed failure |
| `--status-drift` | `#FF7A86` | Specification drift |
| `--status-unverified` | `#F3C66D` | Missing evidence |
| `--status-neutral` | `#8792A2` | Not assessed, baseline |
| `--status-accent` | `#9D8BFF` | In-progress, organizer-run |
| `--radius-control` | `6px` | Buttons, inputs |
| `--radius-panel` | `8px` | Panels, tables |

Type: system UI stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`); code `ui-monospace, "SFMono-Regular", Menlo, monospace`. Base 14px, metadata 12px, page title 28–32px, section title 15–16px semibold. Minimum body contrast 4.5:1; status colors are used for chips and bars, with a text label always present.

Motion: at most 120ms opacity/transform on hover and row selection. No spinners longer than 300ms without a label; no skeleton that mimics data.

## 3. Information architecture

| Route | Purpose | Data |
|---|---|---|
| `/` | Landing: what is measured, live top rows, task cards | leaderboard (limit 5), task registry |
| `/benchmarks` | Task catalogue with versions and difficulty | task registry |
| `/benchmarks/[taskId]` | Task detail: spec, requirements, starting files, adapters | task definition + task leaderboard |
| `/submit` | Self-serve fake run: pick task + fixture variant | task registry |
| `/results/[resultId]` | Scorecard, requirement list, evidence, diff | stored result |
| `/leaderboard` | Ranked rows, task filter | result store |
| `/compare` | Two results side by side on one task | two results + task |
| `/privacy` | Data handling, retention, provider terms | static |
| `/docs` | In-app documentation (P9) | static Markdown |

Shared shell: top bar with `ORIVOXX` wordmark, nav (`Benchmarks`, `Leaderboard`, `Compare`, `Docs`), a `GitHub` link, and a right-side slot for the current task or result id. Max width 1200px, 24px gutters, sticky top bar with 1px bottom border.

## 4. Page contracts

### 4.1 Landing `/`

1. Eyebrow `BENCHMARK THE AGENT, NOT JUST THE MODEL`.
2. H1: `A scorecard for AI software-engineering agents.`
3. One-paragraph definition: versioned spec → sandboxed run → static deterministic score; every point traceable.
4. Two CTAs: `Run the fake baseline` (primary, `/submit`) and `Explore results` (secondary, `/leaderboard`).
5. Three compact facts: `3 benches`, `deterministic`, `no LLM in the score`.
6. Live leaderboard preview: top 5 rows from the store; a `SAMPLE` chip when the rows are the bundled seed.
7. Task cards: title, versions, difficulty, requirement count, link.
8. Footer: `Deterministic scoring · Static analysis only · MIT`.

No hero illustration, stock photo, or fake product screenshot. Numbers come from the store.

### 4.2 Catalogue `/benchmarks`

A table or list of task cards: id, title, summary, `taskVersion`, `rulesetVersion`, `scoringConfigVersion`, requirement count, time limit, network mode, difficulty. Each card links to `/benchmarks/[taskId]`. Above the list: one line explaining that tasks are versioned and immutable.

### 4.3 Task detail `/benchmarks/[taskId]`

- Header: title, summary, version strip (`task`, `ruleset`, `scoring config`).
- Requirement table: id, title, severity, bench, verification mode. Check details are shown on row expansion, including the declared path and rule type.
- Starting files: bounded list with sizes; `PROJECT_SPEC.md` rendered as escaped text.
- Adapters: the three adapters with kind and model; organizer-run adapters are labelled and not submit buttons.
- Task leaderboard: top 5 rows for this task, linking to results.
- Not found → the shared empty state with a link back to `/benchmarks`.

### 4.4 Submit `/submit`

A two-step, single-page form:

1. Task select (cards, default `taskboard`).
2. Fixture variant select: `compliant` or `regressed`, with a one-line explanation that this is the fake baseline and does not call a model.

Primary button `Run fake baseline`. On submit: inline progress with a labelled status (`running benchmark`), then redirect to `/results/[resultId]`. Errors render a fixed envelope message (`run_failed`, `invalid_input`, `store_unavailable`) and keep the form values.

Disclosure under the button: `No model call. The fake baseline materializes a checked-in fixture and scores it deterministically.` Real adapter runs are organizer-executed; there is no public field to submit an arbitrary command.

### 4.5 Result `/results/[resultId]`

Above the fold:

- Breadcrumb `Leaderboard / task / result`.
- Task title, adapter label, model name or `No model (fake baseline)`, run status, duration, created time.
- Score block: `overall` to one decimal, `/ 100`, plus the three bench bars (`spec 60%`, `security 25%`, `maintainability 15%`).
- Cap banner when `capsApplied` is non-empty: every cap reason, the pre-cap score if known, and `critical spec cap 59.9` / `critical security cap 49.9` wording. Caps are never hidden.
- Version strip: `taskVersion`, `rulesetVersion`, `scoringConfigVersion`, `adapterVersion`, `repositoryFingerprint` (monospace, copyable).
- Tally chips: passed, failed, drifted, unverified.

Below:

- **Requirement list** (primary): rows with status chip, id, title, severity, bench. Selecting a row expands inline evidence: rule id, matched text or missing evidence, source path, and line range when present. Keyboard: `Enter`/`Space` toggles, arrow keys move focus.
- **Produced-code diff**: escaped `<pre>` text, unified diff, with a `truncated` notice when the budget cut it. No syntax highlighting required; no HTML rendering.
- **Run output**: bounded stdout/stderr summaries when non-empty.
- `UNVERIFIED` is counted separately from `FAIL` and both are shown in the tally.
- Unknown result id → 404 page with `not_found` and a leaderboard link.

The result page never calls a model. An `Explain` action is out of scope for this build; if added later it must be an explicit, consented, separate call.

### 4.6 Leaderboard `/leaderboard`

- Task filter (all tasks + each task id), result count, and a `SAMPLE` / `DEGRADED` chip with a one-line explanation.
- Table columns: rank, score, task, adapter, model, spec, security, maint., caps, created. Rows link to results.
- Default sort: score desc, then earlier `createdAt`, then `resultId`. The UI must not re-sort independently of the store.
- Fake rows carry a `SAMPLE` or `BASELINE` chip; organizer-run harness rows carry `HARNESS`.
- Empty store → empty state, not fake rows. Seed fallback rows are labelled.
- Mobile: table becomes stacked rows with score first and adapter/task second.

### 4.7 Compare `/compare`

- Two result selectors scoped to one task, defaulting to the top two distinct adapters on `taskboard`.
- Header: task, versions, and the shared model slug when identical; a `same model` or `different model` chip.
- Side-by-side score blocks, bench deltas (B − A, one decimal, signed), tally deltas, and a requirement matrix: one row per requirement id, status for A and B.
- The comparison is read-only. No computed “winner” claim beyond the score difference.
- Missing task or fewer than two results → empty state with a link to run the fake baseline.

### 4.8 Privacy `/privacy`

Static dark page: what is stored (bounded scorecard, diff text), what is not (source, archives, prompts, keys), retention, shared-store location, provider terms, no analytics/cookies, contact placeholder. Content mirrors `docs/RESULTS_RETENTION.md` and `PRIVACY_NOTICE.md`.

## 5. Status vocabulary

| Token | Label | Meaning |
|---|---|---|
| `PASS` | Pass | Deterministic check satisfied |
| `FAIL` | Fail | Deterministic check violated |
| `DRIFT` | Drift | Declared structure no longer matches the ruleset |
| `UNVERIFIED` | Unverified | No evidence available; earns 0 but is not a failure |
| `DEGRADED` | Sample data | Store unavailable, bundled rows shown |
| `SAMPLE` | Sample | Fake-baseline fixture row |
| `HARNESS` | Organizer-run | Real adapter executed by the organizer |
| `CAPPED` | Capped | A critical failure applied a score ceiling |

Color is never the only signal: every chip contains its label. Chips use a 1px border, 2px radius, 11–12px uppercase text with 0.04em tracking.

## 6. States

| State | Surface | Rule |
|---|---|---|
| Loading | Route-level | Server components render data directly; client actions show a labelled inline status, no skeleton data |
| Empty | Leaderboard, compare, task leaderboard | Explain what is missing and link to a next action |
| Degraded | Leaderboard, result | `DEGRADED` chip plus one line naming the fallback; rows still readable |
| Not found | Task, result | 404 message with the offending id and a link back |
| Error | Submit | Fixed error envelope; no stack trace, no provider body |
| Capped | Result | Banner above the score, cap reasons listed |
| Truncated | Diff | `truncated` notice above the diff text |
| Provider unavailable | Not applicable to public reads | No public read path requires a provider |

## 7. Accessibility

- Every interactive element is reachable by `Tab`, with a visible `2px` `--accent-secondary` focus ring.
- Requirement rows are buttons with `aria-expanded` and a labelled detail region.
- Tables use real `<table>`, `<th scope="col">`, and a caption.
- Status chips have text; contrast of chip text on chip background ≥ 4.5:1.
- Score bars have `role="img"` and an `aria-label` with the numeric value.
- Diff and code blocks are `<pre>` with escaped text and a `Copy` button that announces success.
- Respect `prefers-reduced-motion`; no animation is required to understand a state.
- Touch targets ≥ 40px on mobile.

## 8. Responsive behavior

| Breakpoint | Behavior |
|---|---|
| ≥ 1024px | Two-column result layout: requirement list 2/3, evidence panel inline; nav inline |
| 768–1023px | Single column; nav collapses to a wrapped row; tables allow horizontal scroll with a sticky first column |
| < 768px | Stacked cards; leaderboard rows become score + task + adapter; code blocks scroll horizontally; nav in a disclosure |

## 9. Component inventory

| Component | File | Responsibility |
|---|---|---|
| `AppShell` | `apps/web/src/components/app-shell.tsx` | Top bar, nav, footer, skip link |
| `StatusChip` | `apps/web/src/components/status-chip.tsx` | Fixed status vocabulary |
| `ScoreBlock` | `apps/web/src/components/score-block.tsx` | Overall + three bench bars |
| `CapBanner` | `apps/web/src/components/cap-banner.tsx` | Cap reasons and ceilings |
| `VersionStrip` | `apps/web/src/components/version-strip.tsx` | Reproducibility fields |
| `TallyChips` | `apps/web/src/components/tally-chips.tsx` | Pass/fail/drift/unverified counts |
| `RequirementList` | `apps/web/src/components/requirement-list.tsx` | Keyboard-accessible outcome rows |
| `DiffView` | `apps/web/src/components/diff-view.tsx` | Escaped diff text and truncation notice |
| `LeaderboardTable` | `apps/web/src/components/leaderboard-table.tsx` | Ranked rows, chips, task filter |
| `TaskCard` | `apps/web/src/components/task-card.tsx` | Catalogue entry |
| `EmptyState` | `apps/web/src/components/empty-state.tsx` | Shared empty/not-found copy |
| `SubmitForm` | `apps/web/src/components/submit-form.tsx` | Fake-run form and error states |
| `ComparePanel` | `apps/web/src/components/compare-panel.tsx` | Side-by-side results and requirement matrix |
| `CodeBlock` | `apps/web/src/components/code-block.tsx` | Escaped text, copy action |

## 10. Non-goals

- No chat interface, no conversational assistant, no “ask the model about this score”.
- No dependency map on the benchmark result page. The map-first workspace is historical.
- No model output in the score path, and no UI affordance that implies one.
- No analytics, cookies, telemetry, or third-party embeds.
- No light theme.
