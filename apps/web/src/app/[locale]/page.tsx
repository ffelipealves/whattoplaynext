import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { getCatalogStatus } from "@/features/landing/get-catalog-status";
import { LandingPage } from "@/features/landing/landing-page";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type HomePageProps = {
  params: Promise<{ locale: "en" | "pt-br" }>;
};

export async function generateMetadata({
  params,
}: HomePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  const metadata = buildPageMetadata({
    description: t("homeDescription"),
    locale,
    path: "",
    title: t("homeTitle"),
  });

  return {
    ...metadata,
    title: { absolute: `${t("homeTitle")} | What To Play Next` },
  };
}

export default async function LocaleHomePage() {
  const catalogStatus = await getCatalogStatus();

  return <LandingPage catalogStatus={catalogStatus} />;
}
