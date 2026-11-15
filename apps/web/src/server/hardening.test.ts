import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { checkSameOrigin } from "./origin";
import {
  checkRunRateLimit,
  clientIdentifier,
  resetRateLimiter,
} from "./rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  resetRateLimiter();
});

function request(origin?: string, extra: Record<string, string> = {}): Request {
  const headers = new Headers(extra);

  if (origin !== undefined) {
    headers.set("origin", origin);
  }

  return new Request("https://orivoxx.example/api/v1/runs", { method: "POST", headers });
}

describe("same-origin check", () => {
  it("accepts the request origin and a configured app origin", () => {
    expect(checkSameOrigin(request("https://orivoxx.example"))).toEqual({ ok: true });
    expect(
      checkSameOrigin(request("https://www.orivoxx.example"), "https://www.orivoxx.example"),
    ).toEqual({ ok: true });
  });

  it("accepts the forwarded host when a proxy rewrites the internal URL", () => {
    const requestWithHost = new Request("http://localhost:3000/api/v1/runs", {
      method: "POST",
      headers: {
        origin: "https://orivoxx.example",
        "x-forwarded-host": "orivoxx.example",
        "x-forwarded-proto": "https",
      },
    });

    expect(checkSameOrigin(requestWithHost)).toEqual({ ok: true });
  });

  it("rejects a missing origin", () => {
    expect(checkSameOrigin(request())).toEqual({ ok: false, reason: "origin_missing" });
  });

  it("rejects a foreign origin", () => {
    expect(checkSameOrigin(request("https://evil.example"))).toEqual({
      ok: false,
      reason: "origin_mismatch",
    });
  });

  it("rejects a cross-site fetch even when the origin matches", () => {
    expect(
      checkSameOrigin(request("https://orivoxx.example", { "sec-fetch-site": "cross-site" })),
    ).toEqual({ ok: false, reason: "cross_site" });
  });
});

describe("rate limit policy", () => {
  it("allows local development without a shared limiter", async () => {
    const outcome = await checkRunRateLimit("dev-client");

    expect(outcome).toEqual({ allowed: true, reason: "development" });
  });

  it("fails closed in production when no shared limiter is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    resetRateLimiter();

    const outcome = await checkRunRateLimit("prod-client");

    expect(outcome.allowed).toBe(false);
    expect(outcome.reason).toBe("unavailable");
  });

  it("hashes the client identifier instead of storing an IP", () => {
    const first = new Request("https://orivoxx.example", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    const second = new Request("https://orivoxx.example", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    const other = new Request("https://orivoxx.example", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    expect(clientIdentifier(first)).toBe(clientIdentifier(second));
    expect(clientIdentifier(first)).not.toBe(clientIdentifier(other));
    expect(clientIdentifier(first)).toMatch(/^[a-f0-9]{32}$/);
    expect(clientIdentifier(first)).not.toContain("203.0.113");
  });
});

describe("fake run concurrency", () => {
  it("admits two runs and rejects the third until a slot is released", async () => {
    const { acquireFakeRunSlot, activeFakeRuns } = await import("./runs");
    const first = acquireFakeRunSlot();
    const second = acquireFakeRunSlot();
    const third = acquireFakeRunSlot();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).toBeNull();
    expect(activeFakeRuns()).toBe(2);

    first?.();
    first?.();
    expect(activeFakeRuns()).toBe(1);

    const replacement = acquireFakeRunSlot();

    expect(replacement).not.toBeNull();
    replacement?.();
    second?.();
    expect(activeFakeRuns()).toBe(0);
  });
});
