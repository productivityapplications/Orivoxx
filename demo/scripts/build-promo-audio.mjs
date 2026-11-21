/**
 * Builds the single promo narration track and the shared scene timeline.
 *
 *   node demo/scripts/build-promo-audio.mjs
 */
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { SCENES } from "./narration.mjs";

const execFile = promisify(execFileCallback);
const here = dirname(fileURLToPath(import.meta.url));
const demo = resolve(here, "..");
const work = resolve(demo, "build", "promo");
const publicDemo = resolve(demo, "..", "apps", "web", "public", "demo");
const appPromo = resolve(demo, "..", "apps", "web", "src", "app", "promo");

const INTRO = 1.7;
const GAP = 0.35;
const TAIL = 1.2;

await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });
await mkdir(publicDemo, { recursive: true });
await mkdir(appPromo, { recursive: true });

async function duration(file) {
  const { stdout } = await execFile("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
  ]);
  return Number.parseFloat(stdout.trim());
}

async function ffmpeg(args) {
  await execFile("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

async function silence(file, seconds) {
  await ffmpeg([
    "-f", "lavfi", "-t", String(seconds), "-i", "anullsrc=r=44100:cl=stereo",
    "-c:a", "pcm_s16le", file,
  ]);
}

const parts = [];
const scenes = [];
let cursor = INTRO;
let index = 0;

for (const scene of SCENES) {
  const source = resolve(demo, "audio", scene.file);
  const wav = resolve(work, `scene-${scene.id}.wav`);
  const seconds = await duration(source);
  await ffmpeg(["-i", source, "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", wav]);
  scenes.push({
    id: scene.id,
    title: scene.title,
    file: scene.file,
    start: Number(cursor.toFixed(3)),
    duration: Number(seconds.toFixed(3)),
  });
  parts.push(wav);
  cursor += seconds;
  if (index < SCENES.length - 1) {
    const gap = resolve(work, `gap-${scene.id}.wav`);
    await silence(gap, GAP);
    parts.push(gap);
    cursor += GAP;
  }
  index += 1;
}

const tail = resolve(work, "tail.wav");
await silence(tail, TAIL);
parts.push(tail);
cursor += TAIL;

const intro = resolve(work, "intro.wav");
await silence(intro, INTRO);
const list = [intro, ...parts].map((file) => `file '${file}'`).join("\n");
const listFile = resolve(work, "concat.txt");
await writeFile(listFile, `${list}\n`, "utf8");

const wav = resolve(work, "promo.wav");
await ffmpeg(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", wav]);

const mp3 = resolve(publicDemo, "promo-audio.mp3");
await ffmpeg(["-i", wav, "-c:a", "libmp3lame", "-b:a", "192k", mp3]);

const timeline = {
  introSeconds: INTRO,
  gapSeconds: GAP,
  tailSeconds: TAIL,
  totalSeconds: Number(cursor.toFixed(3)),
  scenes,
};

await writeFile(resolve(appPromo, "timeline.json"), `${JSON.stringify(timeline, null, 2)}\n`);
await writeFile(resolve(demo, "recordings", "promo-timeline.json"), `${JSON.stringify(timeline, null, 2)}\n`);
console.log(JSON.stringify(timeline, null, 2));
