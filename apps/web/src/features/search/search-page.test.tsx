import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import type { FilterMetadata } from "@/features/catalog/get-filter-metadata";

import { SearchPage } from "./search-page";
import { readBrowseParams, type RawSearchParams } from "./browse-params";
import type { GamePage, SearchResult } from "./get-search-results";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/en",
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
        filters={{ ok: true, metadata }}
        issues={issues}
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
        filters={{ ok: true, metadata }}
        issues={issues}
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

test("warns above the results when they were served from stale saved data", () => {
  const page = pageWith(200);
  renderPage(
    {},
    {
      ok: true,
      page: {
        ...page,
        meta: {
          ...page.meta,
          servedFrom: "cache",
          dataMayBeStale: true,
          dataAsOf: "2026-09-26T18:05:00Z",
        },
      },
    },
  );

  expect(screen.getByRole("note").textContent).toContain("may be out of date");
});

test("shows no freshness warning for fresh results", () => {
  renderPage();

  expect(screen.queryByRole("note")).toBeNull();
});

test.each([
  [{}, "All games"],
  [{ name: "Hollow" }, "Results for “Hollow”"],
  // A lone genre names the page after itself.
  [{ genre: ["shooter"] }, "Shooter"],
  [{ genre: ["shooter"], platform: ["pc"] }, "Filtered results"],
  [{ platform: ["pc"] }, "Filtered results"],
] satisfies [RawSearchParams, string][])(
  "headings the results for %j as %s",
  (searchParams, heading) => {
    renderPage(searchParams);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(heading);
  },
);

test("states the page beside the count only when there is more than one", () => {
  const page = pageWith(60);
  renderPage(
    {},
    {
      ok: true,
      page: {
        ...page,
        pagination: { ...page.pagination, page: 2, totalPages: 3 },
      },
    },
  );

  const status = screen
    .getAllByRole("status")
    .find((node) => node.textContent === "60 games")!;
  expect(status.parentElement!.textContent).toBe("60 games · page 2 of 3");
});

test("counts only the pages that can be reached", () => {
  const page = pageWith(240_000);
  renderPage(
    {},
    {
      ok: true,
      page: {
        ...page,
        pagination: { ...page.pagination, totalPages: 10_000 },
      },
    },
  );

  expect(
    screen.getByText(
      (_, node) => node?.textContent === "240,000 games · page 1 of 100",
    ),
  ).toBeDefined();
});
