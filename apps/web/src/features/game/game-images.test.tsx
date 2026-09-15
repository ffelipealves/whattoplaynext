import { NextIntlClientProvider } from "next-intl";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import {
  completeGameDetail,
  sparseGameDetail,
} from "../../../test/fixtures/game-detail";

import { GameCover } from "./game-cover";
import { ScreenshotGallery } from "./screenshot-gallery";

function withMessages(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

test("the above-fold cover is responsive, dimensioned, and not lazy", () => {
  render(
    withMessages(
      <GameCover
        cover={completeGameDetail.cover}
        title={completeGameDetail.title}
      />,
    ),
  );

  const image = screen.getByRole("img", {
    name: "The Witcher 3: Wild Hunt cover art",
  });
  expect(image.getAttribute("width")).toBe("264");
  expect(image.getAttribute("height")).toBe("374");
  expect(image.getAttribute("sizes")).toContain("18rem");
  expect(image.getAttribute("loading")).not.toBe("lazy");
});

test("below-fold screenshots are responsive, dimensioned, and lazy", () => {
  render(
    withMessages(
      <ScreenshotGallery
        screenshots={completeGameDetail.screenshots}
        title={completeGameDetail.title}
      />,
    ),
  );

  for (const image of screen.getAllByRole("img", {
    name: /Screenshot \d of The Witcher 3/,
  })) {
    expect(image.getAttribute("width")).toBe("889");
    expect(image.getAttribute("height")).toBe("500");
    expect(image.getAttribute("sizes")).toContain("50vw");
    expect(image.getAttribute("loading")).toBe("lazy");
  }
});

test("first-party placeholders reserve the cover and screenshot ratios", () => {
  render(
    withMessages(
      <>
        <GameCover
          cover={sparseGameDetail.cover}
          title={sparseGameDetail.title}
        />
        <ScreenshotGallery
          screenshots={sparseGameDetail.screenshots}
          title={sparseGameDetail.title}
        />
      </>,
    ),
  );

  expect(
    screen
      .getByRole("img", { name: "Cover unavailable for Minimal Game" })
      .getAttribute("style"),
  ).toContain("aspect-ratio: 264 / 374");
  expect(
    screen
      .getByRole("img", { name: "Screenshots unavailable for Minimal Game" })
      .getAttribute("style"),
  ).toContain("aspect-ratio: 889 / 500");
});

test("the screenshot viewer supports arrow navigation, Escape, and focus restoration", async () => {
  render(
    withMessages(
      <ScreenshotGallery
        screenshots={completeGameDetail.screenshots}
        title={completeGameDetail.title}
      />,
    ),
  );

  const firstTrigger = screen.getByRole("button", {
    name: "Open screenshot 1 of The Witcher 3: Wild Hunt",
  });
  firstTrigger.focus();
  fireEvent.click(firstTrigger);

  let dialog = await screen.findByRole("dialog", {
    name: "Screenshot 1 of The Witcher 3: Wild Hunt",
  });
  expect(within(dialog).getByRole("img")).toBeDefined();

  fireEvent.keyDown(dialog, { key: "ArrowRight" });
  dialog = await screen.findByRole("dialog", {
    name: "Screenshot 2 of The Witcher 3: Wild Hunt",
  });
  expect(within(dialog).getByRole("img")).toBeDefined();

  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(firstTrigger);
});
