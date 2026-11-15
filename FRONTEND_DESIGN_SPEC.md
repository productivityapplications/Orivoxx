> **Positioning update (15 November 2026):** This spec describes the verifier-era dark, map-first dashboard. The current web app is a landing shell plus a health endpoint; none of the workspace UI below is implemented. The spec remains a visual reference for the planned benchmark result explorer. It does not yet define a task catalogue or leaderboard.

# ORIVOXX — FRONTEND DESIGN SPECIFICATION

**Version:** 1.0 · **Status:** Approved design direction for hackathon MVP · **Updated:** 20 October 2026

This document is the visual and interaction source of truth for the Orivoxx frontend. The app is dark-only for the MVP. The live project workspace is map-first: when a verification starts, the central canvas displays the project's real dependency structure and highlights deviations where validated evidence locates them.

## 1. Design intent

Orivoxx should feel like a precise engineering instrument, not a generic chatbot dashboard. Use Linear as the primary reference for its restrained dark product UI and information hierarchy, GitHub code review as the reference for navigating line-level evidence, Sentry issue investigation as the reference for progressive disclosure, and the user-provided repository-map screenshot as the reference for an interactive dependency graph with an adjacent inspector panel. Borrow patterns rather than copying product-specific labels, icons, layouts pixel-for-pixel, or visual assets.

Reference links:

- Linear: https://linear.app/
- GitHub pull request review: https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request
- Sentry: https://sentry.io/
- Graph composition: screenshot attached by the user in the Orivoxx design discussion (20 October 2026). This is a layout reference only; its sample data and branding are not Orivoxx assets.

### Design principles

1. **Map first, issue detail second.** The project map gives an immediate visual scan of where problems sit in the structure; selecting a node opens concrete evidence.
2. **Every red node has a reason.** A deviation color must be traceable to a finding and validated source reference. Never color a node based only on a model's ungrounded claim.
3. **Evidence before explanation.** Details and source references remain visible; teaching is one interaction away, not a replacement for proof.
4. **Compact, calm, technical.** Tight spacing and clear hierarchy; avoid oversized marketing gradients, excessive rounded cards, decorative charts, or chat-first layouts.
5. **Honest uncertainty.** PASS, FAIL, DRIFT, UNVERIFIED, IN PROGRESS and NOT ASSESSED are distinct labeled states; color never acts as the only signal.
6. **Dark on every screen.** No light-theme screen or theme toggle in the MVP, including landing, workspace, upload/consent, privacy, empty, error, and loading states.

## 2. Dark design tokens

Use these tokens centrally (CSS variables or Tailwind theme extension). Do not sprinkle one-off hex values through components.

| Token | Value | Use |
|---|---|---|
| `--bg-app` | `#0B0D10` | Main application background |
| `--bg-sidebar` | `#101319` | Navigation rail |
| `--bg-panel` | `#151922` | Main panel / inspector |
| `--bg-raised` | `#1B202A` | Menus, selected rows, raised surfaces |
| `--bg-canvas` | `#0D1117` | Map canvas |
| `--border-subtle` | `#282F3A` | Dividers and default borders |
| `--border-strong` | `#3A4351` | Focused or emphasized outlines |
| `--text-primary` | `#F2F4F8` | Primary text |
| `--text-secondary` | `#B0B8C5` | Supporting text |
| `--text-muted` | `#808A99` | Low-priority metadata only |
| `--accent` | `#A78BFA` | Primary action / selected tab |
| `--accent-secondary` | `#75A7FF` | Links and keyboard focus where appropriate |
| `--status-pass` | `#48C9A4` | Verified pass |
| `--status-fail` | `#FF5D6C` | Confirmed failure / deviation |
| `--status-drift` | `#FF7A86` | Architecture/specification drift |
| `--status-warning` | `#F3C66D` | Unverified, ambiguous or partial |
| `--status-progress` | `#9D8BFF` | In-progress state |
| `--status-neutral` | `#8792A2` | Not assessed / unsupported |

The palette is a starting token contract; contrast must be tested against actual component backgrounds. For text, use accessible combinations rather than using the full-strength status color as small body copy. Status indicators need a label or icon in addition to color.

### Typography and density

