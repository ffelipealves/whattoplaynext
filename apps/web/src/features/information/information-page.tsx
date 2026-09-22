import { useTranslations } from "next-intl";

import { IgdbAttribution } from "./site-footer";

export type InformationPageKind = "about" | "privacy" | "terms";

function DraftNotice() {
  const t = useTranslations("Information");

  return (
    <aside className="rounded-2xl border border-[#ff694f]/40 bg-[#fff4f1] p-5">
      <p className="font-semibold text-[#17203a]">{t("draftLabel")}</p>
      <p className="mt-1 text-sm leading-6 text-[#17203a]/75">
        {t("draftNotice")}
      </p>
    </aside>
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-base leading-7 text-[#17203a]/72">
        {children}
      </div>
    </section>
  );
}

function AboutContent() {
  const t = useTranslations("Information");

  return (
    <>
      <Section title={t("aboutPurposeTitle")}>
        <p>{t("aboutPurposeBody")}</p>
        <p>{t("aboutMatchingBody")}</p>
      </Section>
      <Section title={t("aboutSourcesTitle")}>
        <p>{t("aboutSourcesBody")}</p>
        <IgdbAttribution />
        <p>{t("aboutSourceLanguageBody")}</p>
      </Section>
    </>
  );
}

function PrivacyContent() {
  const t = useTranslations("Information");

  return (
    <>
      <Section title={t("privacyStatusTitle")}>
        <p>{t("privacyStatusBody")}</p>
      </Section>
      <Section title={t("privacyReviewTitle")}>
        <p>{t("privacyReviewBody")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("privacyReviewProviders")}</li>
          <li>{t("privacyReviewRetention")}</li>
          <li>{t("privacyReviewTransfers")}</li>
          <li>{t("privacyReviewAnalytics")}</li>
          <li>{t("privacyReviewContact")}</li>
        </ul>
      </Section>
    </>
  );
}

function TermsContent() {
  const t = useTranslations("Information");

  return (
    <>
      <Section title={t("termsStatusTitle")}>
        <p>{t("termsStatusBody")}</p>
      </Section>
      <Section title={t("termsReviewTitle")}>
        <p>{t("termsReviewBody")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("termsReviewUse")}</li>
          <li>{t("termsReviewAvailability")}</li>
          <li>{t("termsReviewContent")}</li>
          <li>{t("termsReviewLiability")}</li>
          <li>{t("termsReviewContact")}</li>
        </ul>
      </Section>
    </>
  );
}

export function InformationPage({ kind }: { kind: InformationPageKind }) {
  const t = useTranslations("Information");
  const titles = {
    about: t("aboutTitle"),
    privacy: t("privacyTitle"),
    terms: t("termsTitle"),
  } satisfies Record<InformationPageKind, string>;

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-12 text-[#17203a] sm:px-8 sm:py-16 lg:px-12">
      <p className="text-xs font-bold tracking-[0.18em] text-[#3157d5] uppercase">
        {t("eyebrow")}
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
        {titles[kind]}
      </h1>
      <div className="mt-8">
        <DraftNotice />
      </div>
      <div className="mt-10 space-y-10">
        {kind === "about" && <AboutContent />}
        {kind === "privacy" && <PrivacyContent />}
        {kind === "terms" && <TermsContent />}
      </div>
    </main>
  );
}
