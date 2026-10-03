import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";

import { GameModalFailure } from "./game-modal-failure";

const refresh = vi.fn();

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/en/games/7/x",
}));

function renderFailure(code: "GAME_NOT_FOUND" | "UPSTREAM_UNAVAILABLE") {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GameModalFailure failure={{ code }} />
    </NextIntlClientProvider>,
  );
}

test("says plainly when the game does not exist", () => {
  renderFailure("GAME_NOT_FOUND");

  expect(
    screen.getByRole("heading", { level: 2, name: "Game not found" }),
  ).toBeDefined();
  expect(screen.queryByRole("button")).toBeNull();
});

test("offers a retry, in place, for a failure worth retrying", () => {
  renderFailure("UPSTREAM_UNAVAILABLE");

  expect(screen.getByRole("alert").textContent).toContain(
    "The game catalog is unavailable",
  );
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(refresh).toHaveBeenCalled();
});
