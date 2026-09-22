type GameImagePlaceholderProps = {
  height: number;
  label: string;
  message: string;
  width: number;
};

export function GameImagePlaceholder({
  height,
  label,
  message,
  width,
}: GameImagePlaceholderProps) {
  return (
    <div
      aria-label={label}
      className="flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[inherit] bg-[linear-gradient(145deg,#dce6fb,#edf2ff)] px-5 text-center text-[#17203a]/75"
      role="img"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <svg
        aria-hidden="true"
        className="h-auto w-20 text-[#3157d5]/35"
        fill="none"
        viewBox="0 0 96 72"
      >
        <path
          d="M9 55 31 32l13 13 12-12 31 31H9Z"
          fill="currentColor"
          opacity=".45"
        />
        <path
          d="m9 55 22-23 13 13 12-12 31 31M9 64h78"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <circle cx="70" cy="18" r="8" fill="currentColor" />
      </svg>
      <span aria-hidden="true" className="text-sm font-semibold">
        {message}
      </span>
    </div>
  );
}
