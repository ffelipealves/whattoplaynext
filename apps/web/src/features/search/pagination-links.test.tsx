import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { PaginationLinks } from "./pagination-links";
import type { BrowseParams } from "./browse-params";

function renderPagination(params: BrowseParams, totalPages: number) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <PaginationLinks params={params} totalPages={totalPages} />
    </NextIntlClientProvider>,
  );
}

function queryOf(href: string): URLSearchParams {
  return new URL(href, "http://localhost").searchParams;
}

test("renders nothing for a single-page result set", () => {
  const { container } = renderPagination(
    { sort: "popularity", direction: "desc", page: 1 },
    1,
  );

  expect(container.firstChild).toBeNull();
});

test("disables Previous on the first page and Next on the last page", () => {
  renderPagination({ sort: "popularity", direction: "desc", page: 1 }, 5);

  expect(screen.getByText("Previous").tagName).toBe("SPAN");
  expect(screen.getByRole("link", { name: "Next" })).toBeDefined();
});

test("marks the current page and announces it for assistive technology", () => {
  renderPagination({ sort: "popularity", direction: "desc", page: 3 }, 5);

  const current = screen.getByRole("link", { name: "3" });
  expect(current.getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("status").textContent).toBe("Page 3 of 5");
});

test("caps displayed pages at the 100-page ceiling even with more total pages", () => {
  renderPagination({ sort: "popularity", direction: "desc", page: 1 }, 5000);

  expect(screen.getByRole("link", { name: "100" })).toBeDefined();
  expect(screen.queryByRole("link", { name: "101" })).toBeNull();
});

test("keeps the active name filter across a page link", () => {
  renderPagination(
    { name: "Hollow Knight", sort: "title", direction: "asc", page: 1 },
    3,
  );

  const query = queryOf(
    screen.getByRole("link", { name: "2" }).getAttribute("href")!,
  );
  expect(query.get("name")).toBe("Hollow Knight");
  expect(query.get("sort")).toBe("title");
  expect(query.get("page")).toBe("2");
});
