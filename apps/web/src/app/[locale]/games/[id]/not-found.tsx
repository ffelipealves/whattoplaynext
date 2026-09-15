import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export default function GameNotFound() {
  const t = useTranslations("Game");

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-24 text-center sm:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-[-0.02em]">
        {t("notFoundTitle")}
      </h1>
      <p className="text-sm text-[#17203a]/65">{t("notFoundDescription")}</p>
      <Link
        className="mt-3 text-sm font-semibold text-[#3157d5] underline underline-offset-4"
        href="/games"
      >
        {t("backToGames")}
      </Link>
    </main>
  );
}
