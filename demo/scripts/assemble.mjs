/**
 * Assembles the demo: per-scene video + narration + burned-in captions.
 *
 *   node demo/scripts/assemble.mjs
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
const build = resolve(demo, "build");
const captions = resolve(build, "captions");
const segments = resolve(build, "segments");
const FONT =
  process.env.CAPTION_FONT ?? "/usr/share/fonts/opentype/inter/Inter-Medium.otf";
const HOLD = 0.45;

await rm(build, { recursive: true, force: true });
await mkdir(captions, { recursive: true });
await mkdir(segments, { recursive: true });

async function durationOf(file) {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nw=1:nk=1",
    file,
  ]);

  return Number.parseFloat(stdout.trim());
}

async function ffmpeg(args) {
  await execFile("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    maxBuffer: 16 * 1024 * 1024,
  });
}

function captionWindows(scene, target) {
  const weights = scene.captions.map((caption) => caption.length);
  const total = weights.reduce((sum, value) => sum + value, 0);
  const usable = Math.max(1, target - 0.6);
  let cursor = 0.25;

  return scene.captions.map((caption, index) => {
    const length = (weights[index] / total) * usable;
    const window = {
      caption,
      start: cursor,
      end: Math.min(target - 0.15, cursor + length - 0.02),
    };

    cursor += length;

    return window;
  });
}

const list = [];
let clock = 0;

for (const scene of SCENES) {
  const video = resolve(demo, "recordings", `scene-${scene.id}.webm`);
  const audio = resolve(demo, "audio", scene.file.replace(/\.mp3$/, ".wav"));
  const audioDuration = await durationOf(audio);
  const target = audioDuration + HOLD;
  const windows = captionWindows(scene, target);
  const draw = [];

  for (const [index, window] of windows.entries()) {
    const textFile = resolve(captions, `scene-${scene.id}-${index + 1}.txt`);

    await writeFile(textFile, `${window.caption}\n`, "utf8");
    draw.push(
      `drawtext=fontfile=${FONT}:textfile=${textFile}:fontcolor=white:fontsize=46:box=1:boxcolor=black@0.55:boxborderw=18:x=(w-text_w)/2:y=h-150:enable='between(t,${window.start.toFixed(2)},${window.end.toFixed(2)})'`,
    );
  }

  const filter = [
    `[0:v]fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=4,trim=duration=${target.toFixed(2)},setpts=PTS-STARTPTS,${draw.join(",")}[v]`,
    `[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${target.toFixed(2)},atrim=0:${target.toFixed(2)},asetpts=PTS-STARTPTS[a]`,
  ].join(";");

  const output = resolve(segments, `scene-${scene.id}.mp4`);

  await ffmpeg([
    "-i",
    video,
    "-i",
    audio,
    "-filter_complex",
    filter,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "30",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-t",
    target.toFixed(2),
    output,
  ]);

  list.push({
    file: output,
    duration: target,
    start: clock,
  });
  clock += target;
  console.log(`scene-${scene.id}: ${target.toFixed(2)}s`);
}

const listFile = resolve(build, "concat.txt");
await writeFile(
  listFile,
  list.map((entry) => `file '${entry.file.replace(/'/g, "'\\''")}'`).join("\n") + "\n",
  "utf8",
);

const concatenated = resolve(build, "concatenated.mp4");
await ffmpeg([
  "-f",
  "concat",
  "-safe",
  "0",
  "-i",
  listFile,
  "-c",
  "copy",
  concatenated,
]);

const final = resolve(demo, "orivoxx-demo.mp4");
await ffmpeg([
  "-i",
  concatenated,
  "-c:v",
  "copy",
  "-af",
  "adelay=200|200,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000",
  "-c:a",
  "aac",
  "-b:a",
  "192k",
  "-ar",
  "48000",
  "-ac",
  "2",
  "-movflags",
  "+faststart",
  final,
]);

const thumbnailAt = (list[3]?.start ?? 0) + 2.4;

await ffmpeg([
  "-ss",
  thumbnailAt.toFixed(2),
  "-i",
  final,
  "-frames:v",
  "1",
  resolve(demo, "thumbnail.png"),
]);
await ffmpeg([
  "-ss",
  thumbnailAt.toFixed(2),
  "-i",
  final,
  "-frames:v",
  "1",
  "-q:v",
  "2",
  resolve(demo, "thumbnail.jpg"),
]);

const total = await durationOf(final);
const size = (await import("node:fs/promises")).stat(final);

console.log(`final: ${final}`);
console.log(`duration: ${total.toFixed(2)}s`);
console.log(`size: ${((await size).size / (1024 * 1024)).toFixed(1)} MiB`);
