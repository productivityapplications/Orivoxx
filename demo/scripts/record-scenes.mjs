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
    resolve(audioDirectory, file.replace(/\.mp3$/, ".wav")),
  ]);

  return Number.parseFloat(stdout.trim());
}

const leaderboard = await fetch(`${base}/api/v1/leaderboard?limit=100`).then((response) =>
  response.json(),
);
const all = await fetch(`${base}/api/v1/leaderboard?limit=100&kind=all`).then((response) =>
  response.json(),
);

const pythonResult =
  leaderboard.entries?.find(
    (entry) =>
      entry.adapter.id === "python-openrouter" && entry.model?.name === "openai/gpt-4o-mini",
  ) ?? leaderboard.entries?.[0];
const cappedResult =
  all.entries?.find(
    (entry) =>
      entry.taskId === "taskboard" &&
      entry.adapter.id === "fake" &&
      entry.capsApplied?.length > 0,
  ) ??
  all.entries?.find(
    (entry) => entry.taskId === "taskboard" && entry.capsApplied?.length > 0,
  ) ??
  all.entries?.find((entry) => entry.capsApplied?.length > 0);

if (pythonResult === undefined || cappedResult === undefined) {
  throw new Error("The store does not have the results needed for the demo.");
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
  await page.waitForTimeout(400);
}

async function scrollBy(page, pixels, steps = 24) {
  for (let index = 0; index < steps; index += 1) {
    await page.mouse.wheel(0, pixels / steps);
    await page.waitForTimeout(28);
  }
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
        await scrollBy(page, 620);
        await page.waitForTimeout(seconds * 120);
        break;
      }
      case "02": {
        await open(page, "/benchmarks");
        await page.waitForTimeout(seconds * 160);
        await page.getByRole("link", { name: /TaskBoard/i }).first().click();
        await page.waitForURL("**/benchmarks/taskboard");
        await page.waitForTimeout(seconds * 160);
        await page.mouse.wheel(0, 520);
        await page.waitForTimeout(seconds * 120);
        break;
      }
      case "03": {
        await open(page, "/leaderboard");
        await page.waitForTimeout(seconds * 180);
        await page.getByRole("link", { name: "All", exact: true }).click();
        await page.waitForTimeout(seconds * 110);
        await page.getByRole("link", { name: "Baselines", exact: true }).click();
        await page.waitForTimeout(seconds * 110);
        await page.getByRole("link", { name: "Agents", exact: true }).click();
        await page.waitForTimeout(seconds * 130);
        await page.getByRole("link", { name: "97.3" }).first().hover();
        await page.waitForTimeout(seconds * 90);
        break;
      }
      case "04": {
        await open(page, `/results/${pythonResult.resultId}`);
        await page.waitForTimeout(seconds * 140);
        await page.mouse.wheel(0, 420);
        await page.waitForTimeout(seconds * 100);
        const rows = page.locator('button[aria-expanded]');
        await rows.nth(1).click();
        await page.waitForTimeout(seconds * 110);
        await rows.nth(2).click();
        await page.waitForTimeout(seconds * 110);
        break;
      }
      case "05": {
        await open(page, `/results/${pythonResult.resultId}`);
        await page.waitForTimeout(seconds * 120);
        await page.mouse.wheel(0, 900);
        await page.waitForTimeout(seconds * 100);
        await page.mouse.wheel(0, 700);
        await page.waitForTimeout(seconds * 140);
        break;
      }
      case "06": {
        await open(page, "/compare?task=taskboard");
        await page.waitForTimeout(seconds * 170);
        await page.mouse.wheel(0, 500);
        await page.waitForTimeout(seconds * 90);
        await open(page, "/submit");
        await page.waitForTimeout(seconds * 120);
        await page.getByText("Regressed", { exact: true }).click();
        await page.waitForTimeout(seconds * 80);
        await page.getByRole("button", { name: /Run fake baseline/i }).click();
        await page.waitForURL("**/results/**", { timeout: 60_000 });
        await page.waitForTimeout(seconds * 120);
        break;
      }
      case "07": {
        await open(page, `/results/${cappedResult.resultId}`);
        await page.waitForTimeout(seconds * 260);
        await page.mouse.wheel(0, 320);
        await page.waitForTimeout(seconds * 90);
        await open(page, "/docs/scoring");
        await page.waitForTimeout(seconds * 180);
        break;
      }
      case "08": {
        await open(page, "/");
        await page.waitForTimeout(seconds * 160);
        await page.mouse.wheel(0, 260);
        await page.waitForTimeout(seconds * 140);
        await page.mouse.wheel(0, -400);
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
