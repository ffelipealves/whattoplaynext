import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";

import { DurationNotice } from "./duration-notice";
import type { GamePage } from "./get-search-results";

function meta(excludedUnknownDuration: boolean): GamePage["meta"] {
  return {
    servedFrom: "provider",
    dataMayBeStale: false,
    excludedUnknownDuration,
  };
}

function renderNotice(meta: GamePage["meta"]) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DurationNotice meta={meta} />
    </NextIntlClientProvider>,
  );
}

const EXPLANATION =
  "Games with no recorded play time are excluded while a play-time filter is active.";

test("explains the exclusion when the API reports one", () => {
  renderNotice(meta(true));

  expect(screen.getByText(EXPLANATION)).toBeDefined();
});

test("stays silent when no duration bound narrowed the results", () => {
  const { container } = renderNotice(meta(false));

  expect(container.firstChild).toBeNull();
  expect(screen.queryByText(EXPLANATION)).toBeNull();
});
