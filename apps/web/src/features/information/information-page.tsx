import { useTranslations } from "next-intl";
import { FilePenLineIcon } from "lucide-react";

import { IgdbAttribution } from "./site-footer";

export type InformationPageKind = "about" | "privacy" | "terms";

function DraftNotice() {
  const t = useTranslations("Information");

  return (
    <aside className="flex gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-ember-300"
      >
        <FilePenLineIcon className="size-5" />
      </span>
      <div>
        <p className="font-semibold text-ink-50">{t("draftLabel")}</p>
        <p className="mt-1 text-sm leading-6 text-ink-300">
          {t("draftNotice")}
        </p>
      </div>
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
    <section className="border-t border-border pt-8">
      <h2 className="font-display text-2xl font-bold tracking-tight text-ink-50">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[0.9375rem] leading-7 text-ink-300">
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
    <main className="mx-auto w-full max-w-3xl px-4 pt-12 pb-20 text-foreground sm:px-6 sm:pt-16">
      <p className="mb-4 flex items-center gap-3 font-mono text-xs tracking-[0.2em] text-ember-400 uppercase">
        <span aria-hidden className="h-px w-8 bg-ember-400" />
        {t("eyebrow")}
      </p>
      <h1 className="font-display text-4xl leading-[0.95] font-extrabold tracking-tight text-ink-50 sm:text-5xl lg:text-6xl">
        {titles[kind]}
      </h1>
      <div className="mt-10">
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
