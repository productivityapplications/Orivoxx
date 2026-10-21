import { NextResponse } from "next/server";

import { getServerEnv } from "@/server/env";
import { APP_VERSION } from "@/server/version";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): NextResponse {
  const env = getServerEnv();

  return NextResponse.json({
    status: "ok",
    providerConfigured: Boolean(env.NEBIUS_API_KEY),
    modelId: env.NEBIUS_MODEL_ID,
    appVersion: APP_VERSION,
  });
}
