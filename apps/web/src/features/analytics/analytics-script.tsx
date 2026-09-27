"use client";

import Script from "next/script";
import { useEffect } from "react";

import { enableAnalytics, flushAnalytics } from "./track";

type AnalyticsScriptProps = {
  websiteId: string;
  src: string;
  hostUrl?: string;
};

/**
 * Loads Umami with automatic tracking off: page views and events are sent by
 * this application, through the allow-list, and nothing else. Do Not Track is
 * honored by the script itself.
 */
export function AnalyticsScript({
  websiteId,
  src,
  hostUrl,
}: AnalyticsScriptProps) {
  useEffect(() => {
    enableAnalytics();
  }, []);

  return (
    <Script
      data-auto-track="false"
      data-do-not-track="true"
      data-host-url={hostUrl}
      data-website-id={websiteId}
      onLoad={flushAnalytics}
      src={src}
      strategy="afterInteractive"
    />
  );
}
