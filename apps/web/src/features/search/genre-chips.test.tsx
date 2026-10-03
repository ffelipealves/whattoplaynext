import { NextIntlClientProvider } from "next-intl";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import type { CatalogOption } from "@/features/catalog/get-filter-metadata";

import { GenreChips } from "./genre-chips";
import { parseBrowseParams, type RawSearchParams } from "./browse-params";

const genres: CatalogOption[] = [
  { id: "shooter", label: "Shooter" },
  { id: "adventure", label: "Adventure" },
  { id: "pinball", label: "Pinball" },
  { id: "indie", label: "Indie" },
];

function renderChips(searchParams: RawSearchParams = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GenreChips genres={genres} params={parseBrowseParams(searchParams)} />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("navigation", { name: "Genres" });
}

function genreIdsOf(link: HTMLElement): string[] {
  return new URL(
    link.getAttribute("href")!,
    "http://localhost",
  ).searchParams.getAll("genre");
}

test("offers All and the quick genres in a fixed order", () => {
  const row = renderChips();

  expect(
    within(row)
      .getAllByRole("link")
      .map((link) => link.textContent),
  ).toEqual(["All", "Adventure", "Shooter", "Indie"]);
  expect(
    within(row).getByRole("link", { name: "All" }).getAttribute("aria-current"),
  ).toBe("true");
});

test("leads with the selected genres, each linking to the search without it", () => {
  const row = renderChips({ genre: ["pinball"], name: "Ball" });

  const links = within(row).getAllByRole("link");
  expect(links[1].textContent).toBe("Pinball");
  expect(links[1].getAttribute("aria-current")).toBe("true");
  expect(genreIdsOf(links[1])).toEqual([]);

  const adventure = within(row).getByRole("link", { name: "Adventure" });
  expect(genreIdsOf(adventure)).toEqual(["pinball", "adventure"]);
  // The rest of the search rides along, back on page 1.
  const query = new URL(adventure.getAttribute("href")!, "http://localhost")
    .searchParams;
  expect(query.get("name")).toBe("Ball");
  expect(query.get("page")).toBe("1");
});

test("counts the genres left for the More menu", () => {
  renderChips();

  expect(
    screen.getByRole("button", { name: /More genres/ }).textContent,
  ).toContain("+1");
});
