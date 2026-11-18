# App home reference — Pass `/app`

Studied 18 November 2026 at <https://pass-web-dun.vercel.app/app>. Screenshot and DOM text captured with Playwright. Pass is a trading product; Orivoxx is a benchmark platform. We borrow the **orientation surface pattern**, not the domain.

## 1. Section structure (observed)

| Order | Section | Why it exists | Artifacts embedded |
|---|---|---|---|
| Hero | “See a trade. Know the trader. Take the trade.” + subtext + two CTAs + three assurance pills | States the product in one sentence and gives two immediate actions | Phone mock with a live trade plan, trader identity, “authorize” button |
| Strip | `THE LOOP` 01 X post → 02 Pass → 03 trader context → 04 trade plan → 05 Hyperliquid | Compresses the whole value chain into one glance | Five numbered nodes on a line |
| 01 | “The traders worth following.” | Proves the supply side exists | Four trader cards: win rate, PnL, passes, closed, profile action; fifth “be a trader” card |
| 02 | “The tape, as it happens.” | Proves the market is live | Table of 8 recent executions and publications, relative timestamps, outcome chips, links |
| 03 | “A plan is not a promise.” | Teaches the core object and the user’s four-step workflow | Four numbered cards, each with a concrete UI fragment: plan card, entry/stop values, size selector, signer chip |
| 04 | “Built for your own hands.” | Answers the trust objection | 2×2 cards with a mono label and one load-bearing sentence each |
| 05 | “Your keys. Your funds.” + “Build on the execution layer.” | Separates user safety from developer extensibility | Four-row permission table (keys/funds/agent key/withdrawals) + Agent API card with scoped permissions |
| 06 | “Ready to trade like a pro?” | Final action | Two CTAs + secondary links |
| Footer | Product, docs, social, legal | Completeness | Multi-column links and risk disclaimer |

## 2. How the page balances orientation and action

- **Orientation:** the hero, the five-node loop, and sections 03–05 explain what the product is, how it works, and why it is safe. A first-time visitor can stop after section 04 and understand the product.
- **Action:** every section ends with a concrete control: `View all →`, `View Profile →`, `Create a Pass →`, `Open developer settings →`, `Explore traders →`.
- **Density:** six substantive sections below the hero, not counting the strip and footer. The page is ~6,000 px tall at 1440×1000.
- **Numbered headers:** each section begins with a mono eyebrow in the form `\ TOP TRADERS \` plus `\ 01 \`. The number is small and quiet; the section title is a 40–50 px grotesk heading.
- **Embedded product artifacts:** the page *shows* the product in every section — plan cards, tables, size selector, signer chip, permission table. It never asks the reader to imagine the UI.
- **Honesty devices:** “A plan is not a promise”, “PASS never holds funds”, “No hidden moves”. The copy names the risk before the feature.
- **Density pattern:** a section = label + 2–4 line heading + 2–4 line paragraph + one artifact + one action. Nothing is a heading alone.
- **Visual system:** near-black `#0A0A0A`, off-white `#F5F1EA`, red-orange accent `#F03A1C`, 1px borders, 4 px control radius, Archivo 98 px hero / 50 px section headings, Inter Tight 15 px body, mono labels.

## 3. What we adopt for Orivoxx `/app`

The app home must answer “what is this, what is the state, and what do I do now?” in that order, with real artifacts.

### Section plan

1. **Orientation header**
   - Eyebrow `\ BENCHMARK CONTROL ROOM \`
   - H1: “Benchmark the agent. Attribute the failure.”
   - One paragraph: versioned tasks, sandboxed runs, deterministic score, counterfactual attribution.
   - Status row: tasks, adapters, results recorded, attributed runs, pass rate.
   - Quick actions: `Run the baseline`, `Browse tasks`, `Open leaderboard`, `Read the method`.

2. **Leaderboard snapshot**
   - Top 4 rows: adapter, task, model, score mean±std, pass@k, reliability stacked bar.
   - Mono column headers and a `View full leaderboard →` action.
   - Real data from the store; no mock rows.

3. **Task catalogue snapshot**
   - 3 task cards: id, version, difficulty, requirement count, passThreshold, best score.
   - `Browse all tasks →`.

4. **Recent runs**
   - Table of the last 5 runs: adapter, task, model, score, exit reason, attribution cell (`harness × recovery`), timestamp.
   - Row click → `/results/[id]`.
   - Empty state with a fake-baseline CTA.

5. **How attribution works**
   - A compact three-column diagram: `baseline trace` → `intervention at step k` → `replay 35–58` → `PASS 89.1`.
   - One sentence on why replay is byte-identical before step k.
   - Link to a real attributed result and its proof.

6. **Quick start / CLI**
   - Three commands with copy buttons: `orivoxx bench`, `orivoxx replay`, `orivoxx diff`.
   - A four-line terminal block showing a run and an attribution line.

7. **Chaos modes**
   - Three cards: `tool_error`, `latency`, `context_pressure`; one-line description and a `Run with chaos` action.
   - The reliability score is defined here: pass@k across the four conditions.

8. **Footer**
   - Docs, GitHub, privacy, license, version.

### Rules

- Every section has an artifact: table, card, diagram, or terminal. No heading-only sections.
- Numbers come from the result store; if there is no data, show an explicit empty state.
- The app home never calls a model. Attribution is deterministic.
- No marketing-only sections inside `/app`; the marketing story lives at `/`.
- The hero must not repeat the landing hero verbatim. It is an operational orientation header, not a sales pitch.

## 4. What we do not adopt

- Pass's red-orange trading accent and Archivo display. Orivoxx uses the Coderia-derived warm near-black, emerald accent, and Instrument Serif.
- Fake phone frames or a specimen plan. Orivoxx embeds real tables and traces.
- Trading vocabulary, PnL, win-rate framing, or “follow a trader” mechanics.
- Any copy, logo, or layout pixel-copy from Pass.
