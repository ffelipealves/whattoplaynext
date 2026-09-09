import { notFound } from "next/navigation";

import { LandingPage } from "@/features/landing/landing-page";
import {
  getLandingContent,
  isSupportedLocale,
  supportedLocales,
} from "@/features/landing/content";

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

  return <LandingPage content={getLandingContent(locale)} locale={locale} />;
}
