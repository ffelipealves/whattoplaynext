"use client";

import { useId, useTransition, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { RotateCcwIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import type {
  CatalogOption,
  FilterMetadata,
} from "@/features/catalog/get-filter-metadata";
import { Link, useRouter } from "@/i18n/navigation";
import { markSearchSubmitted } from "@/features/analytics/track";

import { activeFilters } from "./active-filters";
import {
  DEFAULT_DURATION_KIND,
  DEFAULT_VIEW,
  MIN_RATING,
  MAX_RATING,
  clearedFilters,
  durationKindSchema,
  withBrowseParams,
  type BrowseParams,
  type DurationKind,
  type FilterCriteria,
} from "./browse-params";

const RATING_STEP = 5;
const RATING_PRESETS = [75, 85, 90] as const;

/**
 * The release slider's span. Its ends mean "no bound": the catalog's current
 * platforms hold nothing older than 1970, and nothing past this year is out.
 */
const FIRST_YEAR = 1970;
const LAST_YEAR = new Date().getUTCFullYear();

/**
 * Play time is spread over orders of magnitude, so the slider steps through
 * these hours rather than a linear 1–1000: a few hours apart near the bottom,
 * where the choices matter, and hundreds apart at the top.
 */
const DURATION_STOPS = [
  1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150, 200,
  300,
];

const DURATION_KIND_LABEL_KEYS: Record<DurationKind, string> = {
  fast: "durationKindFast",
  normal: "durationKindNormal",
  completionist: "durationKindCompletionist",
};

/** The id lists this form edits. Genres are picked from the chip row above
 * the results instead, and only ride along in the draft. */
type IdField = "platformIds" | "gameModeIds";

/**
 * The draft the visitor is editing. Dates and hours stay as the strings the
 * URL carries, so a value the sliders cannot land on exactly (a shared link's
 * 2015-03-10, say) survives untouched until the visitor moves that thumb.
 */
type FilterFormValues = {
  platformIds: string[];
  genreIds: string[];
  gameModeIds: string[];
  releaseFrom: string;
  releaseTo: string;
  minimumRating: number;
  durationKind: DurationKind;
  minimumDurationHours: string;
  maximumDurationHours: string;
};

type FilterFormProps = {
  params: BrowseParams;
  metadata: FilterMetadata;
  /** Lets a host (the mobile drawer) close itself once Apply navigates. */
  onApplied?: () => void;
  /**
   * Where the form sits. The sidebar pins its actions to the bottom of its
   * own scroll; the drawer gives them a footer outside the scrolling groups.
   * Either way Apply and Clear all stay reachable without scrolling.
   */
  layout?: "sidebar" | "drawer";
};

function draftFrom(params: BrowseParams): FilterFormValues {
  return {
    platformIds: params.platformIds,
    genreIds: params.genreIds,
    gameModeIds: params.gameModeIds,
    releaseFrom: params.releaseFrom ?? "",
    releaseTo: params.releaseTo ?? "",
    minimumRating: params.minimumRating ?? MIN_RATING,
    durationKind: params.durationKind,
    minimumDurationHours:
      params.minimumDurationHours === undefined
        ? ""
        : String(params.minimumDurationHours),
    maximumDurationHours:
      params.maximumDurationHours === undefined
        ? ""
        : String(params.maximumDurationHours),
  };
}

function toggled(ids: string[], id: string, checked: boolean): string[] {
  return checked ? [...ids, id] : ids.filter((current) => current !== id);
}

function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

function criteriaFrom(values: FilterFormValues): FilterCriteria {
  const minimumDurationHours = optionalNumber(values.minimumDurationHours);
  const maximumDurationHours = optionalNumber(values.maximumDurationHours);
  const hasDurationBound =
    minimumDurationHours !== undefined || maximumDurationHours !== undefined;

  return {
    platformIds: values.platformIds,
    genreIds: values.genreIds,
    gameModeIds: values.gameModeIds,
    releaseFrom: values.releaseFrom || undefined,
    releaseTo: values.releaseTo || undefined,
    // A zero minimum excludes nothing, so it is an unset filter.
    minimumRating:
      values.minimumRating > MIN_RATING ? values.minimumRating : undefined,
    // The kind only qualifies a bound; on its own it would be an invisible
    // criterion with no chip to remove it.
    durationKind: hasDurationBound
      ? values.durationKind
      : DEFAULT_DURATION_KIND,
    minimumDurationHours,
    maximumDurationHours,
  };
}

function yearOf(date: string): number | undefined {
  return date ? Number(date.slice(0, 4)) : undefined;
}

/** The stop closest to `hours`, as a slider position (stops start at 1). */
function positionOf(stops: number[], hours: number): number {
  let best = 0;
  stops.forEach((stop, index) => {
    if (Math.abs(stop - hours) < Math.abs(stops[best] - hours)) {
      best = index;
    }
  });
  return best + 1;
}

/**
 * One group of the panel. The divider lives on a wrapper, not the fieldset,
 * whose border a legend would otherwise sit inside. The aside (a current
 * value, a reset) shares the legend's line without being inside it, so it
 * never joins the group's name.
 */
function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="group/section relative border-t border-border py-5 first:border-t-0 first:pt-0">
      <fieldset>
        <legend className="mb-3 text-xs leading-4 font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {title}
        </legend>
        {children}
      </fieldset>
      {aside && (
        <div className="absolute top-5 right-0 flex h-4 items-center group-first/section:top-0">
          {aside}
        </div>
      )}
    </div>
  );
}

