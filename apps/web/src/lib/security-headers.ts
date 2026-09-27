/**
 * Response headers for every page, built once from the deployment's settings.
 *
 * `script-src` keeps `'unsafe-inline'` because the App Router streams inline
 * bootstrap scripts; a nonce would force every page, including the prerendered
 * information pages, to render per request. That residual risk is recorded in
 * the security review. Every other directive is as narrow as the pages allow:
 * fonts are self-hosted by `next/font`, and IGDB images arrive through the
 * same-origin `/_next/image` optimizer.
 */

type SecurityHeaderOptions = {
  development: boolean;
  siteOrigin: string;
};

type Header = { key: string; value: string };

function isHttps(siteOrigin: string): boolean {
  return new URL(siteOrigin).protocol === "https:";
}

export function contentSecurityPolicy({
  development,
  siteOrigin,
}: SecurityHeaderOptions): string {
  const directives = [
    "default-src 'self'",
    // Hot reloading evaluates code and talks to the dev server over a socket.
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${development ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (isHttps(siteOrigin)) {
    directives.push("upgrade-insecure-requests");
  }
  return directives.join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions): Header[] {
  const headers: Header[] = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
    },
  ];
  if (isHttps(options.siteOrigin)) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }
  return headers;
}
