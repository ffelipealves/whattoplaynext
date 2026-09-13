import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import axe, { type Result } from "axe-core";
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
    filters = metadata as FilterMetadata | undefined,
  } = {},
) {
  const { params, issues } = readBrowseParams(searchParams);
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SearchPage
        issues={issues}
        metadata={filters}
        params={params}
        result={result}
      />
    </NextIntlClientProvider>,
  );
}

/**
 * jsdom has no layout or paint, so colour contrast cannot be evaluated here;
 * it is checked in a real browser instead. Everything else axe knows about
 * runs against the markup this page actually ships.
 */
async function criticalViolations(container: HTMLElement): Promise<Result[]> {
  const run = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  return run.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
}

function describeViolations(violations: Result[]): string {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => node.html)
          .join(" | ")}`,
    )
    .join("\n");
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
      filters: undefined,
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
