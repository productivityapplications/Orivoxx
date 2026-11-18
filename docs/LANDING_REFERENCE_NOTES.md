# Landing page reference — Pass `/`

Studied 18 November 2026 at <https://pass-web-dun.vercel.app/>. Screenshot and DOM captured with Playwright. The reference is a marketing landing page that sits in front of the app; Orivoxx needs the same separation.

## 1. Narrative arc (observed)

| Beat | Section | Job | Evidence |
|---|---|---|---|
| 0 | Header | Product identity + persistent CTA | Wordmark, five nav links, `Launch App` pill |
| 1 | Hero | Thesis + proof object + two actions | Badge `LIVE ON HYPERLIQUID MAINNET`, H1 “See a trade. Know the trader. Take the trade.”, subtext, two CTAs, specimen BTC plan card, three trust pills |
| 2 | Loop strip | Compress the mechanism into one line | 01 X post → 02 PASS link → 03 NEAR intent → 04 Your signature → 05 HL fill |
| 3 | Problem | Name the pain with a mechanism | `\ THE PROBLEM \ \ 01 \`, “Alpha is social. Execution is not.”, five hand-offs with time/custody labels, then three failure cards |
| 4 | Solution | Three load-bearing pillars | `\ THE SOLUTION \ \ 02 \`, “One layer. Zero hand-offs.”, three numbered rows + an intent route card |
| 5 | How it works | Three moves, each with a UI fragment | `\ HOW IT WORKS \ \ 03 \`, Discover / Fund / Execute cards |
| 6 | Features | Four infrastructure pieces | `\ FEATURES \ \ 04 \`, 2×2 cards, each with a mono footer label |
| 7 | Closing CTA | One action, no new information | “The trade is one link away.” + `Launch App` + `Read the docs` |
| 8 | Footer | Docs, developers, GitHub, legal | Four columns + disclaimer |

## 2. Density pattern

- Page height ~5,397 px at 1440×1000 (≈5.4 viewports), 7 major sections below the header.
- Hero: 1 H1 (98 px), 2-sentence subtext (~30 words), 2 CTAs, 1 specimen artifact, 3 pills.
- Each narrative section: mono eyebrow + section number, 2–5-word-per-line H2 (50 px), 1 short paragraph (2–4 lines), and one of: a mechanism diagram, three numbered rows, three cards, or four cards.
- Copy per section: 50–120 words. No section is a heading plus a button.
- Every section ends with an action or a concrete artifact.
- The page alternates split layouts (text + artifact) and full-width card grids; it does not repeat the same block shape three times in a row.
- Type: Archivo 98/96 px 700 for H1, 50/53 px for H2, `-3.9 px` / `-1.5 px` tracking; Inter Tight 15 px body; mono uppercase eyebrows.
- Colour: `#0A0A0A` background, `#F5F1EA` text, `#F03A1C` accent, 1 px borders, 4 px control radius.
- Motion: section fade/translate on scroll, product artifact scale-in, hover lift; no scroll-jacking.

## 3. What we adopt for Orivoxx `/`

The landing page must be a complete marketing surface, not the app shell with a hero. The app moves to `/app`.

### Section plan

1. **Header**
   - Wordmark + `Benchmarks`, `Leaderboard`, `Docs`, `GitHub`; primary `Open app` pill.
   - Sticky, 1 px border, condensed on scroll.

2. **Hero**
   - Badge: `HackCulture Global AI Hackathon — Benchmarking track`.
   - H1: “Benchmark the agent, not just the model.”
   - Subtext: two sentences on deterministic scoring + counterfactual attribution.
   - Two CTAs: `View leaderboard` (primary), `Read the docs` (secondary).
   - Four feature pills: Deterministic · Model-agnostic · Failure attribution · Reproducible.
   - Real product artifact: the result/attribution card or leaderboard snippet, not a mock.
   - Three assurance chips: `No LLM in the score`, `Sandboxed execution`, `Every failure has a proof`.

3. **The problem**
   - `\ THE PROBLEM \ \ 01 \`
   - H2: “A trace tells you what happened. It does not tell you why.”
   - Mechanism diagram: five hand-offs — spec → model → harness → tool → environment — with “signal lost” markers.
   - Three named pains: model blamed for harness bugs; tool failures look like reasoning failures; no way to test a fix without re-running everything.
   - Closing line: “Every failure is a guess.”

4. **The solution**
   - `\ THE SOLUTION \ \ 02 \`
   - H2: “A deterministic benchmark with an attribution layer.”
   - Three pillar cards, each with a mono index, title, 2–3 lines, and a footer label:
     - Deterministic scoring — no LLM in the loop.
     - Counterfactual attribution — layer × mode + replay proof.
     - Reproducibility — versioned tasks and byte-identical replay.
   - A small “attribution card” artifact embedded beside the cards.

5. **How it works**
   - `\ HOW IT WORKS \ \ 03 \`
   - Five numbered steps: 01 Spec, 02 Run, 03 Score, 04 Attribute, 05 Replay.
   - Each step has a real UI crop or a compact component: spec version strip, trace timeline, scorecard, attribution card, replay diff.
   - One sentence per step, no more than 25 words.

6. **What Orivoxx measures**
   - `\ MEASUREMENT \ \ 04 \`
   - Six metric cards: artifact score, steps, tool calls, tokens, cost, duration; plus pass@k.
   - Three chaos modes: tool error, latency, context pressure.
   - A note that these are the track's substrate and attribution is the layer above.

7. **Leaderboard preview**
   - `\ LEADERBOARD \ \ 05 \`
   - Four real rows with adapter, task, model, score mean±std, pass@k, reliability stacked bar.
   - `View full leaderboard →`.

8. **Attribution preview**
   - `\ ATTRIBUTION \ \ 06 \`
   - One real result: “Attributed: harness × recovery”, evidence line, proof line `47.3 → 89.1`, `View proof →`.
   - Sits next to a compact replay timeline.

9. **For developers**
   - `\ FOR DEVELOPERS \ \ 07 \`
   - Terminal block with `orivoxx bench`, `orivoxx replay`, `orivoxx diff`.
   - Three commands, real output lines; copy button.
   - Link to the adapter guide.

10. **Docs / resources**
    - Three cards: In-app docs, GitHub, Build log / method.
    - One line each.

11. **FAQ**
    - Six honest questions: Is this another trace viewer? How is attribution verified? Does it work with any framework? What is deterministic? What happens when the model provider is down? What can't it attribute?

12. **Closing CTA**
    - H2: “Benchmark the agent. Prove the failure.”
    - `Try the benchmark` → `/app`; `Read the docs` → `/docs`.
    - One line: open source, MIT.

13. **Footer**
    - Docs, GitHub, privacy, license, version.

### Rules

- No thin sections. Each has at least 50 words of real copy or a real artifact.
- Screenshots are Playwright captures of the running app, never mocks.
- The tagline stays exactly “Benchmark the agent, not just the model.”
- The landing does not expose operational controls; the app lives at `/app`.

## 4. What we do not adopt

- Pass's trading vocabulary, red-orange palette, Archivo display, or 98 px hero.
- The literal five-step NEAR intent strip; Orivoxx's five steps are spec → run → score → attribute → replay.
- Any copy, logo, or testimonial from Pass.
- A pricing section. Orivoxx is free and open source in this build.
