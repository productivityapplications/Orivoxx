/**
 * Assembles the ElevenLabs demo: segments, word-synced ASS captions,
 * cross-dissolves, original ambient bed, loudness normalization.
 */
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { SCENES } from "./narration.mjs";

const execFile = promisify(execFileCallback);
const here = dirname(fileURLToPath(import.meta.url));
const demo = resolve(here, "..");
const build = resolve(demo, "build");
const segments = resolve(build, "segments");
const captions = resolve(build, "captions");
const FONT = "Inter";
const HOLD = 0.45;
const DISSOLVE = 0.35;

await rm(build, { recursive: true, force: true });
await mkdir(segments, { recursive: true });
await mkdir(captions, { recursive: true });

async function durationOf(file) {
  const { stdout } = await execFile("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file,
  ]);
  return Number.parseFloat(stdout.trim());
}

async function ffmpeg(args) {
  await execFile("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    maxBuffer: 32 * 1024 * 1024,
  });
}

function wordsFromAlignment(text, alignment) {
  const chars = alignment.characters;
  const starts = alignment.starts;
  const ends = alignment.ends;
  const words = [];
  let current = null;

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (char === " " || char === "\n") {
      if (current !== null) {
        words.push(current);
        current = null;
      }
      continue;
    }
    if (current === null) {
      current = { word: char, start: starts[index], end: ends[index] };
    } else {
      current.word += char;
      current.end = ends[index];
    }
  }
  if (current !== null) words.push(current);

  // Guard against alignment/text drift: keep only the words that were spoken.
  return words.filter((word) => word.end > word.start);
}

function phraseGroups(words) {
  const phrases = [];
  let current = [];

  for (const word of words) {
    current.push(word);
    const long = current.length >= 8;
    const sentenceEnd = /[.!?]$/.test(word.word);
    const clauseEnd = /[,;:]$/.test(word.word) && current.length >= 5;

    if (long || sentenceEnd || clauseEnd) {
      phrases.push(current);
      current = [];
    }
  }
  if (current.length > 0) phrases.push(current);

  return phrases;
}

function assTime(seconds) {
  const total = Math.max(0, seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  const cs = Math.round((total - Math.floor(total)) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function buildAss(scene, words, target) {
  const lines = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "WrapStyle: 0",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Caption,Inter,44,&H00FFFFFF,&H008C8C85,&H66000000,&H66000000,0,0,0,0,100,100,0,0,1,1,0,2,60,60,64,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  for (const phrase of phraseGroups(words)) {
    const start = Math.max(0, phrase[0].start - 0.08);
    const end = Math.min(target, phrase[phrase.length - 1].end + 0.22);
    const parts = [];

    for (let index = 0; index < phrase.length; index += 1) {
      const word = phrase[index];
      const next = phrase[index + 1];
      const nextStart = next === undefined ? end : next.start;
      const centiseconds = Math.max(1, Math.round((nextStart - word.start) * 100));
      parts.push(`{\\k${centiseconds}}${word.word}${index < phrase.length - 1 ? " " : ""}`);
    }

    lines.push(
      `Dialogue: 0,${assTime(start)},${assTime(end)},Caption,,0,0,0,,${parts.join("")}`,
    );
  }

  return lines.join("\n");
}

async function generateMusic(path, seconds) {
  const rate = 48000;
  const frames = Math.ceil(seconds * rate);
  const data = Buffer.alloc(44 + frames * 2);
  const writeString = (offset, value) => data.write(value, offset, "ascii");
  writeString(0, "RIFF");
  data.writeUInt32LE(36 + frames * 2, 4);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  writeString(36, "data");
  data.writeUInt32LE(frames * 2, 40);

  const tones = [
    [55, 0.34],
    [82.41, 0.24],
    [110, 0.2],
    [164.81, 0.12],
    [220, 0.06],
  ];

  for (let index = 0; index < frames; index += 1) {
    const time = index / rate;
    const fade = Math.min(1, time / 3, (seconds - time) / 4);
    const lfo = 0.82 + 0.18 * Math.sin(2 * Math.PI * 0.035 * time);
    let sample = 0;
    for (const [frequency, weight] of tones) {
      sample += Math.sin(2 * Math.PI * frequency * time + 0.3 * Math.sin(2 * Math.PI * 0.017 * time)) * weight;
    }
    sample = sample * 0.055 * fade * lfo;
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(sample * 32767))), 44 + index * 2);
  }

  await writeFile(path, data);
}

