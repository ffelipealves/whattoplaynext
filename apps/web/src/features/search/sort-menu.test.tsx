import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { SortMenu } from "./sort-menu";
import { parseBrowseParams, type BrowseParams } from "./browse-params";

const baseParams: BrowseParams = parseBrowseParams({
  name: "Hollow Knight",
  page: "3",
});

/** Renders the menu and opens it the way a keyboard user would. */
function openSortMenu(params: BrowseParams) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SortMenu params={params} />
    </NextIntlClientProvider>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: /Sort/ }), {
    key: "Enter",
  });
}

function queryOf(href: string): URLSearchParams {
  return new URL(href, "http://localhost").searchParams;
}

test("names the current sort on the trigger", () => {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SortMenu params={baseParams} />
    </NextIntlClientProvider>,
  );

  expect(screen.getByRole("button").textContent).toBe("Sort:Popularity");
});

test("marks the active sort and resets the page while preserving the name", () => {
  openSortMenu(baseParams);

  const active = screen.getByRole("menuitem", { name: "Popularity" });
  expect(active.tagName).toBe("A");
  expect(active.getAttribute("aria-current")).toBe("true");
  const activeQuery = queryOf(active.getAttribute("href")!);
  expect(activeQuery.get("sort")).toBe("popularity");
  expect(activeQuery.get("direction")).toBe("desc");
  expect(activeQuery.get("page")).toBe("1");
  expect(activeQuery.get("name")).toBe("Hollow Knight");

  const title = screen.getByRole("menuitem", { name: "Title" });
  expect(title.getAttribute("aria-current")).toBeNull();
  const titleQuery = queryOf(title.getAttribute("href")!);
  expect(titleQuery.get("sort")).toBe("title");
  expect(titleQuery.get("direction")).toBe("asc");
  expect(titleQuery.get("page")).toBe("1");
  expect(titleQuery.get("name")).toBe("Hollow Knight");
});

test("uses each sort option's own default direction", () => {
  openSortMenu(baseParams);

  expect(
    queryOf(
      screen.getByRole("menuitem", { name: "Duration" }).getAttribute("href")!,
    ).get("direction"),
  ).toBe("asc");
  expect(
    queryOf(
      screen.getByRole("menuitem", { name: "Rating" }).getAttribute("href")!,
    ).get("direction"),
  ).toBe("desc");
});
