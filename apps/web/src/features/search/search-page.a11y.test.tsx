import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import {
  AXE_TEST_TIMEOUT_MS,
  criticalViolations,
  describeViolations,
} from "../../../test/axe";
import type {
  FilterMetadata,
  FilterMetadataResult,
} from "@/features/catalog/get-filter-metadata";

import { SearchPage } from "./search-page";
import { readBrowseParams, type RawSearchParams } from "./browse-params";
import type { GamePage, SearchResult } from "./get-search-results";

vi.setConfig({ testTimeout: AXE_TEST_TIMEOUT_MS });

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/en",
}));

const metadata: FilterMetadata = {
  platforms: [
    { id: "pc", label: "PC" },
    { id: "nintendo-switch", label: "Nintendo Switch" },
  ],
  genres: [{ id: "shooter", label: "Shooter" }],
  gameModes: [{ id: "co-operative", label: "Co-operative" }],
  durationKinds: ["fast", "normal", "completionist"],
  sortOptions: ["popularity", "rating", "release-date", "duration", "title"],
  limits: {
    pageSize: 24,
    maximumPage: 100,
    minimumAutocompleteLength: 2,
    maximumNameLength: 100,
    minimumDurationHours: 1,
    maximumDurationHours: 1000,
  },
};

const page: GamePage = {
  items: [
    {
      id: 1942,
      slug: "hollow-knight",
      title: "Hollow Knight",
      releaseYear: 2017,
      cover: null,
      platforms: [{ id: "pc", label: "PC" }],
      genres: [{ id: "shooter", label: "Shooter" }],
      rating: { value: 92, count: 500, source: "IGDB combined" },
      normalDurationSeconds: 90000,
      gameModes: [{ id: "co-operative", label: "Co-operative" }],
    },
  ],
  pagination: { page: 2, pageSize: 24, totalItems: 200, totalPages: 9 },
  query: { sort: "popularity", direction: "desc" },
  meta: {
    servedFrom: "provider",
    dataMayBeStale: false,
    excludedUnknownDuration: true,
  },
};

function renderPage(
  searchParams: RawSearchParams,
  {
    result = { ok: true, page } as SearchResult,
    filters = { ok: true, metadata } as FilterMetadataResult,
  } = {},
) {
  const { params, issues } = readBrowseParams(searchParams);
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SearchPage
        filters={filters}
        issues={issues}
        params={params}
        result={result}
      />
    </NextIntlClientProvider>,
  );
}

test("the desktop layout reports no critical or serious violations", async () => {
  const { container } = renderPage({
    name: "hollow",
    page: "2",
    platform: ["pc"],
    minimumRating: "80",
    minimumDurationHours: "2",
    sort: "rating",
  });

  const violations = await criticalViolations(container);
  expect(describeViolations(violations)).toBe("");
});

test("the mobile layout reports no critical or serious violations", async () => {
  const { container } = renderPage({ platform: ["pc"] });

  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  await screen.findByRole("dialog");

  // The drawer is a portal, so the whole document is what needs checking.
  const violations = await criticalViolations(document.body);
  expect(describeViolations(violations)).toBe("");
  expect(container).toBeDefined();
});

test("a failed search reports no critical or serious violations", async () => {
  const { container } = renderPage(
    { platform: ["pc"] },
    {
      result: {
        ok: false,
        failure: { code: "RATE_LIMITED", retryAfterSeconds: 30 },
      },
      filters: {
        ok: false,
        failure: { code: "RATE_LIMITED", retryAfterSeconds: 30 },
      },
    },
  );

  const violations = await criticalViolations(container);
  expect(describeViolations(violations)).toBe("");
});

test("an ignored-criteria notice reports no critical or serious violations", async () => {
  const { container } = renderPage({
    sort: "sideways",
    platform: ["dreamcast"],
  });

  const violations = await criticalViolations(container);
  expect(describeViolations(violations)).toBe("");
});
