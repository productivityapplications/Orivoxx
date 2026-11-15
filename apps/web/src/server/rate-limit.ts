import "server-only";

import { createHash } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { getServerEnv } from "./env";

export const RUN_RATE_LIMIT = {
  requests: 10,
  window: "10 m",
} as const;

export type RateLimitOutcome =
  | { allowed: true; reason: "ok" | "development"; remaining?: number; reset?: number }
  | { allowed: false; reason: "limited" | "unavailable"; remaining?: number; reset?: number };

let limiter: Ratelimit | null | undefined;

function production(): boolean {
  return process.env.NODE_ENV === "production" || process.env.ORIVOXX_ENV === "production";
}

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) {
    return limiter;
  }

  const env = getServerEnv();

  if (
    env.UPSTASH_REDIS_REST_URL === undefined ||
    env.UPSTASH_REDIS_REST_TOKEN === undefined
  ) {
    limiter = null;
    return limiter;
  }

  limiter = new Ratelimit({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(RUN_RATE_LIMIT.requests, RUN_RATE_LIMIT.window),
    prefix: "orivoxx:v1:ratelimit:runs",
    analytics: false,
    timeout: 2_000,
  });

  return limiter;
}

/** Tests only. */
export function resetRateLimiter(): void {
  limiter = undefined;
}

/**
 * Mutating endpoints fail closed when shared rate limiting is not available in
 * production. Local development without Redis stays usable.
 */
export async function checkRunRateLimit(identifier: string): Promise<RateLimitOutcome> {
  const shared = getLimiter();

  if (shared === null) {
    return production()
      ? { allowed: false, reason: "unavailable" }
      : { allowed: true, reason: "development" };
  }

  try {
    const result = await shared.limit(identifier);

    return result.success
      ? { allowed: true, reason: "ok", remaining: result.remaining, reset: result.reset }
      : { allowed: false, reason: "limited", remaining: result.remaining, reset: result.reset };
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
}

/** Hashed so a shared Redis never holds a raw client IP. */
export function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate =
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  return createHash("sha256").update(`orivoxx:${candidate}`).digest("hex").slice(0, 32);
}

export function rateLimitHeaders(
  outcome: RateLimitOutcome,
  options: { retryAfter?: boolean } = {},
): Record<string, string> {
  const headers: Record<string, string> = {};

  if (outcome.remaining !== undefined) {
    headers["x-ratelimit-remaining"] = String(outcome.remaining);
  }

  if (outcome.reset !== undefined) {
    const seconds = Math.max(0, Math.ceil((outcome.reset - Date.now()) / 1000));
    headers["x-ratelimit-reset"] = String(seconds);

    if (options.retryAfter === true) {
      headers["retry-after"] = String(seconds);
    }
  }

  return headers;
}
