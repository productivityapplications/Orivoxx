import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET as health } from "@/app/api/v1/health/route";

import { getSeedStatus, resetResultServerCache, webLeaderboard, webResult } from "./results";

beforeEach(() => {
  resetResultServerCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetResultServerCache();
});

describe("bundled seed", () => {
  it("loads every recorded row without diagnostics", async () => {
    const status = await getSeedStatus();

    expect(status.available).toBe(true);
    expect(status.rows).toBe(4);
    expect(status.diagnostics).toEqual([]);
  });

  it("serves the seed as a read-only leaderboard", async () => {
    const leaderboard = await webLeaderboard();

    expect(leaderboard.store).toBe("seed");
    expect(leaderboard.readOnly).toBe(true);
    expect(leaderboard.degraded).toBe(false);
    expect(leaderboard.entries).toHaveLength(4);
  });

  it("returns a seed result by id and null for an unknown one", async () => {
    const leaderboard = await webLeaderboard({ limit: 1 });
    const id = leaderboard.entries[0]?.resultId ?? "";

    const found = await webResult(id);

    expect(found.result?.resultId).toBe(id);
    expect(found.readOnly).toBe(true);

    const missing = await webResult("res_0000000000000000000000000000ff");

    expect(missing.result).toBeNull();
  });

  it("stays on the seed when no store is configured in production", async () => {
    vi.stubEnv("ORIVOXX_ENV", "production");

    const leaderboard = await webLeaderboard();

    expect(leaderboard.store).toBe("seed");
    expect(leaderboard.degraded).toBe(false);
    expect(leaderboard.entries.length).toBeGreaterThanOrEqual(2);
  });

  it("filters the seed by task", async () => {
    const leaderboard = await webLeaderboard({ taskId: "taskboard" });

    expect(leaderboard.entries.length).toBeGreaterThanOrEqual(2);

    for (const entry of leaderboard.entries) {
      expect(entry.taskId).toBe("taskboard");
    }
  });
});

describe("health route", () => {
  it("reports provider and leaderboard status without a secret", async () => {
    vi.stubEnv("MODEL_API_KEY", "unit-test-key");
    vi.stubEnv("MODEL_PROVIDER", "");
    vi.stubEnv("MODEL_NAME", "");

    const response = await health();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.model.provider).toBe("openrouter");
    expect(body.model.name).toBe("openai/gpt-4o-mini");
    expect(body.model.configured).toBe(true);
    expect(body.leaderboard.seed).toEqual({ available: true, rows: 4 });
    expect(serialized).not.toContain("unit-test-key");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
