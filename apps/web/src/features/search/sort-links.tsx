import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import {
  defaultDirectionFor,
  withBrowseParams,
  type BrowseParams,
  type SortOption,
} from "./browse-params";

const SORT_OPTIONS: readonly SortOption[] = [
  "popularity",
  "rating",
  "release-date",
  "duration",
  "title",
];

const LABEL_KEYS: Record<SortOption, string> = {
  popularity: "sortPopularity",
  rating: "sortRating",
  "release-date": "sortReleaseDate",
  duration: "sortDuration",
  title: "sortTitle",
};

type SortLinksProps = {
  params: BrowseParams;
};

export function SortLinks({ params }: SortLinksProps) {
  const t = useTranslations("Search");

  return (
    <nav aria-label={t("sortNavLabel")} className="flex flex-wrap gap-2">
      {SORT_OPTIONS.map((option) => {
        const isActive = option === params.sort;
        return (
          <Link
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "rounded-full bg-[#17203a] px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-[#17203a]/20 px-4 py-2 text-sm font-semibold text-[#17203a] transition-colors hover:border-[#3157d5] hover:bg-[#dce6fb]/50"
            }
            href={{
              pathname: "/games",
              query: withBrowseParams(params, {
                sort: option,
                direction: defaultDirectionFor(option),
                page: 1,
              }),
            }}
            key={option}
          >
            {t(LABEL_KEYS[option])}
          </Link>
        );
      })}
    </nav>
  );
}
