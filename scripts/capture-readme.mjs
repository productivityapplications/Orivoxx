/**
 * Captures the README screenshots against a local production build.
 *
 *   pnpm --filter web build
 *   pnpm --filter web exec next start --port 3101
 *   node scripts/capture-readme.mjs
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";

const base = process.env.SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3101";
const out = new URL("../docs/screenshots/", import.meta.url);

const pages = [
  ["01-landing.png", "/", 1440, 1100],
  ["02-app.png", "/app", 1440, 1300],
  ["03-tasks.png", "/tasks", 1440, 1200],
  ["04-leaderboard.png", "/leaderboard", 1440, 1200],
  ["05-result-pass.png", "/results/res_85394cc5a29a4c89b0f7613e229ebd99", 1440, 1600],
  ["06-attribution-failure.png", "/results/res_c1ba8d7b435e4ae6b514138458fab8b7", 1440, 1800],
  ["07-replay-proof.png", "/replay/res_c1ba8d7b435e4ae6b514138458fab8b7", 1440, 1200],
  ["08-community-task.png", "/tasks/is-hexadecimal-50b2060e", 1440, 1600],
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
  deviceScaleFactor: 1,
});

for (const [name, path, width, height] of pages) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: fileURLToPath(new URL(name, out)), fullPage: true });
  console.log(name, await page.title());
  await page.close();
}

await browser.close();