function CheckboxGroup({
  idPrefix,
  name,
  onToggle,
  options,
  selected,
}: {
  idPrefix: string;
  name: string;
  onToggle: (id: string, checked: boolean) => void;
  options: CatalogOption[];
  selected: string[];
}) {
  return (
    <div className="space-y-0.5">
      {options.map((option) => {
        const inputId = `${idPrefix}-${option.id}`;
        return (
          <div
            className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-ink-850"
            key={option.id}
          >
            <Checkbox
              checked={selected.includes(option.id)}
              id={inputId}
              name={name}
              onCheckedChange={(checked) =>
                onToggle(option.id, checked === true)
              }
              value={option.id}
            />
            <label
              className="flex-1 cursor-pointer text-sm text-ink-100"
              htmlFor={inputId}
            >
              {/* Option labels come from the catalog, not from the message
                  catalog: provider text is never machine-translated. */}
              {option.label}
            </label>
          </div>
        );
      })}
    </div>
  );
}

export function FilterForm({
  params,
  metadata,
  onApplied,
  layout = "sidebar",
}: FilterFormProps) {
  const t = useTranslations("Filters");
  const router = useRouter();
  const [isApplying, startTransition] = useTransition();
  const formId = useId();
  const { control, handleSubmit, setValue } = useForm<FilterFormValues>({
    defaultValues: draftFrom(params),
  });

  // `useWatch` rather than `watch()`: the latter hands back a fresh function on
  // every render, which makes React Compiler skip memoizing this component.
  const selected: Record<IdField, string[]> = {
    platformIds: useWatch({ control, name: "platformIds" }),
    gameModeIds: useWatch({ control, name: "gameModeIds" }),
  };
  const minimumRating = useWatch({ control, name: "minimumRating" });
  const releaseFrom = useWatch({ control, name: "releaseFrom" });
  const releaseTo = useWatch({ control, name: "releaseTo" });
  const durationKind = useWatch({ control, name: "durationKind" });
  const minimumHours = useWatch({ control, name: "minimumDurationHours" });
  const maximumHours = useWatch({ control, name: "maximumDurationHours" });
  const hasAppliedFilters = activeFilters(params).length > 0;

  const fromYear = yearOf(releaseFrom) ?? FIRST_YEAR;
  const toYear = yearOf(releaseTo) ?? LAST_YEAR;

  const durationStops = DURATION_STOPS.filter(
    (hours) =>
      hours >= metadata.limits.minimumDurationHours &&
      hours <= metadata.limits.maximumDurationHours,
  );
  // Position 0 is "no minimum" and the last is "no maximum"; the stops sit
  // between them.
  const noMaximumPosition = durationStops.length + 1;
  const minimumPosition = minimumHours
    ? positionOf(durationStops, Number(minimumHours))
    : 0;
  const maximumPosition = maximumHours
    ? positionOf(durationStops, Number(maximumHours))
    : noMaximumPosition;

  function toggle(field: IdField) {
    return (id: string, checked: boolean) =>
      setValue(field, toggled(selected[field], id, checked));
  }

  function moveRelease([from, to]: number[]) {
    // Only the thumb that moved is rewritten, so an exact date on the other
    // end survives.
    if (from !== fromYear) {
      setValue("releaseFrom", from <= FIRST_YEAR ? "" : `${from}-01-01`);
    }
    if (to !== toYear) {
      setValue("releaseTo", to >= LAST_YEAR ? "" : `${to}-12-31`);
    }
  }

  function moveDuration([from, to]: number[]) {
    if (from !== minimumPosition) {
      setValue(
        "minimumDurationHours",
        from === 0 ? "" : String(durationStops[from - 1]),
      );
    }
    if (to !== maximumPosition) {
      setValue(
        "maximumDurationHours",
        to === noMaximumPosition ? "" : String(durationStops[to - 1]),
      );
    }
  }

  function durationSummary(): string {
    if (minimumHours && maximumHours) {
      return t("durationRangeBoth", {
        minimum: Number(minimumHours),
        maximum: Number(maximumHours),
      });
    }
    if (minimumHours) {
      return t("durationRangeMinimum", { minimum: Number(minimumHours) });
    }
    if (maximumHours) {
      return t("durationRangeMaximum", { maximum: Number(maximumHours) });
    }
    return t("durationAny");
  }

  function apply(values: FilterFormValues) {
    markSearchSubmitted();
    startTransition(() => {
      router.push({
        pathname: "/",
        // A new filter selection always returns to the first page: the old
        // page number has no meaning against a different result set.
        query: withBrowseParams(params, { ...criteriaFrom(values), page: 1 }),
      });
      onApplied?.();
    });
  }

  const fields = (
    <>
      <Section title={t("platformLegend")}>
        <CheckboxGroup
          idPrefix={`${formId}-platform`}
          name="platform"
          onToggle={toggle("platformIds")}
          options={metadata.platforms}
          selected={selected.platformIds}
        />
      </Section>

      <Section title={t("gameModeLegend")}>
        <CheckboxGroup
          idPrefix={`${formId}-gameMode`}
          name="gameMode"
          onToggle={toggle("gameModeIds")}
          options={metadata.gameModes}
          selected={selected.gameModeIds}
        />
      </Section>

      <Section
        aside={
          <span className="font-mono text-sm text-ink-100 tabular-nums">
            {minimumRating > MIN_RATING
              ? t("ratingAtLeast", { value: minimumRating })
              : t("ratingAny")}
          </span>
        }
        title={t("ratingLegend")}
      >
        <Slider
          aria-label={t("ratingSliderLabel")}
          max={MAX_RATING}
          min={MIN_RATING}
          name="minimumRating"
          onValueChange={([value]) => setValue("minimumRating", value)}
          step={RATING_STEP}
          value={[minimumRating]}
        />
        <div
          aria-label={t("ratingPresetsLabel")}
          className="mt-3 flex gap-1.5"
          role="group"
        >
          {RATING_PRESETS.map((preset) => (
            <button
              aria-pressed={minimumRating === preset}
              className={cn(
                "flex-1 rounded-md border py-1 font-mono text-xs transition-colors",
                minimumRating === preset
                  ? "border-primary text-ember-300"
                  : "border-ink-700 text-ink-300 hover:border-ink-600 hover:text-ink-100",
              )}
              key={preset}
              onClick={() =>
                setValue(
                  "minimumRating",
                  minimumRating === preset ? MIN_RATING : preset,
                )
              }
              type="button"
            >
              {preset}+
            </button>
          ))}
        </div>
      </Section>

      <Section
        aside={
          (releaseFrom || releaseTo) && (
            <button
              className="text-xs text-muted-foreground hover:text-ember-300"
              onClick={() => {
                setValue("releaseFrom", "");
                setValue("releaseTo", "");
              }}
              type="button"
            >
              {t("resetLabel")}
            </button>
          )
        }
        title={t("releaseLegend")}
      >
        <Slider
          max={LAST_YEAR}
          min={FIRST_YEAR}
          minStepsBetweenThumbs={0}
          onValueChange={moveRelease}
          step={1}
          thumbLabels={[t("releaseFromLabel"), t("releaseToLabel")]}
          value={[fromYear, toYear]}
        />
        <div className="mt-2 flex justify-between font-mono text-sm text-ink-300 tabular-nums">
          <span>{fromYear}</span>
          <span>{toYear}</span>
        </div>
      </Section>

      <Section
        aside={
          <span className="font-mono text-sm text-ink-100 tabular-nums">
            {durationSummary()}
          </span>
        }
        title={t("durationLegend")}
      >
        <fieldset>
          <legend className="mb-2 text-xs text-muted-foreground">
            {t("durationKindLegend")}
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {metadata.durationKinds
              .filter(
                (kind): kind is DurationKind =>
                  durationKindSchema.safeParse(kind).success,
              )
              .map((kind) => (
                <label
                  className={cn(
                    "cursor-pointer rounded-lg border px-2.5 py-1 text-[0.8125rem] transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
                    durationKind === kind
                      ? "border-primary bg-primary/10 font-medium text-ember-300"
                      : "border-ink-700 text-ink-300 hover:border-ink-600 hover:text-ink-100",
                  )}
                  key={kind}
                >
                  <input
                    checked={durationKind === kind}
                    className="sr-only"
                    name="durationKind"
                    onChange={() => setValue("durationKind", kind)}
                    type="radio"
                    value={kind}
                  />
                  {t(DURATION_KIND_LABEL_KEYS[kind])}
                </label>
              ))}
          </div>
        </fieldset>

        <div className="mt-5">
          <Slider
            getValueText={(position, index) =>
              index === 0
                ? position === 0
                  ? t("durationNoMinimum")
                  : t("durationHoursValue", {
                      hours: durationStops[position - 1],
                    })
                : position === noMaximumPosition
                  ? t("durationNoMaximum")
                  : t("durationHoursValue", {
                      hours: durationStops[position - 1],
                    })
            }
            max={noMaximumPosition}
            min={0}
            minStepsBetweenThumbs={1}
            onValueChange={moveDuration}
            step={1}
            thumbLabels={[t("durationMinimumLabel"), t("durationMaximumLabel")]}
            value={[minimumPosition, maximumPosition]}
          />
        </div>
      </Section>
    </>
  );

  const actions = (
    <>
      {hasAppliedFilters && (
        // Clearing everything is a plain navigable URL, like sorting and
        // pagination: it needs no draft state to compute.
        <Link
          className={buttonVariants({
            // The sidebar is too narrow for two buttons side by side.
            className: layout === "sidebar" ? "order-last" : undefined,
            variant: layout === "sidebar" ? "ghost" : "outline",
          })}
          href={{
            pathname: "/",
            query: withBrowseParams(params, {
              ...clearedFilters(),
              page: 1,
            }),
          }}
        >
          <RotateCcwIcon aria-hidden />
          {t("clearAllLabel")}
        </Link>
      )}
      <Button
        className={cn(layout === "drawer" && "flex-1")}
        disabled={isApplying}
        type="submit"
      >
        {isApplying ? t("applyPendingLabel") : t("applyLabel")}
      </Button>
    </>
  );

  return (
    <form
      className={cn(layout === "drawer" && "flex min-h-0 flex-1 flex-col")}
      // Nothing here can hold an invalid value — the sliders and boxes only
      // offer valid ones — so the browser's own validation has nothing to do.
      noValidate
      onSubmit={handleSubmit(apply)}
    >
      {/* Every control below carries the API's own param name, and these
          fields carry the criteria the panel does not edit directly or keeps
          as text, so a submit that lands before this component hydrates
          still produces a valid filtered URL instead of a broken one.
          Omitting `page` restarts at page 1, exactly as the hydrated path
          does. */}
      {params.name && <input name="name" type="hidden" value={params.name} />}
      <input name="sort" type="hidden" value={params.sort} />
      <input name="direction" type="hidden" value={params.direction} />
      {params.view !== DEFAULT_VIEW && (
        <input name="view" type="hidden" value={params.view} />
      )}
      {params.genreIds.map((id) => (
        <input key={id} name="genre" type="hidden" value={id} />
      ))}
      {releaseFrom && (
        <input name="releaseFrom" type="hidden" value={releaseFrom} />
      )}
      {releaseTo && <input name="releaseTo" type="hidden" value={releaseTo} />}
      {minimumHours && (
        <input name="minimumDurationHours" type="hidden" value={minimumHours} />
      )}
      {maximumHours && (
        <input name="maximumDurationHours" type="hidden" value={maximumHours} />
      )}

      {layout === "drawer" ? (
        <>
          <div
            className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-5"
            data-slot="filter-fields"
          >
            {fields}
          </div>
          <div className="flex gap-3 border-t border-border p-4">{actions}</div>
        </>
      ) : (
        <>
          {fields}
          <div className="sticky bottom-0 flex flex-col gap-1 border-t border-border bg-background pt-4 pb-1">
            {actions}
          </div>
        </>
      )}
    </form>
  );
}