const built = [];
const assFiles = [];

for (const scene of SCENES) {
  const audio = resolve(demo, "audio", scene.file);
  const timestamps = JSON.parse(
    await readFile(resolve(demo, "audio", scene.file.replace(/\.mp3$/, ".timestamps.json")), "utf8"),
  );
  const video = resolve(demo, "recordings", `scene-${scene.id}.webm`);
  const words = wordsFromAlignment(scene.text, timestamps);
  const audioDuration = await durationOf(audio);
  const target = audioDuration + HOLD;
  const ass = buildAss(scene, words, target);
  const assPath = resolve(captions, `scene-${scene.id}.ass`);
  await writeFile(assPath, ass, "utf8");
  assFiles.push(assPath);

  const output = resolve(segments, `scene-${scene.id}.mp4`);
  const filter = [
    `[0:v]fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=4,trim=duration=${target.toFixed(2)},setpts=PTS-STARTPTS,drawbox=x=0:y=ih-170:w=iw:h=170:color=black@0.8:t=fill,ass=${assPath}[v]`,
    `[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${target.toFixed(2)},atrim=0:${target.toFixed(2)},asetpts=PTS-STARTPTS[a]`,
  ].join(";");

  await ffmpeg([
    "-i", video, "-i", audio,
    "-filter_complex", filter,
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "fast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
    "-t", target.toFixed(2), output,
  ]);

  built.push({ output, target });
  console.log(`scene-${scene.id}: ${target.toFixed(2)}s · ${words.length} words`);
}

// Cross-dissolve video and audio, then mix the original ambient bed.
const inputs = built.flatMap((entry) => ["-i", entry.output]);
const filterParts = [];
let videoLabel = "0:v";
let audioLabel = "0:a";
let elapsed = built[0].target;

for (let index = 1; index < built.length; index += 1) {
  const nextVideo = `v${index}`;
  const nextAudio = `a${index}`;
  filterParts.push(
    `[${videoLabel}][${index}:v]xfade=transition=fade:duration=${DISSOLVE}:offset=${(elapsed - DISSOLVE).toFixed(2)}[${nextVideo}]`,
  );
  filterParts.push(
    `[${audioLabel}][${index}:a]acrossfade=d=${DISSOLVE}:c1=tri:c2=tri[${nextAudio}]`,
  );
  videoLabel = nextVideo;
  audioLabel = nextAudio;
  elapsed = elapsed + built[index].target - DISSOLVE;
}

const music = resolve(build, "music-bed.wav");
await generateMusic(music, elapsed + 1);

const totalInputs = built.length;
filterParts.push(
  `[${audioLabel}]volume=1.0[voice]`,
  `[${totalInputs}:a]volume=0.22[bed]`,
  `[voice][bed]amix=inputs=2:duration=first:dropout_transition=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`,
);

const raw = resolve(build, "final-raw.mp4");
await ffmpeg([
  ...inputs, "-i", music,
  "-filter_complex", filterParts.join(";"),
  "-map", `[${videoLabel}]`, "-map", "[aout]",
  "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-r", "30",
  "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
  "-movflags", "+faststart", raw,
]);

const final = resolve(demo, "orivoxx-demo.mp4");
await ffmpeg(["-i", raw, "-c", "copy", "-movflags", "+faststart", final]);

const thumbnailAt = built.slice(0, 3).reduce((sum, entry) => sum + entry.target, 0) + 2.5;
await ffmpeg(["-ss", thumbnailAt.toFixed(2), "-i", final, "-frames:v", "1", resolve(demo, "thumbnail.png")]);
await ffmpeg(["-ss", thumbnailAt.toFixed(2), "-i", final, "-frames:v", "1", "-q:v", "2", resolve(demo, "thumbnail.jpg")]);

console.log(`duration: ${(await durationOf(final)).toFixed(2)}s`);
console.log(`size: ${((await stat(final)).size / (1024 * 1024)).toFixed(1)} MiB`);
