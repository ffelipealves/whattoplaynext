import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { ResultCard } from "./result-card";
import type { GamePage } from "./get-search-results";

type GameSummary = GamePage["items"][number];

const fullGame: GameSummary = {
  id: 1942,
  slug: "the-witcher-3-wild-hunt",
  title: "The Witcher 3: Wild Hunt",
  releaseYear: 2015,
  cover: {
    url: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
    width: 264,
    height: 374,
  },
  platforms: [{ id: "pc", label: "PC" }],
  genres: [{ id: "role-playing-rpg", label: "Role-playing (RPG)" }],
  rating: { value: 92.3, count: 2745, source: "IGDB combined" },
  normalDurationSeconds: 129600,
  gameModes: [{ id: "single-player", label: "Single player" }],
};

const sparseGame: GameSummary = {
  id: 1,
  slug: "minimal-game",
  title: "Minimal Game",
  releaseYear: null,
  cover: null,
  platforms: [],
  genres: [],
  rating: null,
  normalDurationSeconds: null,
  gameModes: [],
};

function renderCard(game: GameSummary) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ResultCard game={game} />
    </NextIntlClientProvider>,
  );
}

test("renders every field for a complete game", () => {
  renderCard(fullGame);

  expect(screen.getByText("The Witcher 3: Wild Hunt")).toBeDefined();
  expect(screen.getByText("2015")).toBeDefined();
  expect(screen.getByText("PC")).toBeDefined();
  expect(screen.getByText("Role-playing (RPG)")).toBeDefined();
  expect(screen.getByText("92 · 2,745 votes")).toBeDefined();
  expect(screen.getByText("36h")).toBeDefined();
  expect(screen.getByText("Single player")).toBeDefined();
});

test("shows an explicit absent state for every missing field, never an invented value", () => {
  renderCard(sparseGame);

  expect(screen.getByText("Minimal Game")).toBeDefined();
  expect(screen.getByText("—")).toBeDefined();
  expect(screen.getByText("No cover")).toBeDefined();
  expect(screen.getByText("Not yet rated")).toBeDefined();
  expect(screen.getByText("Duration unknown")).toBeDefined();
});
