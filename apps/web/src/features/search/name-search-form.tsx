import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { BrowseParams } from "./browse-params";

type NameSearchFormProps = {
  params: BrowseParams;
};

export function NameSearchForm({ params }: NameSearchFormProps) {
  const t = useTranslations("Search");

  return (
    <form action="" className="flex gap-2">
      {/* Preserve sort/direction; a new name search intentionally resets
          to page 1 by omitting a page field. */}
      <input name="sort" type="hidden" value={params.sort} />
      <input name="direction" type="hidden" value={params.direction} />
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
