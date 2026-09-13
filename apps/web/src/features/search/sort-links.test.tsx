import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { SortLinks } from "./sort-links";
import { parseBrowseParams, type BrowseParams } from "./browse-params";

const baseParams: BrowseParams = parseBrowseParams({
  name: "Hollow Knight",
  page: "3",
});

function renderSortLinks(params: BrowseParams) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SortLinks params={params} />
    </NextIntlClientProvider>,
  );
}

function queryOf(href: string): URLSearchParams {
  return new URL(href, "http://localhost").searchParams;
}

test("marks the active sort and resets the page while preserving the name", () => {
  renderSortLinks(baseParams);

  const active = screen.getByRole("link", { name: "Popularity" });
  expect(active.getAttribute("aria-current")).toBe("true");
  const activeQuery = queryOf(active.getAttribute("href")!);
  expect(activeQuery.get("sort")).toBe("popularity");
  expect(activeQuery.get("direction")).toBe("desc");
  expect(activeQuery.get("page")).toBe("1");
  expect(activeQuery.get("name")).toBe("Hollow Knight");

  const title = screen.getByRole("link", { name: "Title" });
  expect(title.getAttribute("aria-current")).toBeNull();
  const titleQuery = queryOf(title.getAttribute("href")!);
  expect(titleQuery.get("sort")).toBe("title");
  expect(titleQuery.get("direction")).toBe("asc");
  expect(titleQuery.get("page")).toBe("1");
  expect(titleQuery.get("name")).toBe("Hollow Knight");
});

test("uses each sort option's own default direction", () => {
  renderSortLinks(baseParams);

  expect(
    queryOf(
      screen.getByRole("link", { name: "Duration" }).getAttribute("href")!,
    ).get("direction"),
  ).toBe("asc");
  expect(
    queryOf(
      screen.getByRole("link", { name: "Rating" }).getAttribute("href")!,
    ).get("direction"),
  ).toBe("desc");
});
