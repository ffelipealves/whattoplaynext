import { useTranslations } from "next-intl";
import { InfoIcon } from "lucide-react";

import type { GamePage } from "./get-search-results";

type DurationNoticeProps = {
  meta: GamePage["meta"];
};

/**
 * Explains a result set that a duration bound narrowed.
 *
 * The API sets `excludedUnknownDuration` only when a duration filter actually
 * removed games whose play time IGDB does not record, so that flag — not a
 * second guess at the criteria — decides whether this copy appears. It keeps
 * "missing data stays missing" visible rather than letting those games
 * disappear silently.
 */
export function DurationNotice({ meta }: DurationNoticeProps) {
  const t = useTranslations("Filters");

  if (!meta.excludedUnknownDuration) {
    return null;
  }

  return (
    <p className="flex items-start gap-2 rounded-xl bg-[#dce6fb]/50 px-4 py-3 text-xs font-semibold text-[#17203a]/75">
      <InfoIcon aria-hidden className="mt-px size-4 shrink-0" />
      {t("excludedUnknownDuration")}
    </p>
  );
}
