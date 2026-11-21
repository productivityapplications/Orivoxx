/**
 * Records the five raw UI clips used by the /promo browser mockup.
 *
 *   SHOT_BASE_URL=http://127.0.0.1:3101 node demo/scripts/record-raw-clips.mjs
 */
import { mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const requireFromWeb = createRequire(new URL("../../apps/web/package.json", import.meta.url));
const { chromium } = requireFromWeb("@playwright/test");

const here = dirname(fileURLToPath(import.meta.url));
const recordings = resolve(here, "..", "recordings");
const base = process.env.SHOT_BASE_URL ?? "http://127.0.0.1:3101";

const PROOF = "res_c1ba8d7b435e4ae6b514138458fab8b7";
const CLAUDE = "res_85394cc5a29a4c89b0f7613e229ebd99";
const COMMUNITY = "is-decimal-800937e9";

await mkdir(recordings, { recursive: true });

const browser = await chromium.launch();

async function scroll(page, pixels, steps = 30) {
  for (let index = 0; index < steps; index += 1) {
    await page.mouse.wheel(0, pixels / steps);
    await page.waitForTimeout(24);
  }
}

async function record(name, seconds, perform) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: recordings, size: { width: 1920, height: 1080 } },
    colorScheme: "dark",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const video = page.video();
  const started = Date.now();

  await perform(page);

  const elapsed = (Date.now() - started) / 1000;
  if (elapsed < seconds) await page.waitForTimeout((seconds - elapsed) * 1000);

  await context.close();
  if (video === null) throw new Error(`no video for ${name}`);
  await rename(await video.path(), resolve(recordings, `${name}.webm`));
  console.log(`${name}.webm ${seconds}s`);
}

async function open(page, path) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

await record("raw-01", 10, async (page) => {
  await open(page, "/tasks");
  await page.waitForTimeout(1400);
  await scroll(page, 420);
  await page.waitForTimeout(1800);
  await scroll(page, 360);
});

await record("raw-02", 12, async (page) => {
  await open(page, "/tasks/new");
  await page.locator('input[name="title"]').fill("Community: is-decimal guard");
  await page.locator('input[name="repoUrl"]').fill("https://github.com/wooorm/is-decimal");
  await page.locator('input[name="baseCommit"]').fill("edc9aaf05e07857a03654115cf5ae8bf9eb74b95");
  await page.locator('textarea[name="issueText"]').fill(
    "isDecimal('12') currently returns true because the implementation reads only the first code point. The API documents a single character or code point. Make multi-character strings return false without changing behavior for numbers or one-character strings.",
  );
  await page.locator('input[name="testCommand"]').fill(
    `node -e "import('./index.js').then(({isDecimal})=>process.exit(isDecimal('12')?1:0))"`,
  );
  await page.waitForTimeout(1500);
  await open(page, `/tasks/${COMMUNITY}`);
  await page.waitForTimeout(1800);
  await scroll(page, 460);
});

await record("raw-03", 12, async (page) => {
  await open(page, `/results/${CLAUDE}`);
  await page.waitForTimeout(1500);
  await scroll(page, 520);
  await page.waitForTimeout(1600);
  await scroll(page, 360);
});

await record("raw-04", 11, async (page) => {
  await open(page, `/results/${PROOF}`);
  await page.waitForTimeout(1300);
  await scroll(page, 680);
  await page.waitForTimeout(1600);
  await scroll(page, 160);
});

await record("raw-05", 11, async (page) => {
  await open(page, `/replay/${PROOF}`);
  await page.waitForTimeout(1800);
  await scroll(page, 420);
  await page.waitForTimeout(1600);
});

await browser.close();
console.log("raw clips complete");
