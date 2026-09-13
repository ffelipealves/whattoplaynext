import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { MAX_PAGE, withBrowseParams, type BrowseParams } from "./browse-params";

type PaginationLinksProps = {
  params: BrowseParams;
  totalPages: number;
};

type PageWindowEntry = number | "ellipsis";

// The caller never invokes this with maxPage <= 1 (PaginationLinks renders
// nothing in that case), but the set-based logic below already degrades to
// `[1]` in that scenario regardless, so no separate guard is needed here.
function buildPageWindow(current: number, maxPage: number): PageWindowEntry[] {
  const pages = new Set<number>([1, maxPage, current]);
  if (current - 1 >= 1) {
    pages.add(current - 1);
  }
  if (current + 1 <= maxPage) {
    pages.add(current + 1);
  }

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const result: PageWindowEntry[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(page);
  });
  return result;
}

function PageLink({
  params,
  page,
  isActive,
  disabled,
  children,
}: {
  params: BrowseParams;
  page: number;
  isActive?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#17203a]/30">
        {children}
      </span>
    );
  }

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={
        isActive
          ? "rounded-full bg-[#17203a] px-3 py-1.5 text-sm font-semibold text-white"
          : "rounded-full px-3 py-1.5 text-sm font-semibold text-[#17203a] transition-colors hover:bg-[#dce6fb]/50"
      }
      href={{ pathname: "/games", query: withBrowseParams(params, { page }) }}
    >
      {children}
    </Link>
  );
}

export function PaginationLinks({ params, totalPages }: PaginationLinksProps) {
  const t = useTranslations("Search");
  const maxPage = Math.min(totalPages, MAX_PAGE);

  if (maxPage <= 1) {
    return null;
  }

  const current = Math.min(params.page, maxPage);
  const pageWindow = buildPageWindow(current, maxPage);

  return (
    <nav
      aria-label={t("paginationNavLabel")}
      className="flex items-center justify-center gap-1"
    >
      <PageLink disabled={current <= 1} page={current - 1} params={params}>
        {t("paginationPrevious")}
      </PageLink>

      {pageWindow.map((entry, index) =>
        entry === "ellipsis" ? (
          <span
            className="px-2 text-sm text-[#17203a]/45"
            key={`ellipsis-${index}`}
          >
            …
          </span>
        ) : (
          <PageLink
            isActive={entry === current}
            key={entry}
            page={entry}
            params={params}
          >
            {entry}
          </PageLink>
        ),
      )}

      <PageLink
        disabled={current >= maxPage}
        page={current + 1}
        params={params}
      >
        {t("paginationNext")}
      </PageLink>

      <span className="sr-only" role="status">
        {t("paginationStatus", { page: current, totalPages: maxPage })}
      </span>
    </nav>
  );
}
