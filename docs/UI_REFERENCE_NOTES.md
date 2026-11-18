# UI reference — Coderia (Framer template)

Studied 18 November 2026 from <https://www.framer.com/marketplace/templates/coderia/> and its live preview <https://coderia.framer.ai/>. Screenshots and computed styles were captured with Playwright; no Coderia copy or assets are reused.

## 1. What Coderia is

An animated multi-page Framer template for AI coding-agent platforms, developer tools, and code-automation SaaS. The live preview is **dark mode, developer-first, and page-complete**: hero with an interactive product demo, alternating feature narratives, card grids, integrations, testimonials, pricing, FAQ, CTA, and a full footer. The marketplace listing advertises 17 pages (Home, About, Careers CMS, Contact, Blog CMS, Downloads, Changelog CMS, Integrations CMS, Waitlist, Legal CMS, 17-page pitch deck, 404) plus Home sections: hero + interactive demo, 2-column features, 4-item feature list, integrations, testimonials, pricing, CTA.

The useful lesson is not one screen. It is that a credible developer product has **a complete surface area** and a consistent visual grammar across it.

## 2. Dark-mode token palette (measured and inferred)

Computed on the live preview:

| Role | Value | Evidence |
|---|---|---|
| Page background | `#0B0B09` (`rgb(11,11,9)`) | `body` background |
| Primary text | `#E1E1DB` (`rgb(225,225,219)`) | display headings |
| Surface | `#111110` / `#151513` | cards, product window |
| Raised surface | `#1A1A17` | hovered rows, chips |
| Inset / terminal | `#0E0E0C` | code and terminal blocks |
| Border subtle | `#262622` | 1px card and divider lines |
| Border strong | `#3A3A34` | focus and hover outlines |
| Muted text | `#8C8C85` | labels, captions, metadata |
| Accent | `#17CF97` | primary buttons (`rgba(23,207,151,0.4)` fill), status, glow |
| Accent hover | `#22E3A8` | inferred from the same hue family |
| Warning | `#F3C66D` | status only |
| Danger | `#FF5C5C` | status only |
| Success | `#17CF97` | same as accent |

The palette is **warm near-black + off-white typography + one saturated green**. There is no blue-grey cast. Surfaces are separated by 1px borders and a 4–6% lightness step, not by shadow.

## 3. Typography hierarchy (measured)

| Level | Family | Size / line-height | Weight / tracking | Use |
|---|---|---|---|---|
| Display / hero | Instrument Serif | 70 / 77 px | 400, −2.8 px | One sentence, sentence case, 2–3 lines max |
| H2 / section | Instrument Serif | 60 / 66 px | 400, −2.4 px | Section thesis, 2–5 words per line |
| H3 / card title | Geist | 16 / 24 px | 500 | Card headings |
| Body | Geist | 14–16 / 22–26 px | 400 | Supporting paragraphs, max ~62 ch |
| Label / eyebrow | Geist Mono | 11–12 px, uppercase | 500, 0.08–0.12 em | `\ 01 \`, `THE PROBLEM`, `LIVE ON …` |
| Button | Geist | 13–14 px | 500 | Pill controls |
| Caption / meta | Geist | 11–12 px | 400, muted | Timestamps, counts, footnotes |

The serif display against a geometric sans body is the signature. It reads editorial and confident without gradients or 3D.

## 4. Layout and rhythm

- **Max content width:** 1200–1280 px. Text columns max 560–640 px.
- **Page gutters:** 24 px mobile, 40–64 px desktop.
- **Section padding:** 90 px top and bottom on standard sections; hero 120 px top / 60 px bottom (measured).
- **Grid:** 12 columns; feature narratives are 5/7 or 6/6 splits; card grids are 3-up or 4-up with 16–24 px gaps.
- **Vertical rhythm:** 8 px base; headings sit 16–24 px above body; section labels sit 32–48 px above the H2.
- **Borders:** 1px `#262622` on every card; 12–16 px radius on panels; 999 px radius on buttons and chips.
- **Density:** long pages with generous whitespace, but no section is only a heading. Each has a paragraph, a list, a card set, or a product window.
- **Product windows:** the hero embeds a large, detailed app screenshot with window chrome; later sections alternate text and product imagery.

## 5. Motion tendencies

From the live page and template description:

- Scroll-triggered **fade + 12–20 px translate** on section entry; 400–600 ms, ease-out, once.
- Text reveals by line or word mask on the hero; 600–900 ms.
- Product windows **scale from 0.98 → 1** with opacity; 500–700 ms.
- Hover: border lightens, background lifts one step, accent glow at 20–30% opacity; 150–250 ms.
- No bounce, no spring overshoot, no infinite decorative loops.
- Background glow and concentric rings are CSS/SVG, static except for a slow opacity pulse (8–12 s).
- Pricing/FAQ interactivity is state-based; no scroll-jacking.

## 6. Page-completeness inventory (what Coderia teaches)

- Header: wordmark, 5–7 nav links, 1 secondary link, 1 filled CTA.
- Hero: announcement pill, one big thesis, a concrete subtext, two CTAs, one detailed product window.
- Alternating feature narratives: label, H2, paragraph, 3–4 bullets, product crop.
- Card grids: 3–4 cards with mono index, title, body, small footer label.
- Integrations: logo chips with names, not bare icons.
- Testimonials: 6 cards, name + role + quote.
- Pricing: 3 tiers with a clear recommended tier.
- FAQ: 6–8 accordion items with real answers.
- Closing CTA: one line, one button, no new information.
- Footer: newsletter, 4 link columns, legal line, social.

## 7. What we adopt

1. **Warm near-black + off-white + one emerald accent.** Orivoxx moves from blue-violet to `#0B0B09` / `#E1E1DB` / `#17CF97`, keeping the existing status tokens for pass/fail/unverified.
2. **Serif display + Geist body.** Instrument Serif for page and section headlines; Geist for UI, Geist Mono for labels, IDs, and numbers.
3. **90 px section rhythm and 1280 px max width.** The landing and `/app` use the same vertical scale.
4. **Pill primary buttons, 1px bordered cards, 12–16 px panel radius.** No heavy shadows.
5. **One detailed real product window in the hero.** We screenshot the actual leaderboard/result, not a mock.
6. **Full page inventory.** Marketing landing, app home, catalogue, detail, submit, result, trace, replay, leaderboard, compare, docs, privacy, 404.
7. **Restrained scroll reveal**: opacity + 12 px translate, 500 ms, once; hover border/glow only.

## 8. What we adapt

- Coderia sells an AI coding agent; Orivoxx benchmarks agents. The hero thesis and section copy are about attribution and reproducibility, never code generation.
- Coderia shows a fake IDE and agent thread. Orivoxx shows real scorecards, traces, attribution cards, and replay diffs.
- Coderia's green is a brand accent. Orivoxx also uses green for `PASS`, so the accent and semantic pass colour are deliberately close; `FAIL`, `DRIFT`, and `UNVERIFIED` remain distinct.
- Coderia's page list includes Careers, Blog, Changelog, Waitlist, and a 17-page pitch deck. Orivoxx ships only pages it can populate with real content; no empty CMS pages or lorem.
- Coderia's display serif is Instrument Serif. Orivoxx uses the same family through `next/font` but at smaller sizes (48–64 px) because the product is denser and more technical.

## 9. Non-goals

- No literal Coderia copy, screenshots, logo, or feature names.
- No fake interactive demo that cannot run.
- No gradient-heavy “AI startup” hero, no 3D glass, no floating orbs beyond the restrained grid/glow.
- No light theme.
