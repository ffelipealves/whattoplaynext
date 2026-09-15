import { NextIntlClientProvider } from "next-intl";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt-br.json";
import {
  completeGameDetail,
  sparseGameDetail,
} from "../../../test/fixtures/game-detail";

import { GameDetailPage } from "./game-detail-page";
import type { GameDetail } from "./get-game-detail";

function renderPage(detail: GameDetail, locale: "en" | "pt-br" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? enMessages : ptMessages}
    >
      <GameDetailPage detail={detail} />
    </NextIntlClientProvider>,
  );
}

test("renders every complete detail field without translating provider text", () => {
  renderPage(completeGameDetail);

  expect(
    screen.getByRole("heading", { name: "The Witcher 3: Wild Hunt" }),
  ).toBeDefined();
  expect(
    screen
      .getByRole("img", { name: "The Witcher 3: Wild Hunt cover art" })
      .getAttribute("src"),
  ).toContain(encodeURIComponent(completeGameDetail.cover.url));
  expect(screen.getByText(completeGameDetail.summary)).toBeDefined();
  expect(screen.queryByText("Content provided in English")).toBeNull();
  expect(screen.getByText("TW3 · Wiedzmin 3: Dziki Gon")).toBeDefined();

  const releases = screen.getByRole("region", { name: "Release dates" });
  expect(within(releases).getByText("PC")).toBeDefined();
  expect(within(releases).getAllByText("May 19, 2015").length).toBeGreaterThan(
    0,
  );
  expect(within(releases).getByText("PlayStation 5")).toBeDefined();

  expect(screen.getByText("Role-playing (RPG)")).toBeDefined();
  expect(screen.getByText("Adventure")).toBeDefined();
  expect(screen.getByText("Historical")).toBeDefined();
  expect(screen.getByText("Single player")).toBeDefined();

  const multiplayer = screen.getByRole("region", { name: "Multiplayer" });
  expect(within(multiplayer).getByText("Online co-op")).toBeDefined();
  expect(within(multiplayer).getByText("Split screen")).toBeDefined();
  expect(within(multiplayer).getByText("Up to 4 players")).toBeDefined();

  const ratings = screen.getByRole("region", { name: "Ratings" });
  expect(within(ratings).getByText("88.5")).toBeDefined();
  expect(within(ratings).getByText("IGDB user")).toBeDefined();
  expect(within(ratings).getByText("92.1")).toBeDefined();
  expect(within(ratings).getByText("IGDB critic")).toBeDefined();
  expect(within(ratings).getByText("92.3")).toBeDefined();
  expect(within(ratings).getByText("2,745 votes")).toBeDefined();

  const durations = screen.getByRole("region", { name: "Play time" });
  expect(within(durations).getByText("5h")).toBeDefined();
  expect(within(durations).getByText("11h")).toBeDefined();
  expect(within(durations).getByText("30h")).toBeDefined();
  expect(within(durations).getAllByText("1,834 submissions").length).toBe(3);

  expect(screen.getByText("ESRB · Mature")).toBeDefined();
  expect(screen.getByText("PEGI · 18")).toBeDefined();
  expect(
    screen.getAllByRole("img", { name: /Screenshot \d of The Witcher 3/ }),
  ).toHaveLength(2);

  const officialLink = screen.getByRole("link", {
    name: "Official Website — external link",
  });
  expect(officialLink.getAttribute("href")).toBe(
    "https://thewitcher.com/en/witcher3",
  );
  expect(officialLink.getAttribute("target")).toBe("_blank");
  expect(officialLink.getAttribute("rel")).toBe("noopener noreferrer");
});

test("renders an explicit localized absence for every sparse detail field", () => {
  renderPage(sparseGameDetail, "pt-br");

  for (const message of [
    "Sem capa disponível",
    "Nenhum resumo disponível.",
    "Nenhum nome alternativo disponível.",
    "Nenhuma data de lançamento disponível.",
    "Nenhum gênero disponível.",
    "Nenhum tema disponível.",
    "Nenhuma plataforma disponível.",
    "Nenhum modo de jogo disponível.",
    "Nenhum recurso multijogador informado.",
    "Máximo de jogadores indisponível",
    "Nenhuma classificação etária disponível.",
    "Nenhuma captura de tela disponível.",
    "Nenhum link externo disponível.",
  ]) {
    expect(screen.getByText(message)).toBeDefined();
  }

  expect(screen.getAllByText("Nota indisponível")).toHaveLength(3);
  expect(screen.getAllByText("Duração indisponível")).toHaveLength(3);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.queryByRole("link", { name: /externo/i })).toBeNull();
});

test("labels an unknown date inside an otherwise known platform release", () => {
  renderPage(
    {
      ...sparseGameDetail,
      releases: [{ platform: { id: "pc", label: "PC" }, releaseDate: null }],
    },
    "pt-br",
  );

  expect(screen.getByText("PC")).toBeDefined();
  expect(screen.getByText("Data indisponível")).toBeDefined();
});

test("keeps the English provider summary and labels in Portuguese with a source-language indicator", () => {
  renderPage(completeGameDetail, "pt-br");

  expect(screen.getByText(completeGameDetail.summary)).toBeDefined();
  expect(screen.getByText("Role-playing (RPG)")).toBeDefined();
  expect(screen.getByText("Conteúdo fornecido em inglês")).toBeDefined();
});
