/**
 * Generates one ElevenLabs audio file per demo scene.
 *
 *   node --env-file=.env.local demo/scripts/generate-audio.mjs
 *
 * The configured ELEVENLABS_VOICE_ID is a library voice that requires a paid
 * plan; the free API returns 402 for it. The demo uses a premade voice, which
 * the free tier permits, unless DEMO_VOICE_ID overrides it.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SCENES } from "./narration.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const audioDirectory = resolve(here, "..", "audio");
const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.DEMO_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB";

if (!apiKey) {
  console.error("ELEVENLABS_API_KEY is not set.");
  process.exit(1);
}

await mkdir(audioDirectory, { recursive: true });

for (const scene of SCENES) {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: scene.text,
        model_id: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();

    console.error(`${scene.file}: HTTP ${response.status} ${detail.slice(0, 200)}`);
    process.exit(1);
  }

  const bytes = Buffer.from(await response.arrayBuffer());

  await writeFile(resolve(audioDirectory, scene.file), bytes);
  console.log(`${scene.file}: ${bytes.length} bytes`);
}
