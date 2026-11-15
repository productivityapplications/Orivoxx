import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type Server,
} from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { startModelProxy, type ModelProxy } from "./proxy.js";

interface RecordedRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  body: string;
}

interface Upstream {
  url: string;
  requests: RecordedRequest[];
  close: () => Promise<void>;
}

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
  await Promise.all(cleanups.splice(0).map((cleanup) => cleanup().catch(() => undefined)));
});

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();

      if (address === null || typeof address === "string") {
        reject(new Error("failed to bind"));
        return;
      }

      resolve(address.port);
    });
  });
}

async function startUpstream(
  handler: (
    request: RecordedRequest,
    response: import("node:http").ServerResponse,
  ) => void,
): Promise<Upstream> {
  const requests: RecordedRequest[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const recorded: RecordedRequest = {
        method: request.method ?? "",
        url: request.url ?? "",
        headers: request.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      };
      requests.push(recorded);
      handler(recorded, response);
    });
  });
  const port = await listen(server);

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

async function startProxy(
  options: Partial<Parameters<typeof startModelProxy>[0]> = {},
): Promise<ModelProxy> {
  const proxy = await startModelProxy({
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "test-provider-key",
    host: "127.0.0.1",
    port: 0,
    ...options,
  });

  cleanups.push(proxy.close);

  return proxy;
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

describe("model proxy configuration", () => {
  it("requires a base URL with an http(s) scheme", async () => {
    await expect(
      startModelProxy({ baseUrl: "ftp://openrouter.ai/api/v1", apiKey: "k", host: "127.0.0.1", port: 0 }),
    ).rejects.toThrow(/http or https/);

    await expect(
      startModelProxy({ baseUrl: "not a url", apiKey: "k", host: "127.0.0.1", port: 0 }),
    ).rejects.toThrow(/valid absolute URL/);
  });

  it("rejects credentials, query strings, and fragments in the base URL", async () => {
    await expect(
      startModelProxy({
        baseUrl: "https://user:pass@openrouter.ai/api/v1",
        apiKey: "k",
        host: "127.0.0.1",
        port: 0,
      }),
    ).rejects.toThrow(/credentials/);

    await expect(
      startModelProxy({
        baseUrl: "https://openrouter.ai/api/v1?key=leak",
        apiKey: "k",
        host: "127.0.0.1",
        port: 0,
      }),
    ).rejects.toThrow(/query or fragment/);
  });

  it("refuses to start without an API key", async () => {
    await expect(
      startModelProxy({ baseUrl: "https://openrouter.ai/api/v1", apiKey: "", host: "127.0.0.1", port: 0 }),
    ).rejects.toThrow(/API key/);
  });
});

describe("model proxy health", () => {
  it("answers health checks without contacting the provider", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({ baseUrl: `${upstream.url}/api/v1` });

    const response = await fetch(`${proxy.url}/healthz`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(upstream.requests).toHaveLength(0);
  });
});

describe("model proxy allowlist", () => {
  it("forwards an allowed /v1 request to the provider base path", async () => {
    const upstream = await startUpstream((_request, response) =>
      json(response, 200, { choices: [] }),
    );
    cleanups.push(upstream.close);
    const proxy = await startProxy({ baseUrl: `${upstream.url}/api/v1` });

    const response = await fetch(`${proxy.url}/v1/chat/completions?trace=1`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [] }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ choices: [] });
    expect(upstream.requests).toHaveLength(1);
    expect(upstream.requests[0]?.method).toBe("POST");
    expect(upstream.requests[0]?.url).toBe("/api/v1/chat/completions?trace=1");
    expect(upstream.requests[0]?.body).toContain("openai/gpt-4o-mini");
  });

  it("maps a /v1 root request", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({ baseUrl: `${upstream.url}/api/v1` });

    const response = await fetch(`${proxy.url}/v1`);

    expect(response.status).toBe(200);
    expect(upstream.requests[0]?.url).toBe("/api/v1");
  });

  it("rejects every path outside /v1", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({ baseUrl: `${upstream.url}/api/v1` });

    for (const path of ["/", "/api/chat/completions", "/v2/chat", "/v1suffix"]) {
      const response = await fetch(`${proxy.url}${path}`);

      expect(response.status, path).toBe(404);
      expect(await response.json()).toEqual({ error: "not_allowed" });
    }

    expect(upstream.requests).toHaveLength(0);
  });

  it("rejects traversal and encoded traversal", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({ baseUrl: `${upstream.url}/api/v1` });

    for (const path of [
      "/v1/../admin",
      "/v1/%2e%2e/admin",
      "/v1/%2E%2E/admin",
      "/v1/%2fadmin",
      "/v1/%5cadmin",
    ]) {
      const response = await fetch(`${proxy.url}${path}`, { redirect: "manual" });

      expect(response.status, path).toBe(404);
    }

    expect(upstream.requests).toHaveLength(0);
  });

  it("rejects methods other than GET and POST", async () => {
    const proxy = await startProxy();

    for (const method of ["PUT", "DELETE", "PATCH", "OPTIONS"]) {
      const response = await fetch(`${proxy.url}/v1/chat/completions`, { method });

      expect(response.status, method).toBe(405);
      expect(await response.json()).toEqual({ error: "method_not_allowed" });
    }
  });
});

