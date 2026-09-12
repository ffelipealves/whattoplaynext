import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import ptBrMessages from "../../../messages/pt-br.json";

import { LandingPage } from "./landing-page";

const reachableCatalogStatus = {
  reachable: true as const,
  platformCount: 6,
  genreCount: 23,
  gameModeCount: 6,
};

test("renders the English product promise and strict-match behavior", () => {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LandingPage catalogStatus={reachableCatalogStatus} />
    </NextIntlClientProvider>,
  );

  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Find a game that fits tonight.",
    }),
  ).toBeDefined();
  expect(screen.getByText("Only exact matches")).toBeDefined();
  expect(
    screen.getByRole("link", { name: "Português" }).getAttribute("href"),
  ).toBe("/pt-br");
});

test("renders the Brazilian Portuguese product promise", () => {
  render(
    <NextIntlClientProvider locale="pt-br" messages={ptBrMessages}>
      <LandingPage catalogStatus={reachableCatalogStatus} />
    </NextIntlClientProvider>,
  );

  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Encontre um jogo que caiba na sua noite.",
    }),
  ).toBeDefined();
  expect(screen.getByText("Somente correspondências exatas")).toBeDefined();
  expect(
    screen.getByRole("link", { name: "English" }).getAttribute("href"),
  ).toBe("/en");
});

test("renders live catalog counts when the API is reachable", () => {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LandingPage catalogStatus={reachableCatalogStatus} />
    </NextIntlClientProvider>,
  );

  expect(
    screen.getByText("Live catalog: 6 platforms · 23 genres · 6 modes"),
  ).toBeDefined();
});

test("renders an offline message when the API is unreachable", () => {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <LandingPage catalogStatus={{ reachable: false }} />
    </NextIntlClientProvider>,
  );

  expect(screen.getByText("Catalog temporarily unavailable")).toBeDefined();
});
