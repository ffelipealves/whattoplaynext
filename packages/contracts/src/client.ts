import createClient, { type Client, type ClientOptions } from "openapi-fetch";

import type { paths } from "./schema.js";

export type ApiClient = Client<paths>;
export type ApiClientOptions = Omit<ClientOptions, "baseUrl">;

export function createApiClient(
  baseUrl: string,
  options: ApiClientOptions = {},
): ApiClient {
  return createClient<paths>({ ...options, baseUrl });
}
