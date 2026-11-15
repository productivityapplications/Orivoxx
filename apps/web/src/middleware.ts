import { NextResponse, type NextRequest } from "next/server";

/**
 * Every request gets a safe correlation id. It is logged with status and
 * timing only; request bodies, source, and prompts are never logged.
 */
export function middleware(request: NextRequest): NextResponse {
  const inbound = request.headers.get("x-request-id");
  const requestId =
    inbound !== null && /^[A-Za-z0-9-]{8,64}$/.test(inbound)
      ? inbound
      : crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
