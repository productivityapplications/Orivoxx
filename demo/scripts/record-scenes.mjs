/**
 * Records one real screen video per demo scene.
 *
 *   SHOT_BASE_URL=http://127.0.0.1:3101 node demo/scripts/record-scenes.mjs
 *
 * Requires a running production build with the shared store configured.
 */
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createRequire } from "node:module";

import { SCENES } from "./narration.mjs";

const PROOF_ID = "res_c1ba8d7b435e4ae6b514138458fab8b7";
const CLAUDE_ID = "res_85394cc5a29a4c89b0f7613e229ebd99";
const COMMUNITY_TASK = "is-decimal-800937e9";

const requireFromWeb = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const { chromium } = requireFromWeb("@playwright/test");

const execFile = promisify(execFileCallback);
const here = dirname(fileURLToPath(import.meta.url));
const audioDirectory = resolve(here, "..", "audio");
const recordingDirectory = resolve(here, "..", "recordings");
const base = process.env.SHOT_BASE_URL ?? "http://127.0.0.1:3101";
const HOLD = 0.4;

if (process.env.ONLY === undefined) {
  await rm(recordingDirectory, { recursive: true, force: true });
}

await mkdir(recordingDirectory, { recursive: true });

async function durationOf(file) {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    resolve(audioDirectory, file),
  ]);

  return Number.parseFloat(stdout.trim());
}

const board = await fetch(`${base}/api/v1/leaderboard?limit=100&kind=all`).then((response) =>
  response.json(),
);

if (!board.entries?.some((entry) => entry.resultId === PROOF_ID)) {
  throw new Error("The stored chaos proof is missing; refusing to record an empty proof scene.");
}

const browser = await chromium.launch();

async function record(scene, perform) {
  const seconds = (await durationOf(scene.file)) + HOLD;
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: recordingDirectory, size: { width: 1920, height: 1080 } },
    colorScheme: "dark",
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const video = page.video();
  const started = Date.now();

  await perform(page, seconds);

  const elapsed = (Date.now() - started) / 1000;
  const remaining = seconds - elapsed;

  if (remaining > 0.2) {
    await page.waitForTimeout(remaining * 1000);
  }

  await context.close();

  if (video === null) {
    throw new Error(`No video for scene ${scene.id}`);
  }

  const path = await video.path();

  await rename(path, resolve(recordingDirectory, `scene-${scene.id}.webm`));
  console.log(`scene-${scene.id}.webm ${seconds.toFixed(2)}s`);
}

async function open(page, path) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
}

async function scrollToHeading(page, text, offset = 0) {
  await page.evaluate(
    ({ text: needle, offset: delta }) => {
      const heading = [...document.querySelectorAll("h1, h2, h3")].find((element) =>
        element.textContent?.toLowerCase().includes(needle.toLowerCase()),
      );

      if (heading != null) {
        const top = heading.getBoundingClientRect().top + window.scrollY - 140 + delta;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    },
    { text, offset },
  );
  await page.waitForTimeout(900);
}

async function fillTaskForm(page) {
  await page.locator('input[name="title"]').fill("Community: is-decimal guard");
  await page.locator('input[name="repoUrl"]').fill("https://github.com/wooorm/is-decimal");
  await page.locator('input[name="baseCommit"]').fill("edc9aaf05e07857a03654115cf5ae8bf9eb74b95");
  await page
    .locator('textarea[name="issueText"]')
    .fill(
      "isDecimal('12') currently returns true because the implementation reads only the first code point. The API documents a single character or code point. Make multi-character strings return false without changing behavior for numbers or one-character strings.",
    );
  await page
    .locator('input[name="testCommand"]')
    .fill(`node -e "import('./index.js').then(({isDecimal})=>process.exit(isDecimal('12')?1:0))"`);
  await page.waitForTimeout(900);
}

for (const scene of SCENES) {
  if (process.env.ONLY !== undefined && process.env.ONLY !== scene.id) {
    continue;
  }

  await record(scene, async (page, seconds) => {
    switch (scene.id) {
      case "01": {
        await open(page, "/");
        await page.waitForTimeout(seconds * 180);
        await scrollToHeading(page, "A trace tells you what happened");
        await page.waitForTimeout(seconds * 160);
        break;
      }
      case "02": {
        await open(page, "/app");
        await page.waitForTimeout(seconds * 150);
        await scrollToHeading(page, "One intervention");
        await page.waitForTimeout(seconds * 160);
        break;
      }
      case "03": {
        await open(page, "/app");
        await page.waitForTimeout(seconds * 100);
        await scrollToHeading(page, "Six metrics");
        await page.waitForTimeout(seconds * 120);
        await scrollToHeading(page, "Inject the fault");
        await page.waitForTimeout(seconds * 120);
        break;
      }
      case "04": {
        await open(page, "/tasks");
        await page.waitForTimeout(seconds * 140);
        await open(page, "/tasks/slugify-max-length");
        await page.waitForTimeout(seconds * 110);
        await open(page, `/results/${CLAUDE_ID}`);
        await page.waitForTimeout(seconds * 120);
        await scrollToHeading(page, "Repository task");
        await page.waitForTimeout(seconds * 90);
        break;
      }
      case "05": {
        await open(page, `/results/${PROOF_ID}`);
        await page.waitForTimeout(seconds * 130);
        await scrollToHeading(page, "harness");
        await page.waitForTimeout(seconds * 160);
        break;
      }
      case "06": {
        await open(page, `/replay/${PROOF_ID}`);
        await page.waitForTimeout(seconds * 170);
        await page.mouse.wheel(0, 520);
        await page.waitForTimeout(seconds * 130);
        break;
      }
      case "07": {
        await open(page, "/tasks/new");
        await page.waitForTimeout(seconds * 90);
        await fillTaskForm(page);
        await page.waitForTimeout(seconds * 90);
        await open(page, `/tasks/${COMMUNITY_TASK}`);
        await page.waitForTimeout(seconds * 120);
        await scrollToHeading(page, "Six gates");
        await page.waitForTimeout(seconds * 130);
        break;
      }
      case "08": {
        await open(page, "/app");
        await page.waitForTimeout(seconds * 130);
        await page.mouse.wheel(0, 920);
        await page.waitForTimeout(seconds * 100);
        await open(page, "/");
        await page.waitForTimeout(seconds * 160);
        break;
      }
      default:
        await open(page, "/");
        await page.waitForTimeout(seconds * 500);
    }
  });
}

await browser.close();
console.log("recordings complete");
