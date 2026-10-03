"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { activeFilters } from "./active-filters";
import { filterSignature } from "./browse-params";
import { FilterForm } from "./filter-form";
import { FiltersUnavailable, type FilterPanelProps } from "./filter-sidebar";

/**
 * The mobile layout: the same controls as the sidebar, behind a trigger that
 * reports how many filters are currently applied. Only the open/closed state
 * lives here; the criteria still live in the URL.
 */
export function FilterDrawer({ filters, params }: FilterPanelProps) {
  const t = useTranslations("Filters");
  const [isOpen, setIsOpen] = useState(false);
  const appliedCount = activeFilters(params).length;

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger asChild>
        <Button className="lg:hidden" variant="outline">
          <SlidersHorizontalIcon aria-hidden />
          {appliedCount > 0
            ? t("openLabelWithCount", { count: appliedCount })
            : t("openLabel")}
        </Button>
      </SheetTrigger>
      <SheetContent
        className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-sm"
        showCloseButton={false}
        side="right"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-border px-5 py-4">
          <SheetTitle>{t("heading")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("drawerDescription")}
          </SheetDescription>
          <SheetClose asChild>
            <Button aria-label={t("closeLabel")} size="icon" variant="ghost">
              <XIcon aria-hidden className="size-5" />
            </Button>
          </SheetClose>
        </SheetHeader>
        {filters.ok ? (
          <FilterForm
            key={filterSignature(params)}
            layout="drawer"
            metadata={filters.metadata}
            onApplied={() => setIsOpen(false)}
            params={params}
          />
        ) : (
          <div className="p-5">
            <FiltersUnavailable failure={filters.failure} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
