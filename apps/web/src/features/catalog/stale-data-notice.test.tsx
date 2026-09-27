import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt-br.json";

import { StaleDataNotice, type FreshnessMeta } from "./stale-data-notice";

const SAVED_AT = "2026-09-26T18:05:00Z";

function meta(overrides: Partial<FreshnessMeta> = {}): FreshnessMeta {
  return {
    dataMayBeStale: true,
    dataAsOf: SAVED_AT,
    ...overrides,
  };
}

function renderNotice(value: FreshnessMeta, locale: "en" | "pt-br" = "en") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "en" ? enMessages : ptMessages}
    >
      <StaleDataNotice meta={value} />
    </NextIntlClientProvider>,
  );
}

test("says the data is saved and may be out of date, with when it was saved", () => {
  renderNotice(meta());

  const notice = screen.getByRole("note");
  expect(notice.textContent).toContain("not answering right now");
  expect(notice.textContent).toContain("may be out of date");
  const savedAt = notice.querySelector("time");
  expect(savedAt?.getAttribute("dateTime")).toBe(SAVED_AT);
  expect(savedAt?.textContent).toContain("September 26, 2026");
  expect(savedAt?.textContent).toContain("UTC");
});

test("is localized in Brazilian Portuguese", () => {
  renderNotice(meta(), "pt-br");

  const notice = screen.getByRole("note");
  expect(notice.textContent).toContain("podem estar desatualizados");
  expect(notice.querySelector("time")?.textContent).toContain(
    "26 de setembro de 2026",
  );
});

test("still warns when the save time is unknown", () => {
  renderNotice(meta({ dataAsOf: null }));

  const notice = screen.getByRole("note");
  expect(notice.textContent).toContain("may be out of date");
  expect(notice.querySelector("time")).toBeNull();
});

test("stays silent for fresh data, cached or not", () => {
  const { container } = renderNotice(meta({ dataMayBeStale: false }));

  expect(container.firstChild).toBeNull();
});
