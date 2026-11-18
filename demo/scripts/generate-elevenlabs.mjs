/**
 * Renders every scene with ElevenLabs and stores word alignment.
 *
 *   node --env-file=.env.local demo/scripts/generate-elevenlabs.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SCENES, VOICE_ID } from "./narration.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const audio = resolve(here, "..", "audio");
const apiKey = process.env.ELEVENLABS_API_KEY;
const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

if (!apiKey) {
  console.error("ELEVENLABS_API_KEY is missing; refusing to fall back silently.");
  process.exit(1);
}

await mkdir(audio, { recursive: true });

for (const scene of SCENES) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        text: scene.text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    console.error(`${scene.file}: HTTP ${response.status} ${body.slice(0, 400)}`);
    process.exit(1);
  }

  const payload = await response.json();
  const alignment = payload.normalized_alignment ?? payload.alignment;
  const audioBytes = Buffer.from(payload.audio_base64, "base64");

  await writeFile(resolve(audio, scene.file), audioBytes);
  await writeFile(
    resolve(audio, scene.file.replace(/\.mp3$/, ".timestamps.json")),
    JSON.stringify(
      {
        characters: alignment.characters,
        starts: alignment.character_start_times_seconds,
        ends: alignment.character_end_times_seconds,
      },
      null,
      0,
    ),
  );
  console.log(`${scene.file}: ${audioBytes.length} bytes`);
}
