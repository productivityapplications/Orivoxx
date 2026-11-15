import { describe, expect, it, vi } from "vitest";

import { toLeaderboardEntry } from "./contracts.js";
import { sampleResult } from "./samples.js";
import { ResultStoreError } from "./store.js";
import { UpstashResultStore } from "./upstash.js";

const RESULT = sampleResult({
  resultId: "res_upstash00000000000001",
  createdAt: "2026-11-15T10:00:00.000Z",
});

interface SentCommand {
  url: string;
  init: RequestInit;
  command: unknown[];
}

function stubFetch(
  replies: unknown[],
): { fetch: typeof fetch; sent: SentCommand[] } {
  const sent: SentCommand[] = [];
  let index = 0;

  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(input), init: init ?? {}, command: JSON.parse(String(init?.body)) });

    const reply = replies[Math.min(index, replies.length - 1)];
    index += 1;

    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  return { fetch: impl, sent };
}

function store(replies: unknown[]) {
  const stub = stubFetch(replies);

  return {
    sent: stub.sent,
    store: new UpstashResultStore({
      url: "https://example.upstash.io/",
      token: "test-token",
      fetch: stub.fetch,
    }),
  };
}

describe("upstash store configuration", () => {
  it("rejects an invalid url or an empty token", () => {
    expect(
      () => new UpstashResultStore({ url: "redis://x", token: "t" }),
    ).toThrow(ResultStoreError);
    expect(() => new UpstashResultStore({ url: "https://x", token: "" })).toThrow(
      /TOKEN/,
    );
  });
});

describe("upstash append", () => {
  it("writes the result and both indexes in one atomic script", async () => {
    const { store: upstash, sent } = store([{ result: 1 }]);

    await upstash.append(RESULT);

    expect(sent).toHaveLength(1);
    const command = sent[0]?.command ?? [];

    expect(command[0]).toBe("EVAL");
    expect(command[2]).toBe("3");
    expect(command[3]).toBe(`orivoxx:v1:result:${RESULT.resultId}`);
    expect(command[4]).toBe(`orivoxx:v1:rank:task:${RESULT.taskId}`);
    expect(command[5]).toBe("orivoxx:v1:rank:all");
    expect(JSON.parse(String(command[6])).overall).toBe(RESULT.overall);
    expect(command[7]).toBe(`-${RESULT.overall}`);
    expect(JSON.parse(String(command[8]))).toEqual(toLeaderboardEntry(RESULT));

    expect(sent[0]?.init.headers).toMatchObject({
      authorization: "Bearer test-token",
      "content-type": "application/json",
    });
    expect(sent[0]?.url).toBe("https://example.upstash.io");
  });

  it("translates an existing-id reply into a duplicate error", async () => {
    const { store: upstash } = store([{ result: 0 }]);

    await expect(upstash.append(RESULT)).rejects.toMatchObject({
      code: "duplicate_result",
    });
  });

  it("rejects an unconfirmed append", async () => {
    const { store: upstash } = store([{ result: 7 }]);

    await expect(upstash.append(RESULT)).rejects.toMatchObject({ code: "write_failed" });
  });

  it("refuses an invalid result before calling the store", async () => {
    const { store: upstash, sent } = store([{ result: 1 }]);

    await expect(
      upstash.append({ ...RESULT, overall: 1 } as typeof RESULT),
    ).rejects.toMatchObject({ code: "invalid_stored_result" });
    expect(sent).toHaveLength(0);
  });
});

describe("upstash reads", () => {
  it("parses a stored result", async () => {
    const { store: upstash, sent } = store([{ result: JSON.stringify(RESULT) }]);

    await expect(upstash.get(RESULT.resultId)).resolves.toEqual(RESULT);
    expect(sent[0]?.command).toEqual([
      "GET",
      `orivoxx:v1:result:${RESULT.resultId}`,
    ]);
  });

  it("returns null for a missing result", async () => {
    const { store: upstash } = store([{ result: null }]);

    await expect(upstash.get("res_missing0000000000000")).resolves.toBeNull();
  });

  it("fails loudly on a corrupt stored result", async () => {
    const { store: upstash } = store([{ result: "{}" }]);

    await expect(upstash.get(RESULT.resultId)).rejects.toMatchObject({
      code: "invalid_stored_result",
    });
  });

  it("reads the task index, validates members, and ranks them", async () => {
    const regressed = sampleResult({
      resultId: "res_upstash00000000000002",
      createdAt: "2026-11-15T09:00:00.000Z",
      variant: "regressed",
    });
    const { store: upstash, sent } = store([
      {
        result: [
          JSON.stringify(toLeaderboardEntry(regressed)),
          "not json",
          JSON.stringify(toLeaderboardEntry(RESULT)),
        ],
      },
    ]);

    const entries = await upstash.listByTask("taskboard");

    expect(entries.map((entry) => entry.resultId)).toEqual([
      RESULT.resultId,
      regressed.resultId,
    ]);
    expect(sent[0]?.command.slice(0, 2)).toEqual([
      "ZRANGE",
      "orivoxx:v1:rank:task:taskboard",
    ]);
  });

  it("reads the global index with a clamped range", async () => {
    const { store: upstash, sent } = store([{ result: [] }]);

    await upstash.list({ limit: 1_000 });

    expect(sent[0]?.command).toEqual(["ZRANGE", "orivoxx:v1:rank:all", "0", "249"]);
  });
});

describe("upstash failures", () => {
  it("reports an unreachable store", async () => {
    const upstash = new UpstashResultStore({
      url: "https://example.upstash.io",
      token: "t",
      fetch: (async () => {
        throw new Error("network down");
      }) as typeof fetch,
    });

    await expect(upstash.list()).rejects.toMatchObject({ code: "store_unavailable" });
  });

  it("reports a non-2xx store response without leaking its body", async () => {
    const upstash = new UpstashResultStore({
      url: "https://example.upstash.io",
      token: "t",
      fetch: (async () =>
        new Response("upstream secret details", { status: 503 })) as typeof fetch,
    });

    const failure = await upstash.list().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ResultStoreError);
    expect(String((failure as Error).message)).not.toContain("upstream secret details");
    expect((failure as ResultStoreError).code).toBe("store_unavailable");
  });

  it("reports an error reply as unavailable", async () => {
    const { store: upstash } = store([{ error: "ERR bad command" }]);

    await expect(upstash.list()).rejects.toMatchObject({ code: "store_unavailable" });
  });

  it("reports invalid JSON", async () => {
    const upstash = new UpstashResultStore({
      url: "https://example.upstash.io",
      token: "t",
      fetch: (async () => new Response("<html>", { status: 200 })) as typeof fetch,
    });

    await expect(upstash.list()).rejects.toMatchObject({ code: "read_failed" });
  });

  it("uses a network-free abort signal", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");

    const { store: upstash } = store([{ result: [] }]);
    await upstash.list();

    expect(timeout).toHaveBeenCalledWith(10_000);
    timeout.mockRestore();
  });
});
