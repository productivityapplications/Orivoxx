import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { request as httpsRequest } from "node:https";

export interface ModelProxyOptions {
  baseUrl: string;
  apiKey: string;
  host?: string;
  port?: number;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
  upstreamTimeoutMs?: number;
  /** Host-visible JSONL trace file for model-call events. */
  traceFile?: string | null;
}

export interface ModelProxy {
  server: Server;
  url: string;
  close: () => Promise<void>;
}

export const PROXY_LIMITS = {
  maxRequestBytes: 1_048_576,
  maxResponseBytes: 2_097_152,
  upstreamTimeoutMs: 60_000,
} as const;

const FORWARDED_REQUEST_HEADERS = ["content-type", "accept"] as const;

function jsonError(response: ServerResponse, status: number, code: string): void {
  if (response.headersSent) {
    response.destroy();
    return;
  }

  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify({ error: code }));
}

function parseBaseUrl(raw: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("MODEL_BASE_URL must be a valid absolute URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("MODEL_BASE_URL must use http or https.");
  }

  if (parsed.username !== "" || parsed.password !== "") {
    throw new Error("MODEL_BASE_URL must not contain credentials.");
  }

  if (parsed.search !== "" || parsed.hash !== "") {
    throw new Error("MODEL_BASE_URL must not contain a query or fragment.");
  }

  return parsed;
}

function upstreamPath(base: URL, requestUrl: URL): string | null {
  if (!requestUrl.pathname.startsWith("/v1/") && requestUrl.pathname !== "/v1") {
    return null;
  }

  if (
    requestUrl.pathname.includes("..") ||
    requestUrl.pathname.includes("\\") ||
    requestUrl.pathname.includes("\0") ||
    /%(?:2e|2f|5c)/i.test(requestUrl.pathname)
  ) {
    return null;
  }

  const suffix = requestUrl.pathname.slice("/v1".length);
  const basePath = base.pathname.replace(/\/+$/g, "");
  const targetPath = `${basePath}${suffix}`;

  if (
    targetPath !== basePath &&
    !targetPath.startsWith(basePath === "" ? "/" : `${basePath}/`)
  ) {
    return null;
  }

  return `${targetPath === "" ? "/" : targetPath}${requestUrl.search}`;
}

interface ModelTrace {
  file: string | null;
  nextStep: number;
}

function traceStep(request: IncomingMessage, trace: ModelTrace): number {
  const header = request.headers["x-orivoxx-step"];
  const parsed = typeof header === "string" ? Number.parseInt(header, 10) : Number.NaN;

  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 500) {
    return parsed;
  }

  trace.nextStep += 1;
  return trace.nextStep;
}

