import { useTranslations } from "next-intl";
import { CompassIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

import { Link } from "@/i18n/navigation";

type SystemNotFoundProps = {
  kind: "game" | "page";
};

export function SystemNotFound({ kind }: SystemNotFoundProps) {
  const game = useTranslations("Game");
  const system = useTranslations("System");
  const isGame = kind === "game";

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <meta content="noindex" name="robots" />
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-ink-700 px-6 py-20 text-center">
        <span
          aria-hidden
          className="mb-3 grid size-14 place-items-center rounded-2xl bg-ink-850 text-ember-400"
        >
          <CompassIcon className="size-6" />
        </span>
        <p aria-hidden className="font-mono text-sm text-muted-foreground">
          404
        </p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-50">
          {isGame ? game("notFoundTitle") : system("notFoundTitle")}
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          {isGame ? game("notFoundDescription") : system("notFoundDescription")}
        </p>
        <Link className={buttonVariants({ className: "mt-4" })} href="/">
          {isGame ? game("backToGames") : system("backHome")}
        </Link>
      </div>
    </main>
  );
}
