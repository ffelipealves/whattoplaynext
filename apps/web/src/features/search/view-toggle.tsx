import { useTranslations } from "next-intl";
import { LayoutGridIcon, ListIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import {
  withBrowseParams,
  type BrowseParams,
  type ResultView,
} from "./browse-params";

const VIEWS = [
  { view: "grid", labelKey: "viewGrid", Icon: LayoutGridIcon },
  { view: "list", labelKey: "viewList", Icon: ListIcon },
] as const satisfies readonly {
  view: ResultView;
  labelKey: string;
  Icon: typeof ListIcon;
}[];

/**
 * Grid or list, as links to the same page of the same search: the layout is
 * part of the URL, so a shared link opens the way it was shared.
 */
export function ViewToggle({ params }: { params: BrowseParams }) {
  const t = useTranslations("Search");

  return (
    <nav
      aria-label={t("viewNavLabel")}
      className="hidden h-10 items-center gap-0.5 rounded-xl border border-border bg-card p-0.5 sm:flex"
    >
      {VIEWS.map(({ view, labelKey, Icon }) => {
        const isActive = params.view === view;
        return (
          <Link
            aria-current={isActive ? "true" : undefined}
            aria-label={t(labelKey)}
            className={cn(
              "grid h-8 w-9 place-items-center rounded-lg transition-colors",
              isActive
                ? "bg-ink-800 text-ink-50"
                : "text-muted-foreground hover:text-ink-100",
            )}
            href={{ pathname: "/", query: withBrowseParams(params, { view }) }}
            key={view}
            title={t(labelKey)}
          >
            <Icon aria-hidden className="size-4" />
          </Link>
        );
      })}
    </nav>
  );
}
