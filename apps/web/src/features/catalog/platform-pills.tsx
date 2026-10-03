import type { CatalogOption } from "./get-filter-metadata";

/** Compact codes for the platforms the catalog allows; anything else keeps its label. */
const SHORT_LABELS: Record<string, string> = {
  pc: "PC",
  "playstation-4": "PS4",
  "playstation-5": "PS5",
  "xbox-one": "XB1",
  "xbox-series-x-s": "XSX",
  "nintendo-switch": "NS",
};

type PlatformPillsProps = {
  platforms: CatalogOption[];
  /** Names the list ("Platforms"). */
  label: string;
  /** Spells every platform out instead of using the compact codes. */
  full?: boolean;
};

export function PlatformPills({ platforms, label, full }: PlatformPillsProps) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1">
      {platforms.map((platform) => {
        const shown = full
          ? platform.label
          : (SHORT_LABELS[platform.id] ?? platform.label);
        return (
          <li
            className="rounded border border-ink-700 px-1.5 py-px font-mono text-[10px] font-medium tracking-wide text-ink-300"
            key={platform.id}
            title={platform.label}
          >
            {shown === platform.label ? (
              shown
            ) : (
              // The code is for the eye; assistive technology hears the name.
              <>
                <span aria-hidden>{shown}</span>
                <span className="sr-only">{platform.label}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
