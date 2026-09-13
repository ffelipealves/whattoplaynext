import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt-br.json";

import { IgnoredCriteria } from "./ignored-criteria";
import { readBrowseParams, type BrowseParamIssue } from "./browse-params";

function renderNotice(
  issues: BrowseParamIssue[],
  messages: typeof enMessages = enMessages,
) {
  return render(
    <NextIntlClientProvider
      locale={messages === ptMessages ? "pt-br" : "en"}
      messages={messages}
    >
      <IgnoredCriteria issues={issues} />
    </NextIntlClientProvider>,
  );
}

test("stays silent when the link asked for nothing invalid", () => {
  const { container } = renderNotice([]);

  expect(container.firstChild).toBeNull();
});

test("names every ignored criterion without alarming about the results", () => {
  renderNotice(["sort", "platform", "rating"]);

  // The search still ran, so this is a status rather than an alert.
  expect(screen.getByRole("status")).toBeDefined();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(
    screen.getAllByRole("listitem").map((item) => item.textContent),
  ).toEqual([
    "That sort order is not one we offer.",
    "A platform in the link is not one we filter by.",
    "The minimum rating was outside 0 to 100, or not a whole number.",
  ]);
});

test("has copy for every issue the parser can report", () => {
  const { issues } = readBrowseParams({
    name: "x".repeat(101),
    sort: "nope",
    direction: "nope",
    page: "0",
    platform: ["nope"],
    genre: ["nope"],
    gameMode: ["nope"],
    releaseFrom: "nope",
    minimumRating: "nope",
    durationKind: "nope",
  });
  renderNotice(issues);

  const rendered = screen
    .getAllByRole("listitem")
    .map((item) => item.textContent);
  expect(rendered).toHaveLength(issues.length);
  expect(rendered.every((text) => text && !text.startsWith("Failure."))).toBe(
    true,
  );
});

test("localizes the notice", () => {
  renderNotice(["release"], ptMessages);

  expect(
    screen.getByText("Alguns critérios deste link foram ignorados"),
  ).toBeDefined();
});
