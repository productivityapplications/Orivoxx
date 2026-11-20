import { NextResponse } from "next/server";

import { AUTH_COOKIES, appBaseUrl, createSession, githubOAuthConfigured } from "@/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  if (!githubOAuthConfigured()) {
    return NextResponse.redirect(`${appBaseUrl()}/tasks/new?auth=unavailable`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = request.headers.get("cookie") ?? "";
  const expected = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIES.STATE_COOKIE}=`))
    ?.split("=")[1];

  if (code === null || state === null || expected === undefined || state !== expected) {
    return NextResponse.redirect(`${appBaseUrl()}/tasks/new?auth=state`);
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${appBaseUrl()}/api/auth/github/callback`,
    }),
  });
  const tokenBody = (await tokenResponse.json()) as { access_token?: unknown };
  if (typeof tokenBody.access_token !== "string") {
    return NextResponse.redirect(`${appBaseUrl()}/tasks/new?auth=exchange`);
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      authorization: `Bearer ${tokenBody.access_token}`,
      accept: "application/vnd.github+json",
      "user-agent": "orivoxx",
    },
  });
  const user = (await userResponse.json()) as { login?: unknown };
  if (typeof user.login !== "string") {
    return NextResponse.redirect(`${appBaseUrl()}/tasks/new?auth=user`);
  }

  const session = createSession(user.login);
  if (session === null) {
    return NextResponse.redirect(`${appBaseUrl()}/tasks/new?auth=session`);
  }

  const response = NextResponse.redirect(`${appBaseUrl()}/tasks/mine`);
  response.cookies.set(AUTH_COOKIES.SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: AUTH_COOKIES.SESSION_TTL_SECONDS,
  });
  response.cookies.delete(AUTH_COOKIES.STATE_COOKIE);
  return response;
}
