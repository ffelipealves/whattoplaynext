import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { NameSearchForm } from "./name-search-form";
import type { BrowseParams } from "./browse-params";

function renderForm(params: BrowseParams) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <NameSearchForm params={params} />
    </NextIntlClientProvider>,
  );
}

test("pre-fills the current name and preserves sort/direction as hidden fields", () => {
  renderForm({
    name: "Hollow Knight",
    sort: "title",
    direction: "asc",
    page: 4,
  });

  expect(screen.getByLabelText("Game name")).toHaveProperty(
    "value",
    "Hollow Knight",
  );

  const form = screen.getByRole("searchbox").closest("form")!;
  const hiddenInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
  );
  expect(hiddenInputs.map((input) => [input.name, input.value])).toEqual([
    ["sort", "title"],
    ["direction", "asc"],
  ]);
});

test("omits a page field so submitting restarts at page 1", () => {
  renderForm({ sort: "popularity", direction: "desc", page: 5 });

  const form = screen.getByRole("searchbox").closest("form")!;
  expect(form.querySelector('input[name="page"]')).toBeNull();
});
