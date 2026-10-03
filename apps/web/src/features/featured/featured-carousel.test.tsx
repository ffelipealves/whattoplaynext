import { NextIntlClientProvider } from "next-intl";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";

import { FeaturedCarousel, type FeaturedGame } from "./featured-carousel";

function game(id: number, title: string): FeaturedGame {
  return {
    id,
    slug: title.toLowerCase().replaceAll(" ", "-"),
    title,
    summary: `${title} summary.`,
    rating: 90,
    genres: ["Adventure"],
    normalHours: 12,
    backdrop: null,
    cover: null,
  };
}

const games = [game(1, "Alpha"), game(2, "Beta"), game(3, "Gamma")];

let prefersReducedMotion = false;

beforeEach(() => {
  vi.useFakeTimers();
  prefersReducedMotion = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: prefersReducedMotion,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function renderCarousel(list: FeaturedGame[] = games) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <FeaturedCarousel games={list} />
    </NextIntlClientProvider>,
  );
}

function shownTitle(): string {
  return screen.getByRole("heading", { level: 2 }).textContent ?? "";
}

function wait(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

test("turns to the next game every seven seconds", () => {
  renderCarousel();

  expect(shownTitle()).toBe("Alpha");
  wait(7000);
  expect(shownTitle()).toBe("Beta");
  wait(7000);
  expect(shownTitle()).toBe("Gamma");
  wait(7000);
  expect(shownTitle()).toBe("Alpha");
});

test("stands still while hovered, and resumes after", () => {
  const { container } = renderCarousel();
  const section = container.querySelector("section")!;

  fireEvent.mouseEnter(section);
  wait(20_000);
  expect(shownTitle()).toBe("Alpha");

  fireEvent.mouseLeave(section);
  wait(7000);
  expect(shownTitle()).toBe("Beta");
});

test("the pause control stops it until pressed again", () => {
  renderCarousel();

  fireEvent.click(
    screen.getByRole("button", { name: "Pause the featured games" }),
  );
  wait(20_000);
  expect(shownTitle()).toBe("Alpha");

  fireEvent.click(
    screen.getByRole("button", { name: "Play the featured games" }),
  );
  wait(7000);
  expect(shownTitle()).toBe("Beta");
});

test("never turns on its own for someone who asked for reduced motion", () => {
  prefersReducedMotion = true;
  renderCarousel();

  wait(20_000);
  expect(shownTitle()).toBe("Alpha");
  expect(
    screen.queryByRole("button", { name: "Pause the featured games" }),
  ).toBeNull();
});

test("the covers are tabs that pick a game by click or arrow key", () => {
  renderCarousel();

  const tabs = screen.getAllByRole("tab");
  expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual([
    "true",
    "false",
    "false",
  ]);

  fireEvent.click(screen.getByRole("tab", { name: "Gamma" }));
  expect(shownTitle()).toBe("Gamma");

  fireEvent.keyDown(screen.getByRole("tab", { name: "Gamma" }), {
    key: "ArrowRight",
  });
  expect(shownTitle()).toBe("Alpha");
  expect(document.activeElement).toBe(
    screen.getByRole("tab", { name: "Alpha" }),
  );
});

test("links the shown game to its page, named for that game", () => {
  renderCarousel();

  const link = screen.getByRole("link", { name: "View details: Alpha" });
  expect(link.getAttribute("href")).toBe("/en/games/1/alpha");
});

test("a single game has nothing to turn to: no tabs, no pause control", () => {
  renderCarousel([game(1, "Alpha")]);

  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  wait(20_000);
  expect(shownTitle()).toBe("Alpha");
});
