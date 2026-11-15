/**
 * Local fallback narration (Piper). Used because the ElevenLabs account hit its
 * free character quota after three scenes; see demo/README.md.
 *
 *   node demo/scripts/generate-piper-audio.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, readdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SCENES } from "./narration.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const audioDirectory = resolve(here, "..", "audio");
const piper = process.env.PIPER_BIN ?? "/tmp/opencode/piper-venv/bin/piper";
const model =
  process.env.PIPER_MODEL ??
  "/tmp/opencode/piper-voices/en_US-lessac-medium.onnx";

await mkdir(resolve(audioDirectory, "elevenlabs"), { recursive: true });

// Preserve any ElevenLabs renders for evidence.
for (const name of await readdir(audioDirectory)) {
  if (name.endsWith(".mp3")) {
    await rename(
      resolve(audioDirectory, name),
      resolve(audioDirectory, "elevenlabs", name),
    ).catch(() => undefined);
  }
}

function synthesize(text, output) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(piper, ["-m", model, "-f", output, "--sentence-silence", "0.28"], {
      stdio: ["pipe", "inherit", "inherit"],
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`piper exited ${code}`));
      }
    });

    child.stdin.end(text);
  });
}

for (const scene of SCENES) {
  const output = resolve(audioDirectory, scene.file.replace(/\.mp3$/, ".wav"));
  await synthesize(scene.text, output);
  console.log(output);
}
