import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import type { FilterMetadata } from "@/features/catalog/get-filter-metadata";

import { FilterForm } from "./filter-form";
import { parseBrowseParams, type RawSearchParams } from "./browse-params";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

// Mocking Next's own router (rather than `@/i18n/navigation`) keeps
// next-intl's real locale-aware URL building in the assertions, so the pushed
// query string is the one a visitor would actually land on.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/en/games",
}));

const metadata: FilterMetadata = {
  platforms: [
    { id: "pc", label: "PC" },
    { id: "nintendo-switch", label: "Nintendo Switch" },
  ],
  genres: [
    { id: "shooter", label: "Shooter" },
    { id: "indie", label: "Indie" },
  ],
  gameModes: [
    { id: "single-player", label: "Single player" },
    { id: "co-operative", label: "Co-operative" },
  ],
  durationKinds: ["fast", "normal", "completionist"],
  sortOptions: ["popularity", "rating", "release-date", "duration", "title"],
  limits: {
    pageSize: 24,
    maximumPage: 100,
    minimumAutocompleteLength: 2,
    maximumNameLength: 100,
    minimumDurationHours: 1,
    maximumDurationHours: 1000,
  },
};

beforeEach(() => {
  pushMock.mockReset();
});

function renderForm(searchParams: RawSearchParams = {}) {
  const params = parseBrowseParams(searchParams, {
    platformIds: metadata.platforms.map((option) => option.id),
    genreIds: metadata.genres.map((option) => option.id),
    gameModeIds: metadata.gameModes.map((option) => option.id),
    maximumNameLength: metadata.limits.maximumNameLength,
    minimumDurationHours: metadata.limits.minimumDurationHours,
    maximumDurationHours: metadata.limits.maximumDurationHours,
  });

  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <FilterForm metadata={metadata} params={params} />
    </NextIntlClientProvider>,
  );
}

function lastPushedQuery(): URLSearchParams {
  expect(pushMock).toHaveBeenCalled();
  const href = pushMock.mock.calls.at(-1)![0] as string;
  return new URL(href, "http://localhost").searchParams;
}

function apply() {
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
}

test("renders one control per published option", () => {
  renderForm();

  expect(screen.getByRole("checkbox", { name: "PC" })).toBeDefined();
  expect(
    screen.getByRole("checkbox", { name: "Nintendo Switch" }),
  ).toBeDefined();
  expect(screen.getByRole("checkbox", { name: "Shooter" })).toBeDefined();
  expect(screen.getByRole("checkbox", { name: "Co-operative" })).toBeDefined();
  expect(screen.getByRole("radio", { name: "Completionist" })).toBeDefined();
});

