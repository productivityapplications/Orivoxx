/**
 * Captures README screenshots from the running production build.
 *   SHOT_BASE_URL=http://127.0.0.1:3101 node scripts/screenshots.mjs
 */
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "..", "..", "..", "docs", "assets", "screens");
const base = process.env.SHOT_BASE_URL ?? "http://127.0.0.1:3101";
const ATTRIBUTED = process.env.SHOT_RESULT ?? "res_64068a9c11d744aa8c0391efa0bc04a4";
const BASELINE = process.env.SHOT_BASELINE ?? "res_df4fc568db41468ba499223509bcdd7e";

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  colorScheme: "dark",
  deviceScaleFactor: 1,
});

async function visit(path, file, options = {}) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);

  if (options.locator !== undefined) {
    const target = page.locator(options.locator).first();
    await target.scrollIntoViewIfNeeded();
    await target.screenshot({ path: resolve(output, file) });
  } else {
    await page.screenshot({ path: resolve(output, file), fullPage: options.fullPage ?? false });
  }
  console.log(file);
}

await visit("/", "landing.png", { fullPage: true });
await visit("/app", "app.png", { fullPage: true });
await visit("/leaderboard", "leaderboard.png");
await visit("/benchmarks", "benchmarks.png", { fullPage: true });
await visit("/benchmarks/taskboard", "task.png", { locator: 'section[aria-labelledby="requirements-heading"]' });
await visit("/submit", "submit.png");
await visit(`/results/${ATTRIBUTED}`, "result-scorecard.png");
await visit(`/results/${ATTRIBUTED}`, "attribution.png", { locator: 'section[aria-label="Failure attribution"]' });
await visit(`/results/${ATTRIBUTED}/trace`, "trace.png");
await visit(`/replay/${ATTRIBUTED}`, "replay.png");
await visit(`/compare?task=taskboard&a=${BASELINE}&b=${ATTRIBUTED}`, "compare.png");
await visit("/docs/attribution", "docs-attribution.png");

await browser.close();
