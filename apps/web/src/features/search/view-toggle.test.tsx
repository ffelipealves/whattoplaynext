import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { ViewToggle } from "./view-toggle";
import { parseBrowseParams } from "./browse-params";

function queryOf(link: HTMLElement): URLSearchParams {
  return new URL(link.getAttribute("href")!, "http://localhost").searchParams;
}

test("switches layout on the same page of the same search", () => {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ViewToggle
        params={parseBrowseParams({ name: "Hollow", page: "3", view: "list" })}
      />
    </NextIntlClientProvider>,
  );

  const list = screen.getByRole("link", { name: "List view" });
  expect(list.getAttribute("aria-current")).toBe("true");

  const grid = screen.getByRole("link", { name: "Grid view" });
  expect(grid.getAttribute("aria-current")).toBeNull();
  const query = queryOf(grid);
  expect(query.get("view")).toBeNull();
  expect(query.get("page")).toBe("3");
  expect(query.get("name")).toBe("Hollow");
});
