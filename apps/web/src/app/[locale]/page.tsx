import { notFound } from "next/navigation";

import { getCatalogStatus } from "@/features/landing/get-catalog-status";
import { LandingPage } from "@/features/landing/landing-page";
import {
  getLandingContent,
  isSupportedLocale,
  supportedLocales,
} from "@/features/landing/content";

export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }));
}

export default async function LocaleHomePage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const catalogStatus = await getCatalogStatus();

  return (
    <LandingPage
      catalogStatus={catalogStatus}
      content={getLandingContent(locale)}
      locale={locale}
    />
  );
}
