import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import axe, { type Result } from "axe-core";
import { expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt-br.json";
import type { ApiFailure } from "@/lib/api-failure";

import { GameDetailFailure } from "../game/game-detail-failure";
import { SystemNotFound } from "./system-not-found";
import { UnexpectedError } from "./unexpected-error";

function withMessages(
  children: React.ReactNode,
  messages: typeof enMessages | typeof ptMessages = enMessages,
) {
  return (
    <NextIntlClientProvider
      locale={messages === ptMessages ? "pt-br" : "en"}
      messages={messages}
    >
      {children}
    </NextIntlClientProvider>
  );
}

async function seriousViolations(container: HTMLElement): Promise<Result[]> {
  const result = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );
}

test.each([
  [
    "VALIDATION_ERROR",
    "This request could not be run",
    "Não foi possível executar esta solicitação",
    false,
  ],
  [
    "RATE_LIMITED",
    "Too many requests just now",
    "Solicitações demais agora há pouco",
    true,
  ],
  [
    "UPSTREAM_UNAVAILABLE",
    "The game catalog is unavailable",
    "O catálogo de jogos está indisponível",
    true,
  ],
] as const)(
  "renders and localizes the classified %s game state with its retry policy",
  (code, englishTitle, portugueseTitle, recoverable) => {
    const retry = vi.fn();
    const failure: ApiFailure = { code };
    const english = render(
      withMessages(<GameDetailFailure failure={failure} retry={retry} />),
    );

    expect(screen.getByRole("heading", { name: englishTitle })).toBeDefined();
    expect(
      document.querySelector('meta[name="robots"]')?.getAttribute("content"),
    ).toBe("noindex");
    const retryButton = screen.queryByRole("button", { name: "Try again" });
    expect(Boolean(retryButton)).toBe(recoverable);
    if (retryButton) {
      fireEvent.click(retryButton);
      expect(retry).toHaveBeenCalledOnce();
    }
    english.unmount();

    render(
      withMessages(
        <GameDetailFailure failure={failure} retry={retry} />,
        ptMessages,
      ),
    );
    expect(
      screen.getByRole("heading", { name: portugueseTitle }),
    ).toBeDefined();
  },
);

test("localizes unknown-route and missing-game 404 states independently", () => {
  const englishPage = render(withMessages(<SystemNotFound kind="page" />));
  expect(screen.getByRole("heading", { name: "Page not found" })).toBeDefined();
  englishPage.unmount();

  const page = render(withMessages(<SystemNotFound kind="page" />, ptMessages));
  expect(
    screen.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeDefined();
  expect(
    document.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toBe("noindex");
  page.unmount();

  render(withMessages(<SystemNotFound kind="game" />, ptMessages));
  expect(
    screen.getByRole("heading", { name: "Jogo não encontrado" }),
  ).toBeDefined();
});

test("renders and localizes an unexpected error without exposing its message", () => {
  const english = render(
    withMessages(
      <UnexpectedError
        error={new Error("database password must stay private")}
        retry={vi.fn()}
      />,
    ),
  );
  expect(
    screen.getByRole("heading", { name: "Something went wrong" }),
  ).toBeDefined();
  english.unmount();

  render(
    withMessages(
      <UnexpectedError
        error={new Error("database password must stay private")}
        retry={vi.fn()}
      />,
      ptMessages,
    ),
  );

  expect(
    screen.getByRole("heading", { name: "Algo deu errado" }),
  ).toBeDefined();
  expect(screen.queryByText(/database password/)).toBeNull();
  expect(
    document.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toBe("noindex");
});

test("all system states have no critical or serious axe violations", async () => {
  for (const state of [
    <SystemNotFound key="page" kind="page" />,
    <SystemNotFound key="game" kind="game" />,
    <GameDetailFailure
      failure={{ code: "VALIDATION_ERROR" }}
      key="validation"
      retry={vi.fn()}
    />,
    <GameDetailFailure
      failure={{ code: "RATE_LIMITED", retryAfterSeconds: 30 }}
      key="rate"
      retry={vi.fn()}
    />,
    <GameDetailFailure
      failure={{ code: "UPSTREAM_UNAVAILABLE" }}
      key="upstream"
      retry={vi.fn()}
    />,
    <UnexpectedError
      error={new Error("unexpected")}
      key="unexpected"
      retry={vi.fn()}
    />,
  ]) {
    const view = render(withMessages(state));
    expect(await seriousViolations(view.container)).toEqual([]);
    view.unmount();
  }
});
