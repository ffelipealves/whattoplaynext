import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { ResultsGrid } from "./results-grid";
import { parseBrowseParams, type RawSearchParams } from "./browse-params";
import type { GamePage, SearchResult } from "./get-search-results";

const samplePage: GamePage = {
  items: [
    {
      id: 1942,
      slug: "the-witcher-3-wild-hunt",
      title: "The Witcher 3: Wild Hunt",
      releaseYear: 2015,
      cover: null,
      platforms: [],
      genres: [],
      rating: null,
      normalDurationSeconds: null,
      gameModes: [],
    },
  ],
  pagination: { page: 1, pageSize: 24, totalItems: 1, totalPages: 1 },
  query: { sort: "popularity", direction: "desc" },
  meta: {
    servedFrom: "provider",
    dataMayBeStale: false,
    excludedUnknownDuration: false,
  },
};

function renderGrid(result: SearchResult, searchParams: RawSearchParams = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ResultsGrid params={parseBrowseParams(searchParams)} result={result} />
    </NextIntlClientProvider>,
  );
}

test("renders a card for each item in a populated page", () => {
  renderGrid({ ok: true, page: samplePage });

  expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeDefined();
});

test("renders a named zero-result message distinct from an empty search", () => {
  renderGrid(
    { ok: true, page: { ...samplePage, items: [] } },
    { name: "zzzznonexistent" },
  );

  expect(screen.getByText("No games matched “zzzznonexistent”")).toBeDefined();
  expect(screen.getByText("Try a different or shorter title.")).toBeDefined();
});

test("renders a generic zero-result message without a name filter", () => {
  renderGrid({ ok: true, page: { ...samplePage, items: [] } });

  expect(screen.getByText("No games matched this search")).toBeDefined();
});

test("renders an upstream-failure state distinct from zero-result", () => {
  renderGrid({ ok: false, failure: { code: "UPSTREAM_UNAVAILABLE" } });

  expect(screen.getByRole("alert")).toBeDefined();
  expect(screen.getByText("The game catalog is unavailable")).toBeDefined();
  expect(screen.queryByText("No games matched this search")).toBeNull();
});

test("suggests relaxing a filter when filters are what emptied the page", () => {
  renderGrid(
    { ok: true, page: { ...samplePage, items: [] } },
    {
      platform: ["pc"],
    },
  );

  expect(
    screen.getByText("Try removing a filter or widening one of its ranges."),
  ).toBeDefined();
  expect(screen.queryByText("Try a different or shorter title.")).toBeNull();
});
