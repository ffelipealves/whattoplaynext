import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { InformationPage } from "@/features/information/information-page";
import { buildPageMetadata } from "@/lib/seo";

type AboutPageProps = {
  params: Promise<{ locale: "en" | "pt-br" }>;
};

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return buildPageMetadata({
    description: t("aboutDescription"),
    locale,
    path: "/about",
    title: t("aboutTitle"),
  });
}

export default function AboutPage() {
  return <InformationPage kind="about" />;
}
