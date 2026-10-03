import { useTranslations } from "next-intl";
import { Gamepad2Icon } from "lucide-react";

import { Link } from "@/i18n/navigation";

import { HeaderSearch } from "./header-search";
import { LanguageSwitch } from "./language-switch";

type SiteHeaderProps = {
  /**
   * The published autocomplete minimum. Only the search route loads the
   * filter metadata, so elsewhere the field stays a plain search that submits
   * to the home page.
   */
  minimumQueryLength?: number;
};

export function SiteHeader({ minimumQueryLength }: SiteHeaderProps) {
  const t = useTranslations("Header");

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-360 items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <Link
          aria-label={t("homeLabel")}
          className="flex shrink-0 items-center gap-2.5 rounded-lg"
          href="/"
        >
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"
          >
            <Gamepad2Icon className="size-5" strokeWidth={2.4} />
          </span>
          <span className="hidden font-display text-xl font-extrabold tracking-tight text-ink-50 md:block">
            What To Play Next
          </span>
        </Link>

        <HeaderSearch minimumQueryLength={minimumQueryLength} />

        <LanguageSwitch />
      </div>
    </header>
  );
}
