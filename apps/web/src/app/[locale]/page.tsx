import { getCatalogStatus } from "@/features/landing/get-catalog-status";
import { LandingPage } from "@/features/landing/landing-page";

export const dynamic = "force-dynamic";

export default async function LocaleHomePage() {
  const catalogStatus = await getCatalogStatus();

  return <LandingPage catalogStatus={catalogStatus} />;
}