- UI font: Geist Sans (or the version already selected by the approved Next.js scaffold); code and paths: Geist Mono.
- Base UI text: 14px; secondary metadata: 12px with sufficient contrast; page title: 20–24px; compact section title: 13–15px semibold.
- Use a 4px spacing base. Common gaps: 4, 8, 12, 16, 20, 24, 32px.
- Default control height: 32px compact, 36px standard. Buttons and inputs use 6–8px radius; panels/cards use 8px; avoid pill shapes except status/filter chips.
- Thin borders and restrained elevation; surfaces are separated mainly by background and border, not heavy shadows.
- Code uses monospace, line numbers, stable source paths, syntax highlighting, and visible selected/flagged line backgrounds.

## 3. Application information architecture

### Routes and surfaces

- `/` — dark landing page. Explain Verify + Teach in one concise hero; primary CTA `Try TaskBoard demo`, secondary CTA `Upload project ZIP`; disclose that uploaded context is sent to Nebius Token Factory only after consent. Show a clearly labeled miniature *sample* map preview, not a simulated analysis of the user's project.
- `/workspace` — the main project workspace. After a sample or ZIP is loaded and verification starts, the central Project Map is the primary view. This is the screen the user should spend most of the demo in.
- Report/finding detail — represented in the workspace inspector and a findings-list mode. Do not force the user to leave the map for every finding.
- `/privacy` — readable dark page describing source processing, exclusions, provider sharing, retention, limitations, and consent.
- Shared overlays/states — ZIP upload and disclosure, run progress, provider unavailable/partial, invalid archive, empty project, map-too-large, no-findings, and confirmation/reset.

### Desktop workspace shell

Target desktop viewport: 1280×800 and larger.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ORIVOXX / TaskBoard   [Verification status] [Run again] [Export] [⋯]       │
├────────────────┬───────────────────────────────────────┬───────────────────┤
│ PROJECT RAIL   │ PROJECT MAP                            │ INSPECTOR         │
│                │ [Search] [Status filters] [Legend]     │ Details Insights  │
│ Requirements   │                                        │ Code              │
│                │   ┌────────┐      ┌────────┐            │                   │
│ Files          │   │ api.ts │ ───▶ │ auth.ts│            │ Selected node /   │
│                │   └────────┘      └────────┘            │ finding evidence  │
│ Upload / reset │         ┌────────────┐                  │                   │
│                │         │ tasks.ts   │                  │ Explain this      │
│                │         └────────────┘                  │ finding / code    │
└────────────────┴───────────────────────────────────────┴───────────────────┘
```

Widths: left rail 220–250px; right inspector 320–360px; map fills remaining width. Panels use subtle dividers. The map canvas owns the largest visual area. Top-level project gate and counts must be visible without scrolling.

### Inspector tabs

- **Details:** selected file/module identity, derived status, mapped findings, related requirement IDs, evidence summary, severity, evidence source (deterministic or semantic), confidence where applicable.
- **Insights:** user-triggered teaching explanation. Include `What it does`, `Why it matters`, `Concepts`, `Assumptions / caveats`, and source references. Default Beginner; allow Intermediate and Advanced. Do not call the model automatically just because a node was clicked.
- **Code:** read-only code excerpt with line numbers, validated selected range, flagged line highlights, copy path/action where safe. Code is always text, never rendered as HTML.

Selecting a finding from a badge or finding list opens Details focused on that finding and scrolls Code to its validated source range when selected. `Explain finding` switches to Insights and starts the user-requested teaching call. The teaching response must not mutate the verdict or node status.

## 4. Project dependency map — MVP behavior

### What the graph represents

- Nodes represent eligible source files and, when supported by parsed manifest data, directly imported declared packages. Directories group files visually when useful.
- Edges represent **statically observed relationships only**. In the MVP, parse JavaScript/TypeScript-family files (`.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, `.cts`) with the TypeScript parser; extract relative `import`, `export ... from`, literal `require`, and literal dynamic-import references whose targets can be resolved within the in-memory inventory. No uploaded file is executed.
- Bare imports may be represented as external package nodes only when they match a declared direct dependency in `package.json`. They are not source files. Package checks map to `package.json` when that is the validated evidence path.
- Do not invent edges using an LLM. Do not infer runtime call relationships or claim complete graph coverage. TypeScript path aliases and unresolved/unsupported imports are shown as a graph coverage warning unless a deterministic check establishes a concrete failure.
- The bundled TaskBoard graph is built from the fixture files using the same graph builder, not a fake screenshot.

