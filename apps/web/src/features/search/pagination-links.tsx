import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { MAX_PAGE, withBrowseParams, type BrowseParams } from "./browse-params";

type PaginationLinksProps = {
  params: BrowseParams;
  totalPages: number;
  totalItems: number;
  pageSize: number;
};

type PageWindowEntry = number | "ellipsis";

/** Every page when there are few; otherwise the ends, the neighbourhood of
 * the current page, and enough of the first or last pages near either end
 * that the row keeps a steady length. */
function buildPageWindow(current: number, maxPage: number): PageWindowEntry[] {
  if (maxPage <= 7) {
    return Array.from({ length: maxPage }, (_, index) => index + 1);
  }

  const pages = new Set([1, maxPage, current - 1, current, current + 1]);
  if (current <= 3) {
    [2, 3, 4].forEach((page) => pages.add(page));
  }
  if (current >= maxPage - 2) {
    [maxPage - 3, maxPage - 2, maxPage - 1].forEach((page) => pages.add(page));
  }

  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= maxPage)
    .sort((a, b) => a - b);
  const result: PageWindowEntry[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  });
  return result;
}

const STEP_CLASS_NAME =
  "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-sm sm:h-10 sm:px-3 text-ink-100 transition-colors hover:border-ink-700";

function StepLink({
  params,
  page,
  disabled,
  direction,
  children,
}: {
  params: BrowseParams;
  page: number;
  disabled: boolean;
  direction: "previous" | "next";
  children: ReactNode;
}) {
  const Icon = direction === "previous" ? ChevronLeftIcon : ChevronRightIcon;
  const content = (
    <>
      {direction === "previous" && <Icon aria-hidden className="size-4" />}
      {/* The label is always read out; it only shows from `sm` up. */}
      <span className="sr-only sm:not-sr-only">{children}</span>
      {direction === "next" && <Icon aria-hidden className="size-4" />}
    </>
  );

  if (disabled) {
    return (
      // Dimmed by colour, not opacity, so the label keeps its contrast.
      <span
        className={cn(
          STEP_CLASS_NAME,
          "pointer-events-none border-ink-800/60 bg-transparent text-muted-foreground",
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      className={STEP_CLASS_NAME}
      href={{ pathname: "/", query: withBrowseParams(params, { page }) }}
    >
      {content}
    </Link>
  );
}

export function PaginationLinks({
  params,
  totalPages,
  totalItems,
  pageSize,
}: PaginationLinksProps) {
  const t = useTranslations("Search");
  const maxPage = Math.min(totalPages, MAX_PAGE);

  if (maxPage <= 1) {
    return null;
  }

  const current = Math.min(params.page, maxPage);
  const pageWindow = buildPageWindow(current, maxPage);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(totalItems, current * pageSize);

  return (
    <nav
      aria-label={t("paginationNavLabel")}
      className="flex flex-col items-center gap-5 border-t border-border pt-8 sm:flex-row sm:justify-between"
    >
      <p className="order-2 text-sm text-muted-foreground sm:order-1">
        {t.rich("paginationRange", {
          from,
          to,
          total: totalItems,
          number: (chunks) => (
            <span className="font-mono text-ink-100 tabular-nums">
              {chunks}
            </span>
          ),
        })}
      </p>

      <div className="order-1 flex items-center gap-1 sm:order-2 sm:gap-1.5">
        <StepLink
          direction="previous"
          disabled={current <= 1}
          page={current - 1}
          params={params}
        >
          {t("paginationPrevious")}
        </StepLink>

        <ol className="flex items-center gap-1">
          {pageWindow.map((entry, index) =>
            entry === "ellipsis" ? (
              <li
                aria-hidden
                className="w-6 text-center text-muted-foreground"
                key={`ellipsis-${index}`}
              >
                …
              </li>
            ) : (
              <li key={entry}>
                <Link
                  aria-current={entry === current ? "page" : undefined}
                  className={cn(
                    "grid h-9 min-w-9 place-items-center rounded-xl px-2 font-mono sm:h-10 sm:min-w-10 text-sm tabular-nums transition-colors",
                    entry === current
                      ? "bg-primary font-medium text-primary-foreground"
                      : "text-ink-300 hover:bg-ink-850 hover:text-ink-50",
                  )}
                  href={{
                    pathname: "/",
                    query: withBrowseParams(params, { page: entry }),
                  }}
                >
                  {entry}
                </Link>
              </li>
            ),
          )}
        </ol>

        <StepLink
          direction="next"
          disabled={current >= maxPage}
          page={current + 1}
          params={params}
        >
          {t("paginationNext")}
        </StepLink>
      </div>

      <span className="sr-only" role="status">
        {t("paginationStatus", { page: current, totalPages: maxPage })}
      </span>
    </nav>
  );
}
