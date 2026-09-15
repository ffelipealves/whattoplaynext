import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type SystemNotFoundProps = {
  kind: "game" | "page";
};

export function SystemNotFound({ kind }: SystemNotFoundProps) {
  const game = useTranslations("Game");
  const system = useTranslations("System");
  const isGame = kind === "game";

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-5 py-24 text-center sm:px-8">
      <meta content="noindex" name="robots" />
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-[-0.02em]">
        {isGame ? game("notFoundTitle") : system("notFoundTitle")}
      </h1>
      <p className="text-sm text-[#17203a]/65">
        {isGame ? game("notFoundDescription") : system("notFoundDescription")}
      </p>
      <Link
        className="mt-3 text-sm font-semibold text-[#3157d5] underline underline-offset-4"
        href={isGame ? "/games" : "/"}
      >
        {isGame ? game("backToGames") : system("backHome")}
      </Link>
    </main>
  );
}