### Status-to-node rules

A graph node is colored only when a validated requirement result/finding or deterministic graph analysis maps to that exact source path. Otherwise it is `NOT ASSESSED` (neutral), even if nearby files pass.

| Node status | Color | Meaning |
|---|---|---|
| `FAIL` | red `--status-fail` | Concrete requirement/check failure with evidence mapped to this file |
| `DRIFT` | coral-red `--status-drift` | Grounded conflict with an explicit requirement or architecture constraint |
| `UNVERIFIED` | amber `--status-warning` | Insufficient evidence, model/provider failure, or inconclusive result mapped to this file |
| `IN_PROGRESS` | violet `--status-progress` | Verification is currently processing this file/check |
| `PASS` | teal `--status-pass` | At least one applicable mapped requirement is verified, with no higher-priority status |
| `NOT ASSESSED` | neutral `--status-neutral` | No verified status can be attached to this node |

When multiple results map to a node, status priority is `FAIL` > `DRIFT` > `UNVERIFIED` > `IN_PROGRESS` > `PASS` > `NOT ASSESSED`. A node must show a status icon/label or count, not only a color. FAIL and DRIFT both visibly read as red deviations; their labels/icons keep the difference clear. An unmapped failure remains in the global findings list and a visible `Unmapped findings` section; never color an arbitrary node to make it appear localized.

### Map interactions

- Pan by dragging blank canvas; zoom with wheel/pinch and `+` / `−`; `Fit map` restores the complete visible graph; keyboard shortcuts must not steal focus from text inputs.
- Select a node to open the right inspector and emphasize its incoming/outgoing edges and immediate neighbors.
- Click a finding badge/count on a node to open the exact finding in Details and jump to Code evidence.
- Search files; filter by `All`, `Deviations`, `Unverified`, `Passing`, and `Not assessed`; allow toggling declared package nodes. Active filters are visible and one click clears them.
- Map legend is collapsible, matching the supplied visual reference. Controls have tooltips and accessible names.
- Keep the overall gate, total requirements, and counts of FAIL/DRIFT/UNVERIFIED visible while filters are active. Filtering never changes underlying verdict counts.
- All findings remain accessible in a list/table mode. A graph is a quick index, not the only way to discover problems.
- Initial verification state: show neutral nodes and visible progress; do not paint green/red status before evidence exists. If no supported imports exist, show the file inventory/tree fallback and an explanatory coverage note rather than an empty fake graph.
- Large projects: render at most 120 file/package nodes in the initial map view. Use directory grouping/filtering and show how many nodes are outside the current view. Never hide findings from the full findings list because of the map cap.

### Mobile workspace

Below 900px, collapse the left project rail into a menu; provide a `Map` / `Findings` switch; keep the top project gate and deviation counts fixed in the workspace header. The map supports pan/zoom but not forced desktop-style three columns. Inspector becomes a bottom sheet or full-screen drawer with Details / Insights / Code tabs. A list-based findings and file-navigation fallback must be usable without dragging a graph.

## 5. Page specifications

### Landing `/`

- Dark background, left-aligned headline, concise explanatory copy, primary `Try TaskBoard demo`, secondary `Upload project ZIP`.
- Include a miniature labeled sample project map with a few neutral/pass/red nodes to explain the concept. Clearly label this as illustrative/sample data; don't imply a real review has already run.
- Show three short steps: Load project → Verify against spec → Inspect deviations and learn.
- Show privacy/provider statement before upload begins. Footer has Privacy, repository and hackathon credits where applicable.
- Responsive layout stacks copy/CTAs before the sample map on mobile.

### Workspace `/workspace`

- Header: project name, current run state, overall gate, pass/fail/drift/unverified counts, rerun/reset/export actions.
- Default main view after a run starts/completes: Project Map. A `Findings` mode offers the same data as a keyboard-friendly table/list.
- Left rail: requirements by status and source-file tree/search; no redundant marketing cards.
- Right inspector: Details / Insights / Code tabs.
- Run progress indicates stages truthfully (`Reading project`, `Checking deterministic rules`, `Requesting semantic review`, `Building map`, `Ready`). Do not suggest an AI call is underway when it is not.

### Upload and consent

