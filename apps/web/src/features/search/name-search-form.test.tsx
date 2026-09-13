import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { NameSearchForm } from "./name-search-form";
import { parseBrowseParams, type RawSearchParams } from "./browse-params";

function renderForm(searchParams: RawSearchParams) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <NameSearchForm params={parseBrowseParams(searchParams)} />
    </NextIntlClientProvider>,
  );
}

function hiddenFields(): [string, string][] {
  const form = screen.getByRole("searchbox").closest("form")!;
  return Array.from(
    form.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
  ).map((input) => [input.name, input.value]);
}

test("pre-fills the current name and preserves sort/direction as hidden fields", () => {
  renderForm({
    name: "Hollow Knight",
    sort: "title",
    direction: "asc",
    page: "4",
  });

  expect(screen.getByLabelText("Game name")).toHaveProperty(
    "value",
    "Hollow Knight",
  );
  expect(hiddenFields()).toEqual([
    ["sort", "title"],
    ["direction", "asc"],
  ]);
});

test("omits a page field so submitting restarts at page 1", () => {
  renderForm({ sort: "popularity", page: "5" });

  const form = screen.getByRole("searchbox").closest("form")!;
  expect(form.querySelector('input[name="page"]')).toBeNull();
});

test("carries the applied filters forward so a name search narrows them", () => {
  renderForm({
    platform: ["pc", "nintendo-switch"],
    genre: ["shooter"],
    minimumRating: "80",
    durationKind: "fast",
    minimumDurationHours: "2",
  });

  expect(hiddenFields()).toEqual([
    ["sort", "popularity"],
    ["direction", "desc"],
    // One field per selected id: a native GET form repeats the param, exactly
    // like the sort and pagination links do.
    ["platform", "pc"],
    ["platform", "nintendo-switch"],
    ["genre", "shooter"],
    ["minimumRating", "80"],
    ["durationKind", "fast"],
    ["minimumDurationHours", "2"],
  ]);
});
