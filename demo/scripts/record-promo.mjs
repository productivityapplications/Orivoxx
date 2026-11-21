/**
 * Records the hidden /promo route in one 1920x1080 take.
 *
 *   SHOT_BASE_URL=http://127.0.0.1:3101 node demo/scripts/record-promo.mjs
 */
import { mkdir, readFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const requireFromWeb = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = requireFromWeb("@playwright/test");

const here = dirname(fileURLToPath(import.meta.url));
const recordings = resolve(here, "..", "recordings");
const base = process.env.SHOT_BASE_URL ?? "http://127.0.0.1:3101";
const timeline = JSON.parse(
  await readFile(resolve(recordings, "promo-timeline.json"), "utf8"),
);

await mkdir(recordings, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: recordings, size: { width: 1920, height: 1080 } },
  colorScheme: "dark",
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const video = page.video();

await page.goto(`${base}/promo`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(2200);

await page.locator("#promo-play").click({ force: true });
console.log("play clicked; recording", timeline.totalSeconds, "seconds");

await page.waitForTimeout((timeline.totalSeconds + 2.5) * 1000);

await context.close();
if (video === null) throw new Error("no promo recording");
await rename(await video.path(), resolve(recordings, "promo-raw.webm"));
await browser.close();
console.log("promo-raw.webm saved");
