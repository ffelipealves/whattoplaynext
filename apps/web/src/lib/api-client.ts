import { createApiClient, type ApiClient } from "@whattoplaynext/contracts";

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

export function getApiClient(): ApiClient {
  return createApiClient(readApiBaseUrl());
}
