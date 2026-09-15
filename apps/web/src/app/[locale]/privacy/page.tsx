import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { InformationPage } from "@/features/information/information-page";
import { buildPageMetadata } from "@/lib/seo";

type PrivacyPageProps = {
  params: Promise<{ locale: "en" | "pt-br" }>;
};

export async function generateMetadata({
  params,
}: PrivacyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    description: t("privacyDescription"),
    locale,
    path: "/privacy",
    title: t("privacyTitle"),
  });
}

export default function PrivacyPage() {
  return <InformationPage kind="privacy" />;
}
