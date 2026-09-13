import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { withBrowseParams, type BrowseParams } from "./browse-params";

type NameSearchFormProps = {
  params: BrowseParams;
};

/**
 * Every criterion except the name itself, as hidden fields. Building them from
 * `withBrowseParams` keeps this native GET form producing the same URL shape as
 * the sort, pagination, and chip links — including one repeated field per
 * selected id — so typing a name narrows the applied filters instead of
 * silently dropping them.
 */
function preservedFields(params: BrowseParams): [string, string][] {
  const query = withBrowseParams(params, {});
  // The name comes from the visible field, and omitting `page` is what makes a
  // new name search restart at page 1.
  delete query.name;
  delete query.page;

  return Object.entries(query).flatMap(([name, value]) =>
    Array.isArray(value)
      ? value.map((entry): [string, string] => [name, entry])
      : [[name, value] as [string, string]],
  );
}

export function NameSearchForm({ params }: NameSearchFormProps) {
  const t = useTranslations("Search");

  return (
    <form action="" className="flex gap-2">
      {preservedFields(params).map(([name, value]) => (
        <input
          key={`${name}-${value}`}
          name={name}
          type="hidden"
          value={value}
        />
      ))}
      <label className="sr-only" htmlFor="name">
        {t("nameInputLabel")}
      </label>
      <Input
        defaultValue={params.name}
        id="name"
        name="name"
        placeholder={t("nameInputPlaceholder")}
        type="search"
      />
      <Button type="submit">{t("searchButton")}</Button>
    </form>
  );
}
