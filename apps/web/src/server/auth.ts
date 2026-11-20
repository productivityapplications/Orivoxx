import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";

import { hashUser } from "./community-tasks";

const SESSION_COOKIE = "orivoxx_session";
const ANON_COOKIE = "orivoxx_anon";
const STATE_COOKIE = "orivoxx_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export interface Viewer {
  /** GitHub username, or the anonymized token hash. */
  id: string;
  username: string | null;
  anonymous: boolean;
}

function secret(): string | null {
  const value = process.env.GITHUB_CLIENT_SECRET;
  return value !== undefined && value.length >= 16 ? value : null;
}

export function createSession(username: string): string | null {
  const key = secret();
  if (key === null) return null;
  const payload = Buffer.from(
    JSON.stringify({ username, issuedAt: Date.now() }),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readSession(value: string | undefined): string | null {
  const key = secret();
  if (key === null || value === undefined) return null;
  const [payload, signature] = value.split(".");
  if (payload === undefined || signature === undefined) return null;
  const expected = createHmac("sha256", key).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { username?: unknown; issuedAt?: unknown };
    if (typeof parsed.username !== "string" || typeof parsed.issuedAt !== "number") return null;
    if (Date.now() - parsed.issuedAt > SESSION_TTL_SECONDS * 1000) return null;
    return parsed.username;
  } catch {
    return null;
  }
}

export function githubOAuthConfigured(): boolean {
  return (
    (process.env.GITHUB_CLIENT_ID ?? "").length > 0 &&
    (process.env.GITHUB_CLIENT_SECRET ?? "").length > 0
  );
}

export function oauthState(): string {
  return randomUUID();
}

export async function viewer(): Promise<Viewer> {
  let store: Awaited<ReturnType<typeof cookies>> | null = null;
  let inbound: Awaited<ReturnType<typeof headers>> | null = null;

  try {
    store = await cookies();
    inbound = await headers();
  } catch {
    // Route unit tests and server-to-server calls have no request scope.
    return { id: hashUser("server-anonymous"), username: null, anonymous: true };
  }

  const username = readSession(store.get(SESSION_COOKIE)?.value);
  if (username !== null) return { id: username, username, anonymous: false };

  const anon =
    store.get(ANON_COOKIE)?.value ??
    inbound.get("x-orivoxx-anon") ??
    "server-anonymous";
  const id = hashUser(anon);
  return { id, username: null, anonymous: true };
}

export const AUTH_COOKIES = { SESSION_COOKIE, ANON_COOKIE, STATE_COOKIE, SESSION_TTL_SECONDS } as const;

export function appBaseUrl(): string {
  return (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
