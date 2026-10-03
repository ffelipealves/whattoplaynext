import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { PaginationLinks } from "./pagination-links";
import { parseBrowseParams, type BrowseParams } from "./browse-params";

const baseline = parseBrowseParams({});

function browseParams(overrides: Partial<BrowseParams>): BrowseParams {
  return { ...baseline, ...overrides };
}

const PAGE_SIZE = 24;

function renderPagination(
  params: BrowseParams,
  totalPages: number,
  totalItems = totalPages * PAGE_SIZE,
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PaginationLinks
        pageSize={PAGE_SIZE}
        params={params}
        totalItems={totalItems}
        totalPages={totalPages}
      />
    </NextIntlClientProvider>,
  );
}

function pageWindow(): string[] {
  return Array.from(screen.getByRole("list").querySelectorAll("li")).map(
    (item) => item.textContent ?? "",
  );
}

function queryOf(href: string): URLSearchParams {
  return new URL(href, "http://localhost").searchParams;
}

test("renders nothing for a single-page result set", () => {
  const { container } = renderPagination(browseParams({ page: 1 }), 1);

  expect(container.firstChild).toBeNull();
});

test("disables Previous on the first page and Next on the last page", () => {
  renderPagination(browseParams({ page: 1 }), 5);

  expect(screen.getByText("Previous")).toBeDefined();
  expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
  expect(screen.getByRole("link", { name: "Next" })).toBeDefined();
});

test("marks the current page and announces it for assistive technology", () => {
  renderPagination(browseParams({ page: 3 }), 5);

  const current = screen.getByRole("link", { name: "3" });
  expect(current.getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("status").textContent).toBe("Page 3 of 5");
});

test("caps displayed pages at the 100-page ceiling even with more total pages", () => {
  renderPagination(browseParams({ page: 1 }), 5000);

  expect(screen.getByRole("link", { name: "100" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "101" })).toBeNull();
});

test("keeps the active name filter across a page link", () => {
  renderPagination(
    browseParams({
      name: "Hollow Knight",
      sort: "title",
      direction: "asc",
      page: 1,
    }),
    3,
  );

  const query = queryOf(
    screen.getByRole("link", { name: "2" }).getAttribute("href")!,
  );
  expect(query.get("name")).toBe("Hollow Knight");
  expect(query.get("sort")).toBe("title");
  expect(query.get("page")).toBe("2");
});

test("shows every page when there are few, and a steady window when there are many", () => {
  renderPagination(browseParams({ page: 2 }), 6);
  expect(pageWindow()).toEqual(["1", "2", "3", "4", "5", "6"]);
});

test.each([
  [1, ["1", "2", "3", "4", "…", "100"]],
  [50, ["1", "…", "49", "50", "51", "…", "100"]],
  [100, ["1", "…", "97", "98", "99", "100"]],
])("windows page %i of 100 as %j", (page, expected) => {
  renderPagination(browseParams({ page }), 100);
  expect(pageWindow()).toEqual(expected);
});

test("says which slice of the results the page holds", () => {
  renderPagination(browseParams({ page: 2 }), 5, 110);

  expect(screen.getByText(/^Showing/).textContent).toBe("Showing 25–48 of 110");
});
