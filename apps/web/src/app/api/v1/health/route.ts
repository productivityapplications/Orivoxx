import { NextResponse } from "next/server";

import { getServerEnv, resolveModelApiKey } from "@/server/env";
import { getSeedStatus } from "@/server/results";
import { APP_VERSION } from "@/server/version";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const env = getServerEnv();
  const seed = await getSeedStatus();
  const storeConfigured =
    env.UPSTASH_REDIS_REST_URL !== undefined && env.UPSTASH_REDIS_REST_TOKEN !== undefined;

  return NextResponse.json(
    {
      status: "ok",
      appVersion: APP_VERSION,
      model: {
        provider: env.MODEL_PROVIDER,
        name: env.MODEL_NAME,
        configured: resolveModelApiKey(env) !== undefined,
      },
      leaderboard: {
        store: storeConfigured ? "upstash" : "local",
        seed: { available: seed.available, rows: seed.rows },
      },
    },
    {
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    },
  );
}
