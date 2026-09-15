import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { InformationPage } from "@/features/information/information-page";
import { buildPageMetadata } from "@/lib/seo";

type TermsPageProps = {
  params: Promise<{ locale: "en" | "pt-br" }>;
};

export async function generateMetadata({
  params,
}: TermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    description: t("termsDescription"),
    locale,
    path: "/terms",
    title: t("termsTitle"),
  });
}

export default function TermsPage() {
  return <InformationPage kind="terms" />;
}
