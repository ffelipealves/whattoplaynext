import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";

import { SiteHeader } from "./site-header";

const location = { pathname: "/en", search: "" };

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => location.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(location.search),
}));

beforeEach(() => {
  location.pathname = "/en";
  location.search = "";
});

function renderHeader() {
  const { container } = render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <SiteHeader minimumQueryLength={2} />
    </NextIntlClientProvider>,
  );
  return container;
}

function hiddenFields(container: HTMLElement): [string, string][] {
  return Array.from(
    container.querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
  ).map((input) => [input.name, input.value]);
}

test("on the search, keeps the applied criteria and shows the applied name", () => {
  location.search = "?name=Hollow&platform=pc&page=3";
  const container = renderHeader();

  expect(screen.getByRole("combobox", { name: "Game name" })).toHaveProperty(
    "value",
    "Hollow",
  );
  expect(hiddenFields(container)).toContainEqual(["platform", "pc"]);
  // A new name starts again at page 1.
  expect(hiddenFields(container).some(([name]) => name === "page")).toBe(false);
});

test("elsewhere, starts a fresh search on the home page", () => {
  location.pathname = "/en/games/1942/the-witcher-3-wild-hunt";
  location.search = "?platform=pc";
  const container = renderHeader();

  expect(
    screen.getByLabelText("Game name").closest("form")!.getAttribute("action"),
  ).toBe("/en");
  expect(hiddenFields(container).some(([name]) => name === "platform")).toBe(
    false,
  );
});

test("switches language on the same page, search included, with a full load", () => {
  location.pathname = "/en";
  location.search = "?platform=pc&genre=indie&genre=shooter";
  renderHeader();

  const link = screen.getByRole("link", { name: "Português" });
  expect(link.getAttribute("href")).toBe(
    "/pt-br?platform=pc&genre=indie&genre=shooter",
  );
  expect(link.getAttribute("hreflang")).toBe("pt-br");
});

test("names the logo link for the home page", () => {
  renderHeader();

  expect(
    screen
      .getByRole("link", { name: "What To Play Next, home" })
      .getAttribute("href"),
  ).toBe("/en");
});
