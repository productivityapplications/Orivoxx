/**
 * Captures the README screenshots from a running production build.
 *
 *   SHOT_BASE_URL=http://127.0.0.1:3101 node scripts/screenshots.mjs
 *
 * Every image is a real page from the store; nothing is mocked or composited.
 */
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "..", "..", "..", "docs", "assets", "screens");
const base = process.env.SHOT_BASE_URL ?? "http://127.0.0.1:3101";

await mkdir(output, { recursive: true });

const leaderboard = await fetch(`${base}/api/v1/leaderboard?limit=100`).then((response) =>
  response.json(),
);
const entries = Array.isArray(leaderboard.entries) ? leaderboard.entries : [];
const all = await fetch(`${base}/api/v1/leaderboard?limit=100&kind=all`).then((response) =>
  response.json(),
);
const harness =
  entries.find(
    (entry) =>
      entry.adapter.id === "python-openrouter" && entry.model?.name === "openai/gpt-4o-mini",
  ) ?? entries.find((entry) => entry.adapter.kind === "harness");
const capped =
  (Array.isArray(all.entries) ? all.entries : []).find(
    (entry) => entry.capsApplied?.length > 0,
  );

if (harness === undefined) {
  throw new Error("No harness result is available for screenshots.");
}

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  colorScheme: "dark",
  deviceScaleFactor: 1,
});

async function visit(path, file, options = {}) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  if (options.locator !== undefined) {
    const target = page.locator(options.locator).first();
    await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: resolve(output, file) });
  } else {
    await page.screenshot({ path: resolve(output, file), fullPage: options.fullPage ?? false });
  }

  console.log(file);
}

await visit("/", "home.png");
await visit("/benchmarks", "benchmarks.png");
await visit("/benchmarks/taskboard", "task.png", {
  locator: 'section[aria-labelledby="requirements-heading"]',
});
await visit("/submit", "submit.png");
await visit("/leaderboard", "leaderboard.png");
await visit("/compare?task=taskboard", "compare.png");
await visit(`/results/${harness.resultId}`, "result-scorecard.png");
await visit(`/results/${harness.resultId}`, "result-explorer.png", {
  locator: 'section[aria-labelledby="requirements-heading"]',
});
if (capped !== undefined) {
  await visit(`/results/${capped.resultId}`, "result-capped.png");
}

await browser.close();
