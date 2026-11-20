import { NextResponse } from "next/server";

import { AUTH_COOKIES, appBaseUrl, githubOAuthConfigured, oauthState } from "@/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<NextResponse> {
  if (!githubOAuthConfigured()) {
    return NextResponse.json({ error: { code: "oauth_unavailable", message: "GitHub OAuth is not configured." } }, { status: 503 });
  }

  const state = oauthState();
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", `${appBaseUrl()}/api/auth/github/callback`);
  url.searchParams.set("scope", "read:user");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);
  response.cookies.set(AUTH_COOKIES.STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 600,
  });
  return response;
}
