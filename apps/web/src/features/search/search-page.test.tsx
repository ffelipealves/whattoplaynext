import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import type { FilterMetadata } from "@/features/catalog/get-filter-metadata";

import { SearchPage } from "./search-page";
import { readBrowseParams, type RawSearchParams } from "./browse-params";
import type { GamePage, SearchResult } from "./get-search-results";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/en/games",
}));

const metadata: FilterMetadata = {
  platforms: [{ id: "pc", label: "PC" }],
  genres: [{ id: "shooter", label: "Shooter" }],
  gameModes: [{ id: "co-operative", label: "Co-operative" }],
  durationKinds: ["fast", "normal", "completionist"],
  sortOptions: ["popularity"],
  limits: {
    pageSize: 24,
    maximumPage: 100,
    minimumAutocompleteLength: 2,
    maximumNameLength: 100,
    minimumDurationHours: 1,
    maximumDurationHours: 1000,
  },
};

function pageWith(totalItems: number): GamePage {
  return {
    items: [],
    pagination: { page: 1, pageSize: 24, totalItems, totalPages: 1 },
    query: { sort: "popularity", direction: "desc" },
    meta: {
      servedFrom: "provider",
      dataMayBeStale: false,
      excludedUnknownDuration: false,
    },
  };
}

function renderPage(
  searchParams: RawSearchParams = {},
  result: SearchResult = { ok: true, page: pageWith(200) },
) {
  const { params, issues } = readBrowseParams(searchParams);
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SearchPage
        issues={issues}
        metadata={metadata}
        params={params}
        result={result}
      />
    </NextIntlClientProvider>,
  );
}

test("announces the result count through a live region", () => {
  renderPage();

  const status = screen
    .getAllByRole("status")
    .find((node) => node.textContent?.includes("games"))!;
  expect(status.getAttribute("aria-live")).toBe("polite");
  expect(status.textContent).toBe("200 games");
});

test("keeps the live region present so a later count is announced", () => {
  const { rerender } = renderPage();

  const before = screen
    .getAllByRole("status")
    .find((node) => node.textContent === "200 games")!;

  const { params, issues } = readBrowseParams({ platform: ["pc"] });
  rerender(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SearchPage
        issues={issues}
        metadata={metadata}
        params={params}
        result={{ ok: true, page: pageWith(7) }}
      />
    </NextIntlClientProvider>,
  );

  // The same node carries the new text: replacing it would announce nothing.
  expect(before.textContent).toBe("7 games");
});

test("announces a failure as an alert and leaves the count silent", () => {
  renderPage({}, { ok: false, failure: { code: "UPSTREAM_TIMEOUT" } });

  expect(screen.getByRole("alert").textContent).toContain(
    "The game catalog took too long",
  );
  expect(
    screen
      .getAllByRole("status")
      .some((node) => node.textContent?.includes("games")),
  ).toBe(false);
});

test("announces a filter validation message as an alert", async () => {
  renderPage();

  fireEvent.change(screen.getByLabelText("Minimum hours"), {
    target: { value: "1001" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  await waitFor(() =>
    expect(
      screen
        .getAllByRole("alert")
        .some((node) => node.textContent === "Enter 1 to 1000 hours."),
    ).toBe(true),
  );
});
