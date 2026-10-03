import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import { completeGameDetail } from "../../../test/fixtures/game-detail";
import { getGameDetail } from "@/features/game/get-game-detail";

import { FeaturedGames, FeaturedSkeleton } from "./featured-games";

vi.mock("@/features/game/get-game-detail", () => ({ getGameDetail: vi.fn() }));

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.mocked(getGameDetail).mockImplementation(async (gameId) =>
    gameId === completeGameDetail.id
      ? { ok: true, detail: completeGameDetail }
      : { ok: false, failure: { code: "GAME_NOT_FOUND" } },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("features the games whose details load and leaves the others out", async () => {
  const featured = await FeaturedGames({ ids: [completeGameDetail.id, 7] });
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {featured}
    </NextIntlClientProvider>,
  );

  expect(
    screen.getByRole("heading", { name: "The Witcher 3: Wild Hunt" }),
  ).toBeDefined();
  // One game left: nothing to choose between.
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.getByText("Role-playing (RPG) · Adventure")).toBeDefined();
});

test("drops the section when no detail loads", async () => {
  expect(await FeaturedGames({ ids: [7, 8] })).toBeNull();
});

test("holds the section's place without announcing anything", () => {
  const { container } = render(<FeaturedSkeleton />);

  expect(container.firstElementChild!.getAttribute("aria-hidden")).toBe("true");
});