function appendTrace(trace: ModelTrace, event: Record<string, unknown>): void {
  if (trace.file === null) {
    return;
  }

  try {
    appendFileSync(trace.file, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    // Tracing must never take down the proxy.
  }
}

function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  base: URL,
  apiKey: string,
  maxRequestBytes: number,
  maxResponseBytes: number,
  upstreamTimeoutMs: number,
  trace: ModelTrace,
): void {
  const requestUrl = new URL(request.url ?? "/", "http://sandbox.invalid");

  if (request.method === "GET" && requestUrl.pathname === "/healthz") {
    response.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    response.end('{"ok":true}');
    return;
  }

  if (request.method !== "POST" && request.method !== "GET") {
    jsonError(response, 405, "method_not_allowed");
    return;
  }

  const path = upstreamPath(base, requestUrl);

  if (path === null) {
    jsonError(response, 404, "not_allowed");
    return;
  }

  const target = new URL(base.href);
  target.pathname = path.split("?")[0] ?? path;
  target.search = requestUrl.search;

  if (target.origin !== base.origin) {
    jsonError(response, 400, "invalid_target");
    return;
  }

  const contentLength = Number(request.headers["content-length"] ?? "0");

  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    jsonError(response, 413, "request_too_large");
    request.resume();
    return;
  }

  const chunks: Buffer[] = [];
  let received = 0;
  let rejected = false;

  request.on("data", (chunk: Buffer) => {
    if (rejected) {
      return;
    }

    received += chunk.byteLength;

    if (received > maxRequestBytes) {
      rejected = true;
      chunks.length = 0;
      jsonError(response, 413, "request_too_large");
      return;
    }

    chunks.push(chunk);
  });

  request.on("end", () => {
    if (rejected) {
      return;
    }

    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
      "x-title": "Orivoxx Benchmark",
    };

    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = request.headers[name];

      if (typeof value === "string" && !/[\r\n]/.test(value)) {
        headers[name] = value;
      }
    }

    const body = Buffer.concat(chunks);
    headers["content-length"] = String(body.byteLength);

    const stepIndex = traceStep(request, trace);
    const startedAt = Date.now();
    let model = "unknown";
    let messagesHash = "0".repeat(64);

    try {
      const parsedBody = JSON.parse(body.toString("utf8")) as {
        model?: unknown;
        messages?: unknown;
      };
      model = typeof parsedBody.model === "string" ? parsedBody.model.slice(0, 200) : "unknown";
      messagesHash = createHash("sha256")
        .update(JSON.stringify(parsedBody.messages ?? []))
        .digest("hex");
    } catch {
      // A non-JSON body still gets a call event with an unknown model.
    }

    appendTrace(trace, {
      type: "model_call_started",
      at: new Date(startedAt).toISOString(),
      stepIndex,
      model,
      messagesHash,
    });

    const transport = target.protocol === "https:" ? httpsRequest : httpRequest;
    const upstream = transport(
      target,
      {
        method: request.method,
        headers,
        timeout: upstreamTimeoutMs,
      },
      (upstreamResponse) => {
        const status = upstreamResponse.statusCode ?? 502;
        const contentType = upstreamResponse.headers["content-type"] ?? "application/json";
        const responseChunks: Buffer[] = [];
        let responseBytes = 0;
        let failed = false;

        upstreamResponse.on("data", (chunk: Buffer) => {
          if (failed) {
            return;
          }

          responseBytes += chunk.byteLength;

          if (responseBytes > maxResponseBytes) {
            failed = true;
            upstreamResponse.destroy();
            jsonError(response, 502, "response_too_large");
            return;
          }

          responseChunks.push(chunk);
        });

        upstreamResponse.on("end", () => {
          if (failed) {
            return;
          }

          const payload = Buffer.concat(responseChunks);
          let promptTokens = 0;
          let completionTokens = 0;
          let costUsd = 0;
          let finishReason = "unknown";

          try {
            const parsed = JSON.parse(payload.toString("utf8")) as {
              usage?: {
                prompt_tokens?: unknown;
                completion_tokens?: unknown;
                cost?: unknown;
              };
              choices?: { finish_reason?: unknown }[];
            };
            const usage = parsed.usage ?? {};
            promptTokens =
              typeof usage.prompt_tokens === "number" && usage.prompt_tokens >= 0
                ? Math.trunc(usage.prompt_tokens)
                : 0;
            completionTokens =
              typeof usage.completion_tokens === "number" && usage.completion_tokens >= 0
                ? Math.trunc(usage.completion_tokens)
                : 0;
            costUsd =
              typeof usage.cost === "number" && usage.cost >= 0 ? usage.cost : 0;
            const reason = parsed.choices?.[0]?.finish_reason;
            finishReason = typeof reason === "string" ? reason.slice(0, 64) : "unknown";
          } catch {
            // Non-JSON provider responses are still forwarded; metrics stay zero.
          }

          appendTrace(trace, {
            type: "model_call_finished",
            at: new Date().toISOString(),
            stepIndex,
            durationMs: Math.max(0, Date.now() - startedAt),
            promptTokens,
            completionTokens,
            costUsd,
            finishReason,
          });

          response.writeHead(status, {
            "content-type": contentType,
            "cache-control": "no-store",
          });
          response.end(payload);
        });

        upstreamResponse.on("error", () => {
          if (!failed) {
            jsonError(response, 502, "upstream_error");
          }
        });
      },
    );

    upstream.on("timeout", () => {
      upstream.destroy();
      jsonError(response, 504, "upstream_timeout");
    });

    upstream.on("error", () => {
      jsonError(response, 502, "upstream_error");
    });

    upstream.end(body);
  });

  request.on("error", () => {
    jsonError(response, 400, "invalid_request");
  });
}

export async function startModelProxy(options: ModelProxyOptions): Promise<ModelProxy> {
  if (options.apiKey.length === 0) {
    throw new Error("The model proxy requires an API key.");
  }

  const base = parseBaseUrl(options.baseUrl);
  const maxRequestBytes = options.maxRequestBytes ?? PROXY_LIMITS.maxRequestBytes;
  const maxResponseBytes = options.maxResponseBytes ?? PROXY_LIMITS.maxResponseBytes;
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? PROXY_LIMITS.upstreamTimeoutMs;
  const trace: ModelTrace = {
    file: options.traceFile ?? null,
    nextStep: 0,
  };
  const server = createServer((request, response) => {
    handleRequest(
      request,
      response,
      base,
      options.apiKey,
      maxRequestBytes,
      maxResponseBytes,
      upstreamTimeoutMs,
      trace,
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 8080, options.host ?? "0.0.0.0", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const address = server.address();

  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("The model proxy failed to bind a TCP port.");
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
