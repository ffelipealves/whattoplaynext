import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";

import { routing } from "@/i18n/routing";
import { analyticsConfig } from "@/features/analytics/analytics-config";
import { AnalyticsScript } from "@/features/analytics/analytics-script";
import { PageviewTracker } from "@/features/analytics/trackers";
import { SiteFooter } from "@/features/information/site-footer";
import { getSiteOrigin } from "@/lib/seo";

import "../globals.css";

const displayFont = Bricolage_Grotesque({
  // Optical sizing is what tightens the large headings; without the axis the
  // browser renders every size from the small-text master.
  axes: ["opsz"],
  subsets: ["latin"],
  variable: "--font-bricolage",
});

const bodyFont = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const monoFont = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0c0c0e",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    metadataBase: getSiteOrigin(),
    title: {
      default: "What To Play Next",
      template: "%s | What To Play Next",
    },
    description: t("homeDescription"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const analytics = analyticsConfig();

  return (
    // The font variables sit on <html> because the theme's font stacks are
    // resolved there; on <body> they would be out of reach of `html`.
    <html
      className={`dark ${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      lang={locale}
    >
      {/* A column, so the footer sits at the foot of a short page. */}
      <body className="flex flex-col">
        <NextIntlClientProvider>
          <div className="flex-1">{children}</div>
          <SiteFooter />
          {analytics && (
            <>
              <AnalyticsScript {...analytics} />
              <PageviewTracker />
            </>
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
