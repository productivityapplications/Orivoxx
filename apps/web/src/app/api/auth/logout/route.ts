import { NextResponse } from "next/server";

import { AUTH_COOKIES, appBaseUrl } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.redirect(`${appBaseUrl()}/tasks/new`);
  response.cookies.delete(AUTH_COOKIES.SESSION_COOKIE);
  return response;
}
