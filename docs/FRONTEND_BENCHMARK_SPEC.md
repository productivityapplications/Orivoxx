# Orivoxx — Benchmark Frontend Specification

**Version:** 2.0 · **Status:** source of truth for the attribution-era UI · **Updated:** 18 November 2026

Supersedes the list-first-only v1 contract. The visual language follows `docs/UI_REFERENCE_NOTES.md` (Coderia); page completeness follows `docs/LANDING_REFERENCE_NOTES.md` and `docs/APP_HOME_REFERENCE_NOTES.md`.

## 1. Product split

| Surface | Route | Job |
|---|---|---|
| Marketing landing | `/` | Explain the problem, solution, measurement, and proof; drive to `/app` |
| App home | `/app` | Orient a returning user and expose the next action |
| Product surfaces | `/benchmarks`, `/submit`, `/results`, `/leaderboard`, `/compare`, `/docs`, `/privacy` | Do the work |

The landing is **not** the app shell with a hero. The app is **not** a dashboard with five widgets and no narrative.

## 2. Visual language

Coderia-derived, dark-only, warm near-black.

| Token | Value | Use |
|---|---|---|
| `--bg-app` | `#0B0B09` | Page background |
| `--bg-panel` | `#111110` | Cards, tables |
| `--bg-raised` | `#171715` | Hover, selected row |
| `--bg-inset` | `#0E0E0C` | Code, terminal, trace |
| `--border-subtle` | `#262622` | 1px card/divider |
| `--border-strong` | `#3A3A34` | Focus, hover |
| `--text-primary` | `#E1E1DB` | Primary text |
| `--text-secondary` | `#B0B0A8` | Supporting text |
| `--text-muted` | `#8C8C85` | Metadata |
| `--accent` | `#17CF97` | Primary action, PASS, links |
| `--accent-secondary` | `#75A7FF` | Informational links |
| `--status-fail` | `#FF5C5C` | FAIL, critical |
| `--status-drift` | `#FF8A7A` | DRIFT |
| `--status-unverified` | `#F3C66D` | UNVERIFIED |
| `--status-neutral` | `#8C8C85` | Not assessed |

