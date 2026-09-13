import { NextIntlClientProvider } from "next-intl";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import enMessages from "../../../messages/en.json";
import ptMessages from "../../../messages/pt-br.json";
import type { FilterMetadata } from "@/features/catalog/get-filter-metadata";

import { ActiveFilterChips } from "./active-filter-chips";
import { parseBrowseParams, type RawSearchParams } from "./browse-params";

const metadata: FilterMetadata = {
  platforms: [
    { id: "pc", label: "PC" },
    { id: "nintendo-switch", label: "Nintendo Switch" },
  ],
  genres: [{ id: "shooter", label: "Shooter" }],
  gameModes: [{ id: "co-operative", label: "Co-operative" }],
  durationKinds: ["fast", "normal", "completionist"],
  sortOptions: ["popularity"],
  limits: {
    pageSize: 24,
    maximumPage: 100,
    minimumAutocompleteLength: 2,
    maximumNameLength: 100,
    minimumDurationHours: 1,
    maximumDurationHours: 1000,
  },
};

function renderChips(
  searchParams: RawSearchParams,
  options: { metadata?: FilterMetadata; messages?: typeof enMessages } = {},
) {
  return render(
    <NextIntlClientProvider
      locale={options.messages === ptMessages ? "pt-br" : "en"}
      messages={options.messages ?? enMessages}
    >
      <ActiveFilterChips
        metadata={"metadata" in options ? options.metadata : metadata}
        params={parseBrowseParams(searchParams)}
      />
    </NextIntlClientProvider>,
  );
}

function queryOf(link: Element): URLSearchParams {
  return new URL(link.getAttribute("href")!, "http://localhost").searchParams;
}

test("renders nothing when no structured filter is applied", () => {
  const { container } = renderChips({ name: "Hollow Knight", page: "2" });

  expect(container.firstChild).toBeNull();
});

test("labels each chip with the catalog's own option label", () => {
  renderChips({
    platform: ["pc"],
    genre: ["shooter"],
    gameMode: ["co-operative"],
  });

  expect(screen.getByText("Platform: PC")).toBeDefined();
  expect(screen.getByText("Genre: Shooter")).toBeDefined();
  expect(screen.getByText("Mode: Co-operative")).toBeDefined();
});

test("falls back to the raw id when the catalog is unavailable", () => {
  renderChips({ platform: ["pc"] }, { metadata: undefined });

  expect(screen.getByText("Platform: pc")).toBeDefined();
});

test("removing one chip clears only that criterion and returns to page 1", () => {
  renderChips({
    name: "Hollow Knight",
    page: "3",
    platform: ["pc", "nintendo-switch"],
    genre: ["shooter"],
  });

  const query = queryOf(
    screen.getByRole("link", { name: "Remove filter: Platform: PC" }),
  );

  expect(query.getAll("platform")).toEqual(["nintendo-switch"]);
  expect(query.getAll("genre")).toEqual(["shooter"]);
  expect(query.get("name")).toBe("Hollow Knight");
  expect(query.get("page")).toBe("1");
});

test("describes a full release range, a rating, and a duration range", () => {
  renderChips({
    releaseFrom: "2020-01-01",
    releaseTo: "2024-12-31",
    minimumRating: "80",
    durationKind: "completionist",
    minimumDurationHours: "5",
    maximumDurationHours: "40",
  });

  expect(screen.getByText("Released 2020-01-01 to 2024-12-31")).toBeDefined();
  expect(screen.getByText("Rating 80 or higher")).toBeDefined();
  expect(screen.getByText("Play time 5–40 h (Completionist)")).toBeDefined();
});

test("describes a one-sided release range", () => {
  renderChips({ releaseFrom: "2020-01-01" });
  expect(screen.getByText("Released from 2020-01-01")).toBeDefined();
});

test("describes a release range bounded only on the later end", () => {
  renderChips({ releaseTo: "2024-12-31" });
  expect(screen.getByText("Released up to 2024-12-31")).toBeDefined();
});

test("describes a one-sided duration range", () => {
  renderChips({ minimumDurationHours: "5" });
  expect(screen.getByText("Play time 5 h or more (Normal)")).toBeDefined();

  renderChips({ maximumDurationHours: "40" });
  expect(screen.getByText("Play time up to 40 h (Normal)")).toBeDefined();
});

test("removing the release chip clears both of its bounds at once", () => {
  renderChips({
    releaseFrom: "2020-01-01",
    releaseTo: "2024-12-31",
    platform: ["pc"],
  });

  const query = queryOf(
    screen.getByRole("link", {
      name: "Remove filter: Released 2020-01-01 to 2024-12-31",
    }),
  );

  expect(query.get("releaseFrom")).toBeNull();
  expect(query.get("releaseTo")).toBeNull();
  expect(query.getAll("platform")).toEqual(["pc"]);
});

test("removing the duration chip also drops its qualifying kind", () => {
  renderChips({ durationKind: "fast", minimumDurationHours: "5" });

  const query = queryOf(
    screen.getByRole("link", {
      name: "Remove filter: Play time 5 h or more (Fast)",
    }),
  );

  expect(query.get("minimumDurationHours")).toBeNull();
  expect(query.get("durationKind")).toBeNull();
});

test("localizes the chip copy without translating provider labels", () => {
  renderChips(
    { platform: ["pc"], minimumRating: "80" },
    { messages: ptMessages },
  );

  expect(screen.getByText("Plataforma: PC")).toBeDefined();
  expect(screen.getByText("Nota 80 ou mais")).toBeDefined();
});
