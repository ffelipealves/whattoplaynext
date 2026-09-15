"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
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
      <SheetContent className="overflow-y-auto" side="left">
        <SheetHeader>
          <SheetTitle>{t("heading")}</SheetTitle>
          <SheetDescription>{t("drawerDescription")}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-8">
          {filters.ok ? (
            <FilterForm
              key={filterSignature(params)}
              metadata={filters.metadata}
              onApplied={() => setIsOpen(false)}
              params={params}
              stickyActions
            />
          ) : (
            <FiltersUnavailable failure={filters.failure} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
