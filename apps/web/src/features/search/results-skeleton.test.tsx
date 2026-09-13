import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { ResultsSkeleton } from "./results-skeleton";

test("renders a labeled loading placeholder", () => {
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ResultsSkeleton />
    </NextIntlClientProvider>,
  );

  expect(screen.getByRole("status", { name: "Loading results" })).toBeDefined();
});
