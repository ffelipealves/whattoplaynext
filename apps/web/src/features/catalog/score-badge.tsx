import { cn } from "@/lib/utils";

type RatingTone = "good" | "mid" | "low";

/**
 * IGDB's combined rating runs lower than critic aggregates, so the bands sit
 * lower than a metascore's would: most well-liked games land in the 70s and
 * 80s, and only the acclaimed ones clear 85.
 */
export function ratingTone(value: number): RatingTone {
  if (value >= 85) {
    return "good";
  }
  return value >= 70 ? "mid" : "low";
}

const TONE_CLASS_NAMES: Record<RatingTone, string> = {
  good: "text-good ring-good/40",
  mid: "text-mid ring-mid/40",
  low: "text-low ring-low/40",
};

const SIZE_CLASS_NAMES = {
  sm: "h-6 min-w-7 px-1 text-xs",
  md: "h-7 min-w-8 px-1.5 text-sm",
  lg: "h-11 min-w-12 px-2 text-xl",
} as const;

type ScoreBadgeProps = {
  value: number;
  /** What the number means, for assistive technology ("Rating 92 of 100"). */
  label: string;
  size?: keyof typeof SIZE_CLASS_NAMES;
  className?: string;
};

/**
 * A rating as a toned number. The surface is near-opaque ink so it stays
 * legible over a cover image as well as on a panel.
 */
export function ScoreBadge({
  value,
  label,
  size = "md",
  className,
}: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        "inline-grid place-items-center rounded-md bg-ink-950/80 font-mono font-medium tabular-nums ring-1 backdrop-blur-sm ring-inset",
        TONE_CLASS_NAMES[ratingTone(value)],
        SIZE_CLASS_NAMES[size],
        className,
      )}
      title={label}
    >
      <span aria-hidden>{Math.round(value)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
