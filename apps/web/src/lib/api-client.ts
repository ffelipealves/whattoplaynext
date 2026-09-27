import { headers } from "next/headers";
import { cache } from "react";

import { createApiClient, type ApiClient } from "@whattoplaynext/contracts";

// Must match the API's trust-boundary headers (ratelimit/identity.py).
const CLIENT_ADDRESS_HEADER = "X-WTPN-Client-Address";
const EDGE_TOKEN_HEADER = "X-WTPN-Edge-Token";
const REQUEST_ID_HEADER = "X-Request-ID";

/**
 * One identifier per page render, shared by every API call it makes, so the
 * API's logs can be followed back to one visitor request. React's `cache`
 * scopes it to the render; a route handler makes a single call anyway.
 */
export const currentRequestId = cache((): string => crypto.randomUUID());

function readApiBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. Copy apps/web/.env.example to " +
        "apps/web/.env.local and set it before starting the app.",
    );
  }
  return value;
}

/**
 * A client for calls made on no visitor's behalf, such as the sitemap, which
 * renders outside any request and must not read request headers.
 */
export function getApiClient(): ApiClient {
  return createApiClient(readApiBaseUrl());
}

/**
 * A client for calls made while serving one visitor.
 *
 * Every API call comes from this server, so the API would otherwise charge all
 * visitors to one shared rate-limit budget. With the edge token configured,
 * the visitor's address travels alongside it; the API trusts the address only
 * when the token matches.
 */
export async function getVisitorApiClient(): Promise<ApiClient> {
  const forwarded: Record<string, string> = {
    [REQUEST_ID_HEADER]: currentRequestId(),
  };
  const edgeToken = process.env.WTPN_API_EDGE_TOKEN?.trim();
  const address = edgeToken ? visitorAddress(await headers()) : undefined;
  if (edgeToken && address) {
    forwarded[CLIENT_ADDRESS_HEADER] = address;
    forwarded[EDGE_TOKEN_HEADER] = edgeToken;
  }
  return createApiClient(readApiBaseUrl(), { headers: forwarded });
}

/**
 * The visitor address as the hosting proxy recorded it.
 *
 * Only the first `X-Forwarded-For` entry is read, and only because the proxy
 * in front of this server overwrites that header (Vercel does; Caddy does for
 * untrusted clients). `X-Real-IP` is ignored: a proxy that does not set it
 * passes a visitor's own value straight through.
 */
export function visitorAddress(requestHeaders: Headers): string | undefined {
  const first = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || undefined;
}
