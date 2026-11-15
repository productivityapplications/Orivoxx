/**
 * Publishes recorded results to the configured store (Upstash in deployment,
 * the local append-only directory otherwise).
 *
 * Usage:
 *   node --env-file=.env.local packages/harness/scripts/publish-results.mjs data/seed-results.json
 *
 * Appends only. An existing result id is reported as a duplicate and skipped,
 * so re-running the publisher is safe.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const { createResultStore, BenchmarkResultSchema } = await import(
  new URL("../../results/dist/index.js", import.meta.url).href
);

const file = process.argv[2] ?? "data/seed-results.json";
const document = JSON.parse(await readFile(resolve(process.cwd(), file), "utf8"));

if (!Array.isArray(document.results)) {
  throw new Error("The seed document must contain a results array.");
}

const { store, kind } = createResultStore({
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  ORIVOXX_RESULTS_DIR: process.env.ORIVOXX_DATA_DIR,
});

console.log(`publishing to ${kind} store`);

let appended = 0;
let duplicates = 0;
let rejected = 0;

for (const row of document.results) {
  const parsed = BenchmarkResultSchema.safeParse(row);

  if (!parsed.success) {
    rejected += 1;
    console.log(`rejected ${row?.resultId ?? "unknown"}`);
    continue;
  }

  try {
    await store.append(parsed.data);
    appended += 1;
    console.log(`appended ${parsed.data.resultId} (${parsed.data.taskId}, ${parsed.data.overall})`);
  } catch (error) {
    if (error?.code === "duplicate_result") {
      duplicates += 1;
      console.log(`duplicate ${parsed.data.resultId}`);
      continue;
    }

    throw error;
  }
}

const rows = await store.list({ limit: 200 });

console.log(
  `done: ${appended} appended, ${duplicates} duplicates, ${rejected} rejected, ${rows.length} rows visible`,
);
