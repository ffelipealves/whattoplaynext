"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { GameImagePlaceholder } from "./game-image-placeholder";
import type { GameDetail } from "./get-game-detail";

const SCREENSHOT_WIDTH = 889;
const SCREENSHOT_HEIGHT = 500;

type ScreenshotGalleryProps = {
  screenshots: GameDetail["screenshots"];
  title: string;
};

export function ScreenshotGallery({
  screenshots,
  title,
}: ScreenshotGalleryProps) {
  const t = useTranslations("Game");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const selected = selectedIndex == null ? null : screenshots[selectedIndex];

  if (screenshots.length === 0) {
    return (
      <GameImagePlaceholder
        height={SCREENSHOT_HEIGHT}
        label={t("screenshotsPlaceholderLabel", { title })}
        message={t("noScreenshots")}
        width={SCREENSHOT_WIDTH}
      />
    );
  }

  function moveSelection(step: -1 | 1) {
    setSelectedIndex((current) => {
      if (current == null) {
        return 0;
      }
      return (current + step + screenshots.length) % screenshots.length;
    });
  }

  const selectedNumber = (selectedIndex ?? 0) + 1;
  const selectedLabel = t("screenshotAlt", {
    number: selectedNumber,
    title,
  });

  return (
    <Dialog.Root
      onOpenChange={(open) => !open && setSelectedIndex(null)}
      open={selected != null}
    >
      <ul className="grid gap-4 md:grid-cols-2">
        {screenshots.map((screenshot, index) => (
          <li
            className="overflow-hidden rounded-xl bg-[#dce6fb]"
            key={screenshot.url}
            style={{
              aspectRatio: `${screenshot.width} / ${screenshot.height}`,
            }}
          >
            <Dialog.Trigger asChild>
              <button
                aria-label={t("openScreenshot", {
                  number: index + 1,
                  title,
                })}
                className="block h-full w-full cursor-zoom-in focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-[#3157d5]"
                onClick={(event) => {
                  openerRef.current = event.currentTarget;
                  setSelectedIndex(index);
                }}
                type="button"
              >
                <Image
                  alt={t("screenshotAlt", { number: index + 1, title })}
                  className="h-full w-full object-cover"
                  height={screenshot.height}
                  loading="lazy"
                  sizes="(min-width: 1280px) 36rem, (min-width: 768px) 50vw, calc(100vw - 2.5rem)"
                  src={screenshot.url}
                  width={screenshot.width}
                />
              </button>
            </Dialog.Trigger>
          </li>
        ))}
      </ul>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[#080d1d]/85 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[94vh] w-[min(94vw,72rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 outline-none"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            openerRef.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              moveSelection(-1);
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              moveSelection(1);
            }
          }}
        >
          <Dialog.Title className="sr-only">{selectedLabel}</Dialog.Title>
          {selected && (
            <Image
              alt={selectedLabel}
              className="max-h-[82vh] w-full rounded-xl object-contain"
              height={selected.height}
              loading="eager"
              sizes="94vw"
              src={selected.url}
              width={selected.width}
            />
          )}
          <div className="flex items-center justify-center gap-3 text-white">
            <Button
              aria-label={t("previousScreenshot")}
              className="border-white/30 bg-[#17203a] text-white hover:bg-[#26375f]"
              onClick={() => moveSelection(-1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span className="min-w-20 text-center text-sm font-semibold">
              {t("screenshotPosition", {
                current: selectedNumber,
                total: screenshots.length,
              })}
            </span>
            <Button
              aria-label={t("nextScreenshot")}
              className="border-white/30 bg-[#17203a] text-white hover:bg-[#26375f]"
              onClick={() => moveSelection(1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <Dialog.Close asChild>
            <Button
              aria-label={t("closeScreenshotViewer")}
              className="absolute -top-3 -right-3 bg-white text-[#17203a] hover:bg-[#edf2ff]"
              size="icon"
              type="button"
            >
              <X aria-hidden="true" />
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
