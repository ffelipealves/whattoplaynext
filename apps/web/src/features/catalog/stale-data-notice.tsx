import { useFormatter, useTranslations } from "next-intl";
import { HistoryIcon } from "lucide-react";

import type { components } from "@whattoplaynext/contracts";

export type FreshnessMeta = Pick<
  components["schemas"]["ResponseMeta"],
  "dataMayBeStale" | "dataAsOf"
>;

type StaleDataNoticeProps = {
  meta: FreshnessMeta;
};

/**
 * Explains a response the API served from its cache because the provider
 * failed.
 *
 * `dataMayBeStale` is the only switch: a fresh cache hit is as current as a
 * provider answer and needs no copy. The save time is shown in UTC because the
 * page renders on the server, where the visitor's time zone is unknown.
 */
export function StaleDataNotice({ meta }: StaleDataNoticeProps) {
  const t = useTranslations("Freshness");
  const format = useFormatter();

  if (!meta.dataMayBeStale) {
    return null;
  }

  const dataAsOf = meta.dataAsOf;

  return (
    <p
      className="flex items-start gap-2 rounded-xl bg-[#fdf1d8] px-4 py-3 text-sm font-semibold text-[#17203a]/80"
      role="note"
    >
      <HistoryIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        {dataAsOf
          ? t.rich("staleWithDate", {
              savedAt: format.dateTime(new Date(dataAsOf), {
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                month: "long",
                timeZone: "UTC",
                timeZoneName: "short",
                year: "numeric",
              }),
              time: (chunks) => <time dateTime={dataAsOf}>{chunks}</time>,
            })
          : t("staleWithoutDate")}
      </span>
    </p>
  );
}
