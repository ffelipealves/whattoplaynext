/**
 * Where analytics is served from, when it is configured at all.
 *
 * The website ID is public by design (Umami puts it in every page), so it uses
 * the `NEXT_PUBLIC_` prefix; there is no analytics secret. Without an ID, no
 * script is rendered, nothing is sent, and the CSP gains no origin.
 */
export type AnalyticsConfig = {
  websiteId: string;
  src: string;
  hostUrl?: string;
};

const DEFAULT_SCRIPT_URL = "https://cloud.umami.is/script.js";

export function analyticsConfig(
  env: Record<string, string | undefined> = process.env,
): AnalyticsConfig | undefined {
  const websiteId = env.NEXT_PUBLIC_UMAMI_WEBSITE_ID?.trim();
  if (!websiteId) return undefined;
  const hostUrl = env.NEXT_PUBLIC_UMAMI_HOST_URL?.trim() || undefined;
  return {
    websiteId,
    src: env.NEXT_PUBLIC_UMAMI_SCRIPT_URL?.trim() || DEFAULT_SCRIPT_URL,
    hostUrl,
  };
}

/** The origins the CSP must allow for the script and its collection calls. */
export function analyticsOrigins(
  config: AnalyticsConfig | undefined,
): string[] {
  if (!config) return [];
  const origins = [new URL(config.src).origin];
  if (config.hostUrl) origins.push(new URL(config.hostUrl).origin);
  return [...new Set(origins)];
}
