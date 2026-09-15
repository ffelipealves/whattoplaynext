import type { MetadataRoute } from "next";

import { getSiteOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    host: getSiteOrigin().origin,
    rules: { allow: "/", userAgent: "*" },
  };
}
