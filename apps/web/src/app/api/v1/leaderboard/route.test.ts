import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "./route";
import { getSeedStore, resetResultServerCache } from "@/server/results";

beforeEach(() => {
  resetResultServerCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetResultServerCache();
});

describe("GET /api/v1/leaderboard", () => {
  it("serves the bundled seed rows with an explicit source", async () => {
    const response = await GET(new Request("http://localhost/api/v1/leaderboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.store).toBe("seed");
    expect(body.degraded).toBe(false);
    expect(body.readOnly).toBe(true);
    expect(body.entries.length).toBeGreaterThanOrEqual(2);
    expect(body.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const seed = await getSeedStore();
    const seedIds = (await seed.list({ limit: 200 })).map((entry) => entry.resultId);

    for (const entry of body.entries) {
      expect(seedIds).toContain(entry.resultId);
      expect(entry).not.toHaveProperty("score");
      expect(entry).not.toHaveProperty("diff");
    }
  });

  it("orders rows by score and carries the version fields", async () => {
    const response = await GET(new Request("http://localhost/api/v1/leaderboard"));
    const body = await response.json();
    const scores = body.entries.map((entry: { overall: number }) => entry.overall);

    expect(scores).toEqual([...scores].sort((left, right) => right - left));

    for (const field of [
      "taskVersion",
      "rulesetVersion",
      "adapterVersion",
      "scoringConfigVersion",
      "repositoryFingerprint",
    ]) {
      expect(typeof body.entries[0][field], field).toBe("string");
    }
  });

  it("filters by task and applies the limit after ranking", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/leaderboard?taskId=linkstash&limit=1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].taskId).toBe("linkstash");
  });

  it("falls back with degraded: true when the shared store is unreachable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "http://127.0.0.1:1");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    resetResultServerCache();

    const response = await GET(new Request("http://localhost/api/v1/leaderboard"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.degraded).toBe(true);
    expect(body.store).toBe("seed");
    expect(body.problem).toBe("store_unavailable");
    expect(body.entries.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects an invalid limit without echoing input", async () => {
    for (const limit of ["0", "201", "abc", "1.5"]) {
      const response = await GET(
        new Request(`http://localhost/api/v1/leaderboard?limit=${limit}`),
      );
      const body = await response.json();

      expect(response.status, limit).toBe(400);
      expect(body.error.code).toBe("invalid_query");
      expect(JSON.stringify(body)).not.toContain(limit === "abc" ? "abc" : "__none__");
    }
  });

  it("rejects an invalid task id", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/leaderboard?taskId=../etc/passwd"),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_query" } });
  });

  it("marks every response as non-cacheable", async () => {
    const response = await GET(new Request("http://localhost/api/v1/leaderboard"));

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
