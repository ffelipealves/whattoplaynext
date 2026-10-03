import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import {
  RegisterResultSequence,
  ResultSequenceProvider,
  type SequenceEntry,
} from "@/features/search/result-sequence";

import { GameModal } from "./game-modal";

const router = {
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => router,
  usePathname: () => "/en",
}));

const results: SequenceEntry[] = [
  { id: 1, slug: "alpha", title: "Alpha" },
  { id: 2, slug: "beta", title: "Beta" },
  { id: 3, slug: "gamma", title: "Gamma" },
];

beforeEach(() => {
  for (const method of Object.values(router)) {
    method.mockReset();
  }
});

function renderModal(entries: SequenceEntry[] = results) {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ResultSequenceProvider>
        <RegisterResultSequence entries={entries} />
        <GameModal gameId={2} title="Beta">
          <p>Beta in detail.</p>
        </GameModal>
      </ResultSequenceProvider>
    </NextIntlClientProvider>,
  );
}

test("is a dialog named by the game, without a heading of its own", () => {
  renderModal();

  expect(screen.getByRole("dialog", { name: "Beta" })).toBeDefined();
  expect(screen.queryAllByRole("heading")).toHaveLength(0);
});

test("steps to the neighbouring results, replacing the open game", () => {
  renderModal();

  expect(screen.getByText("2 of 3")).toBeDefined();
  expect(
    screen.getByRole("link", { name: /^Previous/ }).getAttribute("href"),
  ).toBe("/en/games/1/alpha");
  expect(screen.getByRole("link", { name: /^Next/ }).getAttribute("href")).toBe(
    "/en/games/3/gamma",
  );

  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(router.replace).toHaveBeenCalledWith("/en/games/3/gamma", {
    scroll: false,
  });
});

test("leaves the arrows to a field being typed in", () => {
  renderModal();
  const field = document.createElement("input");
  document.body.append(field);

  fireEvent.keyDown(field, { key: "ArrowLeft" });

  expect(router.replace).not.toHaveBeenCalled();
  field.remove();
});

test("offers no steps for a game that is not among the shown results", () => {
  renderModal([{ id: 9, slug: "other", title: "Other" }]);

  expect(screen.queryByRole("link", { name: /^Previous/ })).toBeNull();
  expect(screen.queryByRole("link", { name: /^Next/ })).toBeNull();
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(router.replace).not.toHaveBeenCalled();
});

test("closing goes back to the page it was opened over", () => {
  renderModal();

  fireEvent.click(screen.getByRole("button", { name: "Close game details" }));

  expect(router.back).toHaveBeenCalled();
});