describe("model proxy credentials", () => {
  it("strips the sandbox credential and injects the provider key", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({
      baseUrl: `${upstream.url}/api/v1`,
      apiKey: "real-provider-key",
    });

    await fetch(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        authorization: "Bearer orivoxx-sandbox-proxy",
        "content-type": "application/json",
        accept: "application/json",
      },
      body: "{}",
    });

    const headers = upstream.requests[0]?.headers;

    expect(headers?.authorization).toBe("Bearer real-provider-key");
    expect(headers?.["content-type"]).toBe("application/json");
    expect(headers?.accept).toBe("application/json");
  });

  it("does not forward cookies, forwarded headers, or a client host", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({ baseUrl: `${upstream.url}/api/v1` });

    await fetch(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: {
        cookie: "session=secret",
        "x-forwarded-for": "10.0.0.9",
        "x-api-key": "leak",
        "content-type": "application/json",
      },
      body: "{}",
    });

    const headers = upstream.requests[0]?.headers;

    expect(headers?.cookie).toBeUndefined();
    expect(headers?.["x-forwarded-for"]).toBeUndefined();
    expect(headers?.["x-api-key"]).toBeUndefined();
    expect(headers?.host).toBe(new URL(upstream.url).host);
  });
});

describe("model proxy budgets", () => {
  it("rejects an oversized declared request body", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({
      baseUrl: `${upstream.url}/api/v1`,
      maxRequestBytes: 64,
    });

    const response = await fetch(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "a".repeat(512),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "request_too_large" });
    expect(upstream.requests).toHaveLength(0);
  });

  it("rejects an oversized streamed request body", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({
      baseUrl: `${upstream.url}/api/v1`,
      maxRequestBytes: 64,
    });

    const status = await new Promise<number>((resolve, reject) => {
      const address = new URL(proxy.url);
      const request = httpRequest(
        {
          host: address.hostname,
          port: address.port,
          path: "/v1/chat/completions",
          method: "POST",
          headers: { "transfer-encoding": "chunked" },
        },
        (response) => {
          response.resume();
          response.once("end", () => resolve(response.statusCode ?? 0));
        },
      );

      request.once("error", reject);
      request.write("a".repeat(32));
      request.write("b".repeat(32));
      request.write("c".repeat(32));
      request.end();
    });

    expect(status).toBe(413);
  });

  it("rejects an oversized provider response", async () => {
    const upstream = await startUpstream((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("x".repeat(4096));
    });
    cleanups.push(upstream.close);
    const proxy = await startProxy({
      baseUrl: `${upstream.url}/api/v1`,
      maxResponseBytes: 256,
    });

    const response = await fetch(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "response_too_large" });
  });
});

describe("model proxy upstream failures", () => {
  it("reports a refused connection as an upstream error", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({ baseUrl: `${upstream.url}/api/v1` });

    await upstream.close();

    const response = await fetch(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_error" });
  });

  it("reports an upstream timeout", async () => {
    const upstream = await startUpstream(() => {
      // Never respond.
    });
    cleanups.push(upstream.close);
    const proxy = await startProxy({
      baseUrl: `${upstream.url}/api/v1`,
      upstreamTimeoutMs: 150,
    });

    const response = await fetch(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "upstream_timeout" });
  });

  it("passes a provider error status through without leaking the body", async () => {
    const upstream = await startUpstream((_request, response) => {
      json(response, 429, { error: { message: "rate limited" } });
    });
    cleanups.push(upstream.close);
    const proxy = await startProxy({ baseUrl: `${upstream.url}/api/v1` });

    const response = await fetch(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: { message: "rate limited" } });
  });

  it("marks every response as non-cacheable", async () => {
    const upstream = await startUpstream((_request, response) => json(response, 200, {}));
    cleanups.push(upstream.close);
    const proxy = await startProxy({ baseUrl: `${upstream.url}/api/v1` });

    const response = await fetch(`${proxy.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
