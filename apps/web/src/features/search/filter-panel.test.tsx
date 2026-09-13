import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import type { FilterMetadata } from "@/features/catalog/get-filter-metadata";

import { FilterDrawer } from "./filter-drawer";
import { FilterSidebar } from "./filter-sidebar";
import { parseBrowseParams, type RawSearchParams } from "./browse-params";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

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

beforeEach(() => {
  pushMock.mockReset();
});

function withIntl(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function params(searchParams: RawSearchParams = {}) {
  return parseBrowseParams(searchParams);
}

function lastPushedQuery(): URLSearchParams {
  const href = pushMock.mock.calls.at(-1)![0] as string;
  return new URL(href, "http://localhost").searchParams;
}

test("the sidebar labels itself and renders the filter controls", () => {
  render(withIntl(<FilterSidebar metadata={metadata} params={params()} />));

  expect(screen.getByRole("complementary", { name: "Filters" })).toBeDefined();
  expect(screen.getByRole("checkbox", { name: "PC" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Apply filters" })).toBeDefined();
});

test("the sidebar explains itself instead of rendering controls it cannot source", () => {
  render(withIntl(<FilterSidebar params={params()} />));

  expect(screen.getByText("Filters unavailable")).toBeDefined();
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Apply filters" })).toBeNull();
});

test("the drawer trigger counts the applied filters, matching the chips", () => {
  render(
    withIntl(
      <FilterDrawer
        metadata={metadata}
        params={params({
          platform: ["pc", "nintendo-switch"],
          genre: ["shooter"],
          minimumRating: "80",
          minimumDurationHours: "5",
        })}
      />,
    ),
  );

  expect(screen.getByRole("button", { name: "Filters (5)" })).toBeDefined();
});

test("the drawer trigger carries no count when nothing is applied", () => {
  render(withIntl(<FilterDrawer metadata={metadata} params={params()} />));

  expect(screen.getByRole("button", { name: "Filters" })).toBeDefined();
});

test("the drawer reveals the same controls once opened", async () => {
  render(withIntl(<FilterDrawer metadata={metadata} params={params()} />));

  fireEvent.click(screen.getByRole("button", { name: "Filters" }));

  expect(await screen.findByRole("checkbox", { name: "PC" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Apply filters" })).toBeDefined();
});

test("the drawer explains unavailable filters too", async () => {
  render(withIntl(<FilterDrawer params={params()} />));

  fireEvent.click(screen.getByRole("button", { name: "Filters" }));

  expect(await screen.findByText("Filters unavailable")).toBeDefined();
});

test("both layouts submit the identical URL for the same selection", async () => {
  const applied = params({ name: "Hollow Knight", sort: "rating" });

  const sidebar = render(
    withIntl(<FilterSidebar metadata={metadata} params={applied} />),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "PC" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Shooter" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
  const fromSidebar = lastPushedQuery().toString();
  sidebar.unmount();

  render(withIntl(<FilterDrawer metadata={metadata} params={applied} />));
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "PC" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Shooter" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(2));

  expect(lastPushedQuery().toString()).toBe(fromSidebar);
});

test("the drawer keeps its actions pinned while the groups scroll", async () => {
  render(withIntl(<FilterDrawer metadata={metadata} params={params()} />));

  fireEvent.click(screen.getByRole("button", { name: "Filters" }));

  const apply = await screen.findByRole("button", { name: "Apply filters" });
  expect(apply.parentElement!.className).toContain("sticky");
});

test("the drawer closes on Escape without applying anything", async () => {
  render(withIntl(<FilterDrawer metadata={metadata} params={params()} />));

  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.keyDown(dialog, { key: "Escape" });

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(pushMock).not.toHaveBeenCalled();
});

test("the drawer moves focus into itself when it opens", async () => {
  render(withIntl(<FilterDrawer metadata={metadata} params={params()} />));

  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  const dialog = await screen.findByRole("dialog");

  await waitFor(() =>
    expect(dialog.contains(document.activeElement)).toBe(true),
  );
});

test("the drawer closes itself once its selection is applied", async () => {
  render(withIntl(<FilterDrawer metadata={metadata} params={params()} />));

  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.click(await screen.findByRole("checkbox", { name: "PC" }));
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  await waitFor(() =>
    expect(screen.queryByRole("checkbox", { name: "PC" })).toBeNull(),
  );
});
