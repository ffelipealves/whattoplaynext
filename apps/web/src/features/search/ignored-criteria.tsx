import { useTranslations } from "next-intl";

import type { BrowseParamIssue } from "./browse-params";

const LABELS: Record<BrowseParamIssue, string> = {
  name: "ignoredName",
  sort: "ignoredSort",
  direction: "ignoredDirection",
  page: "ignoredPage",
  platform: "ignoredPlatform",
  genre: "ignoredGenre",
  gameMode: "ignoredGameMode",
  release: "ignoredRelease",
  rating: "ignoredRating",
  duration: "ignoredDuration",
};

type IgnoredCriteriaProps = {
  issues: BrowseParamIssue[];
};

/**
 * Says which criteria a shared or hand-edited link asked for that this search
 * could not honour.
 *
 * The search still ran with what was left, so this is a status rather than an
 * alert — but saying nothing would leave the URL claiming one search while the
 * results answer another, and would send an obviously invalid value to the API
 * just to be told the same thing a round trip later.
 */
export function IgnoredCriteria({ issues }: IgnoredCriteriaProps) {
  const t = useTranslations("Failure");

  if (issues.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-xl border border-[#ff694f]/35 bg-[#ff694f]/5 px-4 py-3"
      role="status"
    >
      <p className="text-sm font-semibold text-[#17203a]">
        {t("ignoredTitle")}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[#17203a]/75">
        {issues.map((issue) => (
          <li key={issue}>{t(LABELS[issue])}</li>
        ))}
      </ul>
    </div>
  );
}
