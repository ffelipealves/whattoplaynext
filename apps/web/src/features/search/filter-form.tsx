"use client";

import { useId, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type {
  CatalogOption,
  FilterMetadata,
} from "@/features/catalog/get-filter-metadata";
import { Link, useRouter } from "@/i18n/navigation";

import { activeFilters } from "./active-filters";
import {
  DEFAULT_DURATION_KIND,
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

const DURATION_KIND_LABEL_KEYS: Record<DurationKind, string> = {
  fast: "durationKindFast",
  normal: "durationKindNormal",
  completionist: "durationKindCompletionist",
};

type IdField = "platformIds" | "genreIds" | "gameModeIds";

/**
 * The draft the visitor is editing. Ids stay as string arrays and the numeric
 * inputs stay as strings so a half-typed value is never coerced into a
 * criterion; both are converted only once Apply passes validation.
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
   * Pins the actions to the bottom of a scrolling host, so Apply and Clear all
   * stay reachable inside the drawer without scrolling past every group.
   */
  stickyActions?: boolean;
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

function FieldLegend({ children }: { children: string }) {
  return (
    <legend className="text-sm font-semibold text-[#17203a]">{children}</legend>
  );
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: string;
  htmlFor: string;
}) {
  return (
    <label
      className="block text-xs font-semibold text-[#17203a]/60"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

function ErrorMessage({ children, id }: { children: string; id: string }) {
  return (
    <p
      className="text-xs font-semibold text-[var(--danger)]"
      id={id}
      role="alert"
    >
      {children}
    </p>
  );
}

function CheckboxGroup({
  idPrefix,
  legend,
  name,
  onToggle,
  options,
  scrollable,
  selected,
}: {
  idPrefix: string;
  legend: string;
  name: string;
  onToggle: (id: string, checked: boolean) => void;
  options: CatalogOption[];
  scrollable?: boolean;
  selected: string[];
}) {
  return (
    <fieldset>
      <FieldLegend>{legend}</FieldLegend>
      <div
        className={
          scrollable
            ? "mt-3 max-h-52 space-y-2.5 overflow-y-auto pr-1"
            : "mt-3 space-y-2.5"
        }
      >
        {options.map((option) => {
          const inputId = `${idPrefix}-${option.id}`;
          return (
            <div className="flex items-center gap-2.5" key={option.id}>
              <Checkbox
                checked={selected.includes(option.id)}
                id={inputId}
                name={name}
                onCheckedChange={(checked) =>
                  onToggle(option.id, checked === true)
                }
                value={option.id}
              />
              <label className="text-sm text-[#17203a]/80" htmlFor={inputId}>
                {/* Option labels come from the catalog, not from the message
                    catalog: provider text is never machine-translated. */}
                {option.label}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FilterForm({
  params,
  metadata,
  onApplied,
  stickyActions,
}: FilterFormProps) {
  const t = useTranslations("Filters");
  const router = useRouter();
  const [isApplying, startTransition] = useTransition();
  const formId = useId();
  const {
    control,
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setValue,
  } = useForm<FilterFormValues>({ defaultValues: draftFrom(params) });

  const { minimumDurationHours, maximumDurationHours } = metadata.limits;
  const outOfBoundsMessage = t("invalidDurationBound", {
    minimum: minimumDurationHours,
    maximum: maximumDurationHours,
  });
  const boundRules = {
    min: { value: minimumDurationHours, message: outOfBoundsMessage },
    max: { value: maximumDurationHours, message: outOfBoundsMessage },
  };

  // `useWatch` rather than `watch()`: the latter hands back a fresh function on
  // every render, which makes React Compiler skip memoizing this component.
  const selected: Record<IdField, string[]> = {
    platformIds: useWatch({ control, name: "platformIds" }),
    genreIds: useWatch({ control, name: "genreIds" }),
    gameModeIds: useWatch({ control, name: "gameModeIds" }),
  };
  const minimumRating = useWatch({ control, name: "minimumRating" });
  const durationKind = useWatch({ control, name: "durationKind" });
  const hasAppliedFilters = activeFilters(params).length > 0;

  const releaseErrorId = `${formId}-release-error`;
  const durationErrorId = `${formId}-duration-error`;
  const releaseError = errors.releaseFrom?.message;
  const durationError =
    errors.minimumDurationHours?.message ??
    errors.maximumDurationHours?.message;

  function toggle(field: IdField) {
    return (id: string, checked: boolean) =>
      setValue(field, toggled(selected[field], id, checked));
  }

  function apply(values: FilterFormValues) {
    startTransition(() => {
      router.push({
        pathname: "/games",
        // A new filter selection always returns to the first page: the old
        // page number has no meaning against a different result set.
        query: withBrowseParams(params, { ...criteriaFrom(values), page: 1 }),
      });
      onApplied?.();
    });
  }

  return (
    <form
      className="space-y-7"
      // Validation is this form's own, so its messages are localized through
      // next-intl rather than coming from the browser's built-in bubbles (which
      // follow the browser's language, not the app's, and would block submit
      // before react-hook-form ever runs).
      noValidate
      onSubmit={handleSubmit(apply)}
    >
      {/* Every control below carries the API's own param name, and these
          fields carry the criteria the sidebar does not own, so a submit that
          lands before this component hydrates still produces a valid filtered
          URL instead of a broken one. Omitting `page` restarts at page 1,
          exactly as the hydrated path does. */}
      {params.name && <input name="name" type="hidden" value={params.name} />}
      <input name="sort" type="hidden" value={params.sort} />
      <input name="direction" type="hidden" value={params.direction} />

      <CheckboxGroup
        idPrefix={`${formId}-platform`}
        legend={t("platformLegend")}
        name="platform"
        onToggle={toggle("platformIds")}
        options={metadata.platforms}
        selected={selected.platformIds}
      />

      <CheckboxGroup
        idPrefix={`${formId}-genre`}
        legend={t("genreLegend")}
        name="genre"
        onToggle={toggle("genreIds")}
        options={metadata.genres}
        scrollable
        selected={selected.genreIds}
      />

      <CheckboxGroup
        idPrefix={`${formId}-gameMode`}
        legend={t("gameModeLegend")}
        name="gameMode"
        onToggle={toggle("gameModeIds")}
        options={metadata.gameModes}
        selected={selected.gameModeIds}
      />

      <fieldset>
        <FieldLegend>{t("releaseLegend")}</FieldLegend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`${formId}-releaseFrom`}>
              {t("releaseFromLabel")}
            </FieldLabel>
            <Input
              aria-describedby={releaseError ? releaseErrorId : undefined}
              aria-invalid={releaseError ? true : undefined}
              id={`${formId}-releaseFrom`}
              type="date"
              {...register("releaseFrom", {
                validate: (value) =>
                  !value ||
                  !getValues("releaseTo") ||
                  value <= getValues("releaseTo") ||
                  t("invalidReleaseRange"),
              })}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor={`${formId}-releaseTo`}>
              {t("releaseToLabel")}
            </FieldLabel>
            <Input
              aria-describedby={releaseError ? releaseErrorId : undefined}
              aria-invalid={releaseError ? true : undefined}
              id={`${formId}-releaseTo`}
              type="date"
              {...register("releaseTo")}
            />
          </div>
        </div>
        {releaseError && (
          <div className="mt-2">
            <ErrorMessage id={releaseErrorId}>{releaseError}</ErrorMessage>
          </div>
        )}
      </fieldset>

      <fieldset>
        <FieldLegend>{t("ratingLegend")}</FieldLegend>
        <div className="mt-3 space-y-2">
          <Slider
            aria-label={t("ratingSliderLabel")}
            name="minimumRating"
            max={MAX_RATING}
            min={MIN_RATING}
            onValueChange={([value]) => setValue("minimumRating", value)}
            step={RATING_STEP}
            value={[minimumRating]}
          />
          <p className="text-xs font-semibold text-[#17203a]/60">
            {minimumRating > MIN_RATING
              ? t("ratingAtLeast", { value: minimumRating })
              : t("ratingAny")}
          </p>
        </div>
      </fieldset>

      <fieldset>
        <FieldLegend>{t("durationLegend")}</FieldLegend>

        <div className="mt-3 space-y-3">
          <fieldset>
            <legend className="text-xs font-semibold text-[#17203a]/60">
              {t("durationKindLegend")}
            </legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {metadata.durationKinds
                .filter(
                  (kind): kind is DurationKind =>
                    durationKindSchema.safeParse(kind).success,
                )
                .map((kind) => {
                  const inputId = `${formId}-durationKind-${kind}`;
                  return (
                    <div className="flex items-center gap-2" key={kind}>
                      <input
                        checked={durationKind === kind}
                        className="size-4 accent-[#3157d5]"
                        id={inputId}
                        name="durationKind"
                        onChange={() => setValue("durationKind", kind)}
                        type="radio"
                        value={kind}
                      />
                      <label
                        className="text-sm text-[#17203a]/80"
                        htmlFor={inputId}
                      >
                        {t(DURATION_KIND_LABEL_KEYS[kind])}
                      </label>
                    </div>
                  );
                })}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${formId}-minimumDurationHours`}>
                {t("durationMinimumLabel")}
              </FieldLabel>
              <Input
                aria-describedby={durationError ? durationErrorId : undefined}
                aria-invalid={durationError ? true : undefined}
                id={`${formId}-minimumDurationHours`}
                inputMode="numeric"
                max={maximumDurationHours}
                min={minimumDurationHours}
                step={1}
                type="number"
                {...register("minimumDurationHours", {
                  ...boundRules,
                  validate: (value) =>
                    !value ||
                    !getValues("maximumDurationHours") ||
                    Number(value) <=
                      Number(getValues("maximumDurationHours")) ||
                    t("invalidDurationRange"),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <FieldLabel htmlFor={`${formId}-maximumDurationHours`}>
                {t("durationMaximumLabel")}
              </FieldLabel>
              <Input
                aria-describedby={durationError ? durationErrorId : undefined}
                aria-invalid={durationError ? true : undefined}
                id={`${formId}-maximumDurationHours`}
                inputMode="numeric"
                max={maximumDurationHours}
                min={minimumDurationHours}
                step={1}
                type="number"
                {...register("maximumDurationHours", boundRules)}
              />
            </div>
          </div>

          {durationError && (
            <ErrorMessage id={durationErrorId}>{durationError}</ErrorMessage>
          )}
        </div>
      </fieldset>

      <div
        className={cn(
          "flex flex-wrap items-center gap-4",
          stickyActions &&
            "sticky bottom-0 -mx-4 border-t border-[#17203a]/10 bg-popover px-4 py-4",
        )}
      >
        <Button disabled={isApplying} type="submit">
          {isApplying ? t("applyPendingLabel") : t("applyLabel")}
        </Button>
        {hasAppliedFilters && (
          // Clearing everything is a plain navigable URL, like sorting and
          // pagination: it needs no draft state to compute.
          <Link
            className="text-sm font-semibold text-[#3157d5] underline underline-offset-4"
            href={{
              pathname: "/games",
              query: withBrowseParams(params, {
                ...clearedFilters(),
                page: 1,
              }),
            }}
          >
            {t("clearAllLabel")}
          </Link>
        )}
      </div>
    </form>
  );
}
