import type { Metadata } from "next";

import type { GameDetail } from "@/features/game/get-game-detail";
import { routing } from "@/i18n/routing";

type Locale = (typeof routing.locales)[number];

const SITE_NAME = "What To Play Next";
const SOCIAL_PREVIEW = {
  alt: SITE_NAME,
  height: 630,
  url: "/api/social-preview",
  width: 1200,
} as const;

const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  en: "en_US",
  "pt-br": "pt_BR",
};

function configurationError(): Error {
  return new Error(
    "WTPN_SITE_ORIGIN must be an absolute HTTP(S) origin without a path, query, hash, or credentials.",
  );
}

export function getSiteOrigin(): URL {
  const value = process.env.WTPN_SITE_ORIGIN?.trim();
  if (!value) {
    throw new Error(
      "WTPN_SITE_ORIGIN is not set. Copy apps/web/.env.example to apps/web/.env.local and configure the public site origin.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw configurationError();
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw configurationError();
  }

  return new URL(url.origin);
}

function localizedPath(locale: Locale, path: string): string {
  return `/${locale}${path}`;
}

function alternates(path: string, locale: Locale): Metadata["alternates"] {
  return {
    canonical: localizedPath(locale, path),
    languages: {
      en: localizedPath("en", path),
      "pt-BR": localizedPath("pt-br", path),
    },
  };
}

type PageMetadataInput = {
  description: string;
  locale: Locale;
  path: string;
  title: string;
};

export function buildPageMetadata({
  description,
  locale,
  path,
  title,
}: PageMetadataInput): Metadata {
  const canonicalPath = localizedPath(locale, path);

  return {
    alternates: alternates(path, locale),
    description,
    title,
    openGraph: {
      description,
      images: [SOCIAL_PREVIEW],
      locale: OPEN_GRAPH_LOCALES[locale],
      siteName: SITE_NAME,
      title,
      type: "website",
      url: canonicalPath,
    },
    twitter: {
      card: "summary_large_image",
      description,
      images: [SOCIAL_PREVIEW],
      title,
    },
  };
}

type GameMetadataInput = PageMetadataInput & {
  coverAlt: string;
  detail: GameDetail;
};

export function buildGameMetadata({
  coverAlt,
  description,
  detail,
  locale,
  title,
}: Omit<GameMetadataInput, "path">): Metadata {
  const path = `/games/${detail.id}/${detail.slug}`;
  const metadata = buildPageMetadata({ description, locale, path, title });
  const images = detail.cover
    ? [
        {
          alt: coverAlt,
          height: detail.cover.height,
          url: detail.cover.url,
          width: detail.cover.width,
        },
      ]
    : [SOCIAL_PREVIEW];

  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images },
    twitter: { ...metadata.twitter, images },
  };
}
