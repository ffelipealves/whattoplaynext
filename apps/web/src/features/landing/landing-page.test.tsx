import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { getLandingContent } from "./content";
import { LandingPage } from "./landing-page";

test("renders the English product promise and strict-match behavior", () => {
  render(<LandingPage content={getLandingContent("en")} locale="en" />);

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
