import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { getLandingContent, isSupportedLocale } from "./content";
import { LandingPage } from "./landing-page";

test("renders the English product promise and strict-match behavior", () => {
  render(
    <LandingPage
      catalogStatus={{
        reachable: true,
        platformCount: 6,
        genreCount: 23,
        gameModeCount: 6,
      }}
      content={getLandingContent("en")}
      locale="en"
    />,
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
  expect(isSupportedLocale("pt-br")).toBe(true);
  expect(isSupportedLocale("es")).toBe(false);
});

test("renders live catalog counts when the API is reachable", () => {
  render(
    <LandingPage
      catalogStatus={{
        reachable: true,
        platformCount: 6,
        genreCount: 23,
        gameModeCount: 6,
      }}
      content={getLandingContent("en")}
      locale="en"
    />,
  );

  expect(
    screen.getByText("Live catalog: 6 platforms · 23 genres · 6 modes"),
  ).toBeDefined();
});

test("renders an offline message when the API is unreachable", () => {
  render(
    <LandingPage
      catalogStatus={{ reachable: false }}
      content={getLandingContent("en")}
      locale="en"
    />,
  );

  expect(screen.getByText("Catalog temporarily unavailable")).toBeDefined();
});