- Dark dialog/page with selected archive name/size, enforced limits, excluded-file categories, explicit source-sharing notice, and unchecked consent control.
- `Analyze project` remains disabled until validation and consent; file selection alone must not send source to the server/provider.
- Validation errors appear inline next to the relevant field; retain no unsafe file contents after a rejected request.

### Privacy `/privacy`

Use the shared dark shell, readable content width (680–760px), clear section headings, no walls of tiny text, and a concise summary at top. Content must match actual architecture and provider handling statements.

## 6. Shared components

- `AppShell`, `TopBar`, `ProjectRail`, `StatusPill`, `Metric`, `ProgressStepper`.
- `ProjectDependencyMap`, `MapToolbar`, `MapLegend`, `GraphNode`, `GraphEdge`, `GraphCoverageNotice`.
- `RequirementList`, `FindingList`, `FindingCard`, `EvidenceReference`, `SourceCodeViewer`, `InspectorTabs`, `ExplanationPanel`.
- `UploadDialog`, `ConsentDisclosure`, `InlineAlert`, `EmptyState`, `LoadingSkeleton`, `ProviderStatus`, `ExportMenu`, `ConfirmResetDialog`.

Use a consistent variant/state API instead of component-specific arbitrary colors. Build shared status components from domain status enums.

## 7. Chosen graph technology and boundaries

- Use `@xyflow/react` for the pannable/zoomable accessible graph canvas and `@dagrejs/dagre` for deterministic hierarchical layout.
- Use the existing `typescript` package parser APIs for static JS/TS-family import extraction; never transpile or execute uploaded source. If the supported import form cannot be resolved statically, record a warning.
- Graph builder is a pure function in `packages/core`, returning a Zod-validated `ProjectGraph` model with nodes `{ id, path, label, kind, externalPackage? }` and edges `{ id, source, target, relationship, evidencePath, line? }`. Do not include source contents in the graph payload.
- UI derives node status from validated report evidence paths. The graph builder itself does not decide compliance. Unknown paths/IDs from the model must never create nodes or edges.
- For node cap/layout, use deterministic selection/order so a repeatable source snapshot yields repeatable graph data. Keep hidden/condensed node counts explicit.

## 8. Accessibility, responsiveness and feedback

- WCAG AA contrast target; verify text and status colors against their actual backgrounds.
- Status must have text/icon in addition to color. Red deviation state must not depend on red alone.
- Entire workspace usable by keyboard: logical tab order, visible focus, node selection via keyboard, inspector reachable without dragging, `Escape` closes overlay, proper live-region announcement for verification completion/failure.
- Provide a text/list alternative for the graph with equivalent node status, relationships, and findings. Screen readers must not be forced to interpret a canvas alone.
- Respect `prefers-reduced-motion`; no animated edges as required information. Keep transitions short and subtle.
- Mobile controls at least 40px touch target where practical; don't rely on hover-only functionality.
- Loading, empty, partial, error, provider-down, no-imports, unsupported-syntax, and large-project states must be designed. Never show all-green placeholders while results are pending.

## 9. Frontend acceptance criteria

1. Every route/state uses the dark-only token system; no default light component leaks through.
2. Loading `/` clearly offers sample and upload, shows a *labeled illustrative map*, and communicates Verify + Teach.
3. Starting verification opens `/workspace` with neutral/in-progress map nodes, a truthful progress sequence, and no premature status claims.
4. Once report evidence arrives, the map shows real local import edges and red FAIL/DRIFT nodes only where evidence path mapping supports them.
5. Selecting a red node opens the inspector with linked finding, requirement ID, evidence location, and a direct route to Code/Insights.
6. PASS, FAIL, DRIFT, UNVERIFIED, IN_PROGRESS and NOT ASSESSED are visually/textually distinguishable; counts don't change when filtering.
7. Unmapped findings remain visible outside the map; a project with unsupported/no import edges falls back to file/finding lists with a coverage explanation.
8. The graph never claims runtime dependencies, test results, or complete coverage it has not measured.
9. All routes include relevant loading, empty, error and partial states; mobile provides map plus usable list fallback.
10. Keyboard and accessibility smoke tests cover node selection, filter controls, inspector tabs, upload consent, run progress announcements, and finding navigation.
11. No model call is made merely by clicking a graph node; Explain actions trigger separate, consented teaching calls.
12. Screenshot/demonstration should show the graph, at least one grounded red deviation, the detail/evidence inspector, and the teaching panel in dark mode.
