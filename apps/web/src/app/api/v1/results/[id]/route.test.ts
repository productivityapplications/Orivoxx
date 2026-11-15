import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { GET } from "./route";
import { getSeedStore, resetResultServerCache } from "@/server/results";

function context(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  resetResultServerCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetResultServerCache();
});

async function seedId(): Promise<string> {
  const seed = await getSeedStore();
  const row = (await seed.list({ limit: 1 }))[0];

  if (row === undefined) {
    throw new Error("The seed file is missing.");
  }

  return row.resultId;
}

describe("GET /api/v1/results/:id", () => {
  it("returns a stored result with its scorecard and bounded diff", async () => {
    const id = await seedId();
    const response = await GET(new Request(`http://localhost/api/v1/results/${id}`), context(id));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.store).toBe("seed");
    expect(body.degraded).toBe(false);
    expect(body.result.resultId).toBe(id);
    expect(body.result.score.overall).toBe(body.result.overall);
    expect(Array.isArray(body.result.score.requirements)).toBe(true);
    expect(body.result.diff.text.length).toBeLessThanOrEqual(262_144);
    expect(body.result.diff.text).not.toContain("sk-or-v1-");
  });

  it("returns a safe 404 envelope for an unknown id", async () => {
    const id = "res_0000000000000000000000000000ff";
    const response = await GET(new Request(`http://localhost/api/v1/results/${id}`), context(id));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "No result with that id is stored." },
    });
  });

  it("returns the same 404 for a malformed id, without echoing it", async () => {
    for (const id of ["abc", "../../etc/passwd", "res_../../x", ""]) {
      const response = await GET(
        new Request(`http://localhost/api/v1/results/${encodeURIComponent(id)}`),
        context(id),
      );
      const body = await response.json();

      expect(response.status, id).toBe(404);
      expect(body.error.code).toBe("not_found");
      expect(JSON.stringify(body)).not.toContain("passwd");
    }
  });

  it("marks every response as non-cacheable", async () => {
    const id = await seedId();
    const response = await GET(new Request(`http://localhost/api/v1/results/${id}`), context(id));

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
