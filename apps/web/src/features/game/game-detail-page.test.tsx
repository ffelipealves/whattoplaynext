import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt-br.json";

import { GameDetailPage } from "./game-detail-page";
import type { GameDetail } from "./get-game-detail";

const complete = {
  id: 1942,
  slug: "the-witcher-3-wild-hunt",
  title: "The Witcher 3: Wild Hunt",
  cover: {
    url: "https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg",
    width: 264,
    height: 374,
  },
} as GameDetail;

const sparse = {
  id: 2000,
  slug: "minimal-game",
  title: "Minimal Game",
  cover: null,
} as GameDetail;

function renderPage(
  detail: GameDetail,
  messages: typeof enMessages = enMessages,
) {
  render(
    <NextIntlClientProvider
      locale={messages === ptMessages ? "pt-br" : "en"}
      messages={messages}
    >
      <GameDetailPage detail={detail} />
    </NextIntlClientProvider>,
  );
}

test("renders the minimal title and cover surface", () => {
  renderPage(complete);

  expect(
    screen.getByRole("heading", { name: "The Witcher 3: Wild Hunt" }),
  ).toBeDefined();
  expect(
    screen
      .getByRole("img", { name: "The Witcher 3: Wild Hunt cover art" })
      .getAttribute("src"),
  ).toContain(encodeURIComponent(complete.cover!.url));
});

test("shows a localized explicit state when the cover is absent", () => {
  renderPage(sparse, ptMessages);

  expect(screen.getByRole("heading", { name: "Minimal Game" })).toBeDefined();
  expect(screen.getByText("Sem capa disponível")).toBeDefined();
  expect(screen.queryByRole("img")).toBeNull();
});