test("checks the boxes for the filters already applied in the URL", () => {
  renderForm({ platform: ["pc"], genre: ["indie"] });

  expect(
    screen.getByRole("checkbox", { name: "PC" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(
    screen
      .getByRole("checkbox", { name: "Nintendo Switch" })
      .getAttribute("aria-checked"),
  ).toBe("false");
  expect(
    screen
      .getByRole("checkbox", { name: "Indie" })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

test("no selection reaches the URL before Apply", () => {
  renderForm();

  fireEvent.click(screen.getByRole("checkbox", { name: "PC" }));
  fireEvent.change(screen.getByLabelText("From"), {
    target: { value: "2020-01-01" },
  });

  expect(pushMock).not.toHaveBeenCalled();
});

test("applying several values in one category repeats that param (OR within)", async () => {
  renderForm();

  fireEvent.click(screen.getByRole("checkbox", { name: "PC" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Nintendo Switch" }));
  apply();

  await waitFor(() => expect(pushMock).toHaveBeenCalled());
  expect(lastPushedQuery().getAll("platform")).toEqual([
    "pc",
    "nintendo-switch",
  ]);
});

test("applying values across categories sends one param each (AND across)", async () => {
  renderForm();

  fireEvent.click(screen.getByRole("checkbox", { name: "PC" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Shooter" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Co-operative" }));
  apply();

  await waitFor(() => expect(pushMock).toHaveBeenCalled());
  const query = lastPushedQuery();
  expect(query.getAll("platform")).toEqual(["pc"]);
  expect(query.getAll("genre")).toEqual(["shooter"]);
  expect(query.getAll("gameMode")).toEqual(["co-operative"]);
});

test("applying keeps the active name and sort but returns to page 1", async () => {
  renderForm({ name: "Hollow Knight", sort: "title", page: "5" });

  fireEvent.click(screen.getByRole("checkbox", { name: "PC" }));
  apply();

  await waitFor(() => expect(pushMock).toHaveBeenCalled());
  const query = lastPushedQuery();
  expect(query.get("name")).toBe("Hollow Knight");
  expect(query.get("sort")).toBe("title");
  expect(query.get("direction")).toBe("asc");
  expect(query.get("page")).toBe("1");
});

test("applies the release range, rating, and duration the visitor typed", async () => {
  renderForm();

  fireEvent.change(screen.getByLabelText("From"), {
    target: { value: "2020-01-01" },
  });
  fireEvent.change(screen.getByLabelText("To"), {
    target: { value: "2024-12-31" },
  });
  fireEvent.change(screen.getByLabelText("Minimum hours"), {
    target: { value: "5" },
  });
  fireEvent.change(screen.getByLabelText("Maximum hours"), {
    target: { value: "40" },
  });
  fireEvent.click(screen.getByRole("radio", { name: "Completionist" }));
  apply();

  await waitFor(() => expect(pushMock).toHaveBeenCalled());
  const query = lastPushedQuery();
  expect(query.get("releaseFrom")).toBe("2020-01-01");
  expect(query.get("releaseTo")).toBe("2024-12-31");
  expect(query.get("minimumDurationHours")).toBe("5");
  expect(query.get("maximumDurationHours")).toBe("40");
  expect(query.get("durationKind")).toBe("completionist");
});

test("omits the duration kind when no duration bound qualifies it", async () => {
  renderForm();

  fireEvent.click(screen.getByRole("radio", { name: "Fast" }));
  apply();

  await waitFor(() => expect(pushMock).toHaveBeenCalled());
  expect(lastPushedQuery().get("durationKind")).toBeNull();
});

test("applies a minimum rating moved off zero and omits it at zero", async () => {
  renderForm();

  fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowRight" });
  apply();

  await waitFor(() => expect(pushMock).toHaveBeenCalled());
  expect(Number(lastPushedQuery().get("minimumRating"))).toBeGreaterThan(0);
});

test("keeps a zero minimum rating out of the URL", async () => {
  renderForm();

  apply();

  await waitFor(() => expect(pushMock).toHaveBeenCalled());
  expect(lastPushedQuery().get("minimumRating")).toBeNull();
});

test("refuses an inverted release range instead of navigating", async () => {
  renderForm();

  fireEvent.change(screen.getByLabelText("From"), {
    target: { value: "2024-01-01" },
  });
  fireEvent.change(screen.getByLabelText("To"), {
    target: { value: "2020-01-01" },
  });
  apply();

  expect(
    await screen.findByText("The start date must not be after the end date."),
  ).toBeDefined();
  expect(pushMock).not.toHaveBeenCalled();
});

test("refuses an inverted duration range instead of navigating", async () => {
  renderForm();

  fireEvent.change(screen.getByLabelText("Minimum hours"), {
    target: { value: "40" },
  });
  fireEvent.change(screen.getByLabelText("Maximum hours"), {
    target: { value: "5" },
  });
  apply();

  expect(
    await screen.findByText("Minimum hours must not exceed maximum hours."),
  ).toBeDefined();
  expect(pushMock).not.toHaveBeenCalled();
});

test("refuses a duration bound outside the published limits", async () => {
  renderForm();

  fireEvent.change(screen.getByLabelText("Minimum hours"), {
    target: { value: "1001" },
  });
  apply();

  expect(await screen.findByText("Enter 1 to 1000 hours.")).toBeDefined();
  expect(pushMock).not.toHaveBeenCalled();
});

test("degrades to a valid filtered URL if Apply lands before hydration", () => {
  renderForm({ name: "Hollow Knight", sort: "title", page: "5" });

  const form = screen
    .getByRole("button", { name: "Apply filters" })
    .closest("form")!;
  const submitted = new URLSearchParams();
  for (const field of form.querySelectorAll<HTMLInputElement>("input[name]")) {
    if (field.type === "checkbox" || field.type === "radio") {
      if (field.checked) {
        submitted.append(field.name, field.value);
      }
      continue;
    }
    submitted.append(field.name, field.value);
  }

  // The names a native GET submit would send are the API's own param names,
  // and the page is omitted so the search restarts at page 1.
  expect(submitted.get("name")).toBe("Hollow Knight");
  expect(submitted.get("sort")).toBe("title");
  expect(submitted.get("direction")).toBe("asc");
  expect(submitted.get("page")).toBeNull();
  expect(submitted.get("durationKind")).toBe("normal");
  expect([...submitted.keys()].every((key) => !key.includes(":"))).toBe(true);
});

test("carries a checked option as its own published id", () => {
  renderForm();

  fireEvent.click(screen.getByRole("checkbox", { name: "PC" }));

  const bubbled = screen
    .getByRole("button", { name: "Apply filters" })
    .closest("form")!
    .querySelector<HTMLInputElement>(
      'input[type="checkbox"][name="platform"]',
    )!;

  expect(bubbled.value).toBe("pc");
});

test("clear-all links to the same search without any structured filter", () => {
  renderForm({
    name: "Hollow Knight",
    sort: "rating",
    page: "4",
    platform: ["pc"],
    genre: ["indie"],
    minimumRating: "80",
    minimumDurationHours: "5",
  });

  const clearAll = screen.getByRole("link", { name: "Clear all" });
  const query = new URL(clearAll.getAttribute("href")!, "http://localhost")
    .searchParams;

  expect(Array.from(query.keys()).sort()).toEqual([
    "direction",
    "name",
    "page",
    "sort",
  ]);
  expect(query.get("name")).toBe("Hollow Knight");
  expect(query.get("sort")).toBe("rating");
  expect(query.get("page")).toBe("1");
});

test("hides clear-all when there is nothing applied to clear", () => {
  renderForm();

  expect(screen.queryByRole("link", { name: "Clear all" })).toBeNull();
});

test("reports the applied selection back to its host after a successful apply", async () => {
  const onApplied = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <FilterForm
        metadata={metadata}
        onApplied={onApplied}
        params={parseBrowseParams({})}
      />
    </NextIntlClientProvider>,
  );

  fireEvent.click(screen.getByRole("checkbox", { name: "PC" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  await waitFor(() => expect(onApplied).toHaveBeenCalled());
});
