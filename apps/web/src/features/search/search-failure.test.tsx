import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt-br.json";
import type { ApiFailure } from "@/lib/api-failure";

import { SearchFailure } from "./search-failure";
import { parseBrowseParams } from "./browse-params";

const params = parseBrowseParams({
  name: "Hollow Knight",
  platform: ["pc"],
  sort: "rating",
});

function renderFailure(
  failure: ApiFailure,
  messages: typeof enMessages = enMessages,
) {
  return render(
    <NextIntlClientProvider
      locale={messages === ptMessages ? "pt-br" : "en"}
      messages={messages}
    >
      <SearchFailure failure={failure} params={params} />
    </NextIntlClientProvider>,
  );
}

test("announces every failure as an alert, never as an empty result", () => {
  renderFailure({ code: "UPSTREAM_UNAVAILABLE" });

  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("The game catalog is unavailable");
  expect(alert.textContent).not.toContain("No games matched");
  expect(
    document.querySelector('meta[name="robots"]')?.getAttribute("content"),
  ).toBe("noindex");
});

test("tells each mapped code apart", () => {
  const titles = (
    [
      "VALIDATION_ERROR",
      "RATE_LIMITED",
      "UPSTREAM_UNAVAILABLE",
      "UPSTREAM_TIMEOUT",
      "UPSTREAM_INVALID_RESPONSE",
      "UNREACHABLE",
      "INTERNAL_ERROR",
    ] as const
  ).map((code) => {
    const { unmount } = renderFailure({ code });
    const title = screen.getByRole("heading").textContent;
    unmount();
    return title;
  });

  expect(new Set(titles).size).toBe(titles.length);
});

test("surfaces the retry timing a rate-limited response provided", () => {
  renderFailure({ code: "RATE_LIMITED", retryAfterSeconds: 30 });

  expect(screen.getByText("You can try again in 30 seconds.")).toBeDefined();
});

test("says nothing about timing when the API provided none", () => {
  renderFailure({ code: "RATE_LIMITED" });

  expect(screen.queryByText(/You can try again in/)).toBeNull();
  expect(screen.getByText("Too many requests just now")).toBeDefined();
});

test("offers a retry that repeats the same criteria", () => {
  renderFailure({ code: "UPSTREAM_TIMEOUT" });

  const retry = screen.getByRole("link", { name: "Try again" });
  const query = new URL(retry.getAttribute("href")!, "http://localhost")
    .searchParams;

  expect(query.get("name")).toBe("Hollow Knight");
  expect(query.getAll("platform")).toEqual(["pc"]);
  expect(query.get("sort")).toBe("rating");
});

test("offers no retry for criteria the API rejected", () => {
  renderFailure({ code: "VALIDATION_ERROR" });

  // Repeating a rejected query cannot help; the fix is changing the criteria.
  expect(screen.queryByRole("link", { name: "Try again" })).toBeNull();
  expect(screen.getByText("This request could not be run")).toBeDefined();
});

test("shows the correlation id when the API provided one", () => {
  renderFailure({ code: "UPSTREAM_UNAVAILABLE", requestId: "req-42" });

  expect(screen.getByText("Reference: req-42")).toBeDefined();
});

test("localizes the failure copy", () => {
  renderFailure({ code: "RATE_LIMITED", retryAfterSeconds: 1 }, ptMessages);

  expect(screen.getByText("Solicitações demais agora há pouco")).toBeDefined();
  expect(
    screen.getByText("Você pode tentar de novo em 1 segundo."),
  ).toBeDefined();
});