Type: **Instrument Serif** 400 for display and section headings (`clamp(40px, 6vw, 64px)`, tracking −0.03em); **Geist** for body/UI (14–16px); **Geist Mono** for labels, ids, numbers. Mono eyebrow: 11px uppercase, 0.12em tracking, format `\ 01 \` / `\ SECTION \`.

Rhythm: max width 1280px; section padding 90px desktop / 56px mobile; 4/8px base gaps; 1px borders; 12–16px panel radius; 999px primary buttons. No heavy shadows, no gradients except a static radial accent glow behind hero artifacts.

Motion: scroll reveal opacity + 12px translate over 500ms, once; hover border/background 150–250ms; artifact scale 0.98→1 over 600ms. No bounce, no infinite loops, no scroll-jacking. Respect reduced motion.

Status vocabulary remains `PASS`, `FAIL`, `DRIFT`, `UNVERIFIED`, plus `CAPPED`, `SAMPLE`, `HARNESS`, `DEGRADED`, `REDACTED`. Text labels always accompany colour.

## 3. Page inventory

### 3.1 `/` — marketing landing

Sections (all substantive, per `LANDING_REFERENCE_NOTES.md`):

1. Header: wordmark, Benchmarks, Leaderboard, Docs, GitHub, `Open app` pill.
2. Hero: hackathon badge, H1 “Benchmark the agent, not just the model.”, two-sentence subtext, `View leaderboard` + `Read the docs`, four pills (Deterministic · Model-agnostic · Failure attribution · Reproducible), real result/attribution artifact, three assurance chips.
3. `\ THE PROBLEM \ \ 01 \`: “A trace tells you what happened. It does not tell you why.” Five-layer hand-off diagram; three named pains; closing line.
4. `\ THE SOLUTION \ \ 02 \`: three pillars (deterministic scoring, counterfactual attribution, reproducibility) + embedded attribution card.
5. `\ HOW IT WORKS \ \ 03 \`: five numbered steps (Spec, Run, Score, Attribute, Replay), each with a real UI crop.
6. `\ MEASUREMENT \ \ 04 \`: six metric cards + three chaos modes + pass@k; note that metrics are the substrate.
7. `\ LEADERBOARD \ \ 05 \`: four real rows, score mean±std, pass@k, reliability stacked bar; `View full leaderboard →`.
8. `\ ATTRIBUTION \ \ 06 \`: real result snippet, evidence + proof line (`47.3 → 89.1`), `View proof →`.
9. `\ FOR DEVELOPERS \ \ 07 \`: terminal block with `orivoxx bench`, `orivoxx replay`, `orivoxx diff`; copy control.
10. `\ RESOURCES \ \ 08 \`: docs, GitHub, build log.
11. FAQ: 6 honest items.
12. Closing CTA: “Benchmark the agent. Prove the failure.” + tagline.
13. Footer.

### 3.2 `/app` — app home

Per `docs/APP_HOME_REFERENCE_NOTES.md`:

1. Orientation header: eyebrow, H1, one paragraph, status stats (tasks, adapters, results, attributed runs, pass rate), four quick actions.
2. Leaderboard snapshot: 4 rows with reliability bars; `View full leaderboard →`.
3. Task catalogue snapshot: 3 cards with version, difficulty, requirement count, passThreshold, best score.
4. Recent runs: last 5 rows with adapter, task, model, score, exit reason, attribution cell, timestamp.
5. How attribution works: baseline → intervention at k → replay → PASS diagram; link to a real proof.
6. Quick start / CLI: three commands + terminal output, copy.
7. Chaos modes: three cards + `Run with chaos` actions + reliability definition.
8. Footer.

No heading-only sections. Real store data or explicit empty states.

### 3.3 `/benchmarks`

Catalogue with id, title, version triple, difficulty, requirement count, passThreshold, best score. Cards link to detail. One paragraph on version immutability.

### 3.4 `/benchmarks/[task]`

Header + version strip; requirement table (id, title, severity, bench, check); starting files; spec; adapters; task leaderboard; `Run baseline` and `Run with chaos` actions.

### 3.5 `/submit`

Task select, adapter select (fake self-serve; organizer adapters labelled disabled), fixture variant or chaos mode, disclosure of what executes. Fake run is synchronous; organizer runs are documented. No arbitrary command field.

### 3.6 `/results/[id]`

Above the fold:
- Breadcrumb, ids, adapter/model/run status, chaos chip, created time.
- Artifact score + cap banner + three bench bars.
- **Six-metric table**: steps, tool calls, tool error rate, tokens, cost, duration, plus exit reason and pass@k context.
- Version strip.

Middle:
- **Attribution card**: layer × mode, evidence list with step indices, confidence, proof summary (`baseline → counterfactual`, intervention at step k), `View proof →`; or `unattributed` with reason.
- Trace viewer: step-indexed timeline, collapsible groups, redacted chips, tool status, token/cost per model call; link to full trace.
- Requirement list (expandable evidence) and produced-code diff.

Footer: reproducibility note.

### 3.7 `/results/[id]/trace`

Full-width timeline: sticky step rail, event cards, filters (model/tool/error/chaos), summary header with totals. Every content-bearing field is a summary, labelled `redacted`.

### 3.8 `/replay/[id]`

- Header: baseline vs counterfactual scores, pass/fail delta, intervention summary, passThreshold.
- Side-by-side step lists with the divergence point highlighted; steps before k marked identical.
- Proof metadata: replayed steps, deterministic scoring note.
- “Run another intervention” select over stored candidates; if none, disabled with reason.
- No live model call.

### 3.9 `/leaderboard`

Columns: rank, adapter, task, model, artifact score mean±std, pass@k, steps, tool calls, tool error rate, tokens, cost, duration, reliability stacked bar (layer distribution), trend, chaos filter. Task/model/chaos filters; baselines toggle. Sorting total and stable.

### 3.10 `/compare`

Two results: metric deltas, trace diff of first N steps with divergence, attribution diff (`python: harness × recovery × 3; aider: …`), scores. Read-only.

### 3.11 `/docs`, `/privacy`, `/404`

Docs sidebar/breadcrumb/search with new Attribution, Replay & proof, Reliability, Metrics & traces, Resilience pages. Privacy updated for trace/action handling. 404 uses product shell.

## 4. States

| State | Surface | Rule |
|---|---|---|
| Empty | leaderboard, app home, compare | Explain missing data, link to a next action |
| Degraded | leaderboard/result | `DEGRADED` chip + fallback store |
| Unavailable | attribution/replay | `trace_unavailable` / `no_sufficient_intervention`; never guess |
| Capped | result | Banner above score |
| Redacted | trace | Chip on every summarized field |
| Truncated | trace/diff | Notice with budget |
| Error | submit | Fixed envelope with request id |

## 5. Accessibility and responsive

- Keyboard: all rows/cards focusable; trace steps toggle with Enter/Space; visible 2px accent focus.
- Tables use real `<table>`, `<th scope>`, captions.
- Status is text + colour; charts/bars have `aria-label` with numbers.
- Diff/trace rendered as escaped text, never HTML.
- ≥1024: two-column result; 768–1023: single column; <768: stacked cards, horizontal-scroll tables with sticky identifiers.
- Touch targets ≥ 40px; reduced-motion respected.

## 6. Non-goals

- No chat interface.
- No model-generated score or verdict.
- No trace data that includes raw source, prompts, or secrets.
- No light theme.
- No pricing, careers, blog, or CMS pages without real content.
