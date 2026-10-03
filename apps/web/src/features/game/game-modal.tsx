"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { Kbd } from "@/components/ui/kbd";
import {
  useResultNeighbours,
  type SequenceEntry,
} from "@/features/search/result-sequence";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

function hrefFor(entry: SequenceEntry): string {
  return `/games/${entry.id}/${entry.slug}`;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("input, textarea, select, [contenteditable='true']") !== null
  );
}

function StepLink({
  entry,
  direction,
}: {
  entry: SequenceEntry | undefined;
  direction: "previous" | "next";
}) {
  const t = useTranslations("Game");
  const Icon = direction === "previous" ? ChevronLeftIcon : ChevronRightIcon;

  if (!entry) {
    // Keeps the other step in place at either end of the page.
    return <span aria-hidden className="min-w-0 flex-1" />;
  }

  return (
    <Link
      className={cn(
        "group flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-ink-850",
        direction === "next" && "flex-row-reverse text-right",
      )}
      data-analytics-entry="search-result"
      href={hrefFor(entry)}
      // Stepping replaces the open game, so Back closes the modal.
      replace
      scroll={false}
    >
      <Icon
        aria-hidden
        className="size-5 shrink-0 text-muted-foreground group-hover:text-ember-300"
      />
      <span className="min-w-0">
        <span className="block text-[0.6875rem] text-muted-foreground">
          {direction === "previous" ? t("previousGame") : t("nextGame")}
        </span>
        <span className="block truncate font-medium text-ink-100">
          {entry.title}
        </span>
      </span>
    </Link>
  );
}

/**
 * A game opened from the results, over them: the reference's detail dialog.
 * Its URL is the game's own, so a reload or a shared link opens the full page
 * instead. Closing goes back in history, which is also what Back does, and
 * the arrow keys step through the results page it was opened from.
 */
export function GameModal({
  children,
  gameId,
  title,
}: {
  children: ReactNode;
  gameId: number;
  title: string;
}) {
  const t = useTranslations("Game");
  const router = useRouter();
  const { index, total, previous, next } = useResultNeighbours(gameId);

  useEffect(() => {
    function step(event: KeyboardEvent) {
      // A screenshot viewer opened inside takes its own arrows first.
      if (event.defaultPrevented || isTypingTarget(event.target)) {
        return;
      }
      const target =
        event.key === "ArrowLeft"
          ? previous
          : event.key === "ArrowRight"
            ? next
            : undefined;
      if (target) {
        router.replace(hrefFor(target), { scroll: false });
      }
    }

    window.addEventListener("keydown", step);
    return () => window.removeEventListener("keydown", step);
  }, [previous, next, router]);

  return (
    <Dialog.Root
      defaultOpen
      onOpenChange={(open) => {
        if (!open) {
          router.back();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-[fade-in_200ms] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] animate-[sheet-in_320ms_var(--ease-out-quart)] flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl shadow-black outline-none sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[min(72rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-[pop-in_240ms_var(--ease-out-quart)] sm:rounded-3xl"
        >
          {/* Names the dialog without adding a second heading beside the
              game's own h1. */}
          <Dialog.Title asChild>
            <span className="sr-only">{title}</span>
          </Dialog.Title>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>

          {total > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-border bg-card/95 px-5 py-3 backdrop-blur sm:px-8">
              <StepLink direction="previous" entry={previous} />
              <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono">
                  {t("sequencePosition", { current: index + 1, total })}
                </span>
                {/* Keyboard hints only where a keyboard is likely. */}
                <span
                  aria-hidden
                  className="hidden items-center gap-1.5 md:flex"
                >
                  · <Kbd>←</Kbd>
                  <Kbd>→</Kbd> · <Kbd>esc</Kbd>
                </span>
              </span>
              <StepLink direction="next" entry={next} />
            </div>
          )}

          <Dialog.Close
            aria-label={t("closeDetail")}
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-ink-950/70 text-ink-100 backdrop-blur transition-colors hover:bg-ink-950"
          >
            <XIcon aria-hidden className="size-5" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
