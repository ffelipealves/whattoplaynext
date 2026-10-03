import * as React from "react";
import { cn } from "cn";

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-ink-700 bg-ink-850 px-1.5 font-mono text-[11px] leading-none text-ink-300",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
