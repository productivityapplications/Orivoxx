import "server-only";

export type OriginFailure = "origin_missing" | "origin_mismatch" | "cross_site";

export type OriginCheck = { ok: true } | { ok: false; reason: OriginFailure };

function normalize(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

/**
 * Mutating requests must come from the same origin. Browsers send `Origin` on
 * cross-origin and same-origin POSTs; a request without one is not a browser
 * form submission and is rejected. `APP_BASE_URL` covers a proxy that rewrites
 * the internal request URL.
 */
export function checkSameOrigin(request: Request, appBaseUrl?: string): OriginCheck {
  const origin = request.headers.get("origin");

  if (origin === null || origin.trim().length === 0) {
    return { ok: false, reason: "origin_missing" };
  }

  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite !== null && fetchSite !== "same-origin" && fetchSite !== "none") {
    return { ok: false, reason: "cross_site" };
  }

  const allowed = new Set<string>([normalize(request.url)]);
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");

  if (forwardedHost !== null && forwardedHost.trim().length > 0) {
    allowed.add(`${forwardedProto}://${forwardedHost}`);
  }

  if (appBaseUrl !== undefined && appBaseUrl.trim().length > 0) {
    allowed.add(normalize(appBaseUrl));
  }

  return allowed.has(normalize(origin))
    ? { ok: true }
    : { ok: false, reason: "origin_mismatch" };
}
