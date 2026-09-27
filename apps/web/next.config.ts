import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import {
  analyticsConfig,
  analyticsOrigins,
} from "./src/features/analytics/analytics-config";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL("https://images.igdb.com/igdb/image/upload/**")],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          development: process.env.NODE_ENV === "development",
          // The build fails elsewhere without this setting; the fallback only
          // keeps configuration loading from failing first.
          siteOrigin: process.env.WTPN_SITE_ORIGIN || "http://localhost:3000",
          analyticsOrigins: analyticsOrigins(analyticsConfig()),
        }),
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
