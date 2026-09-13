import { NextIntlClientProvider } from "next-intl";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import enMessages from "../../../messages/en.json";

import { NameSearchForm } from "./name-search-form";
import { parseBrowseParams, type RawSearchParams } from "./browse-params";
import type { AutocompleteSuggestion } from "./get-autocomplete-suggestions";

const MINIMUM_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

const hollowKnight: AutocompleteSuggestion = {
  id: 1942,
  slug: "hollow-knight",
  title: "Hollow Knight",
  releaseYear: 2017,
  cover: null,
};

const hades: AutocompleteSuggestion = {
  id: 113112,
  slug: "hades",
  title: "Hades",
  releaseYear: null,
  cover: null,
};

let fetchMock: ReturnType<typeof vi.fn>;

function respondWith(items: AutocompleteSuggestion[]) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ items }),
  } as unknown as Response);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  fetchMock = vi.fn();
  respondWith([]);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function renderForm(
  searchParams: RawSearchParams = {},
  options: { minimumQueryLength?: number } = {},
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <NameSearchForm
        minimumQueryLength={
          "minimumQueryLength" in options
            ? options.minimumQueryLength
            : MINIMUM_QUERY_LENGTH
        }
        params={parseBrowseParams(searchParams)}
      />
    </NextIntlClientProvider>,
  );
}

/** jsdom implements no implicit form submission, so what actually decides
 * whether the browser would submit is whether the keydown was cancelled. */
function pressEnter(): boolean {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: "Enter",
  });
  act(() => {
    field().dispatchEvent(event);
  });
  return event.defaultPrevented;
}

function field(): HTMLInputElement {
  return screen.getByLabelText("Game name") as HTMLInputElement;
}

async function type(value: string) {
  fireEvent.change(field(), { target: { value } });
}

async function settleDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  });
}

function requestedQueries(): string[] {
  return fetchMock.mock.calls.map((call) =>
    new URL(String(call[0]), "http://localhost").searchParams.get("q")!,
  );
}

test("asks for nothing below the published minimum query length", async () => {
  renderForm();

  await type("h");
  await settleDebounce();

  expect(fetchMock).not.toHaveBeenCalled();
});

test("asks for nothing until the debounce window closes", async () => {
  renderForm();

  await type("hollow");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 50);
  });
  expect(fetchMock).not.toHaveBeenCalled();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  expect(requestedQueries()).toEqual(["hollow"]);
});

test("collapses a burst of keystrokes into the last query", async () => {
  renderForm();

  await type("ho");
  await type("holl");
  await type("hollow");
  await settleDebounce();

  expect(requestedQueries()).toEqual(["hollow"]);
});

test("carries the applied platform context into the request", async () => {
  renderForm({ platform: ["pc", "nintendo-switch"] });

  await type("hollow");
  await settleDebounce();

  const url = new URL(String(fetchMock.mock.calls[0][0]), "http://localhost");
  expect(url.pathname).toBe("/api/autocomplete");
  expect(url.searchParams.getAll("platform")).toEqual([
    "pc",
    "nintendo-switch",
  ]);
});

test("lists each suggestion with its title and year", async () => {
  respondWith([hollowKnight, hades]);
  renderForm();

  await type("ho");
  await settleDebounce();

  const options = await screen.findAllByRole("option");
  expect(options).toHaveLength(2);
  expect(options[0].textContent).toContain("Hollow Knight");
  expect(options[0].textContent).toContain("2017");
  // A missing year is shown as absent, never invented.
  expect(options[1].textContent).toContain("Hades");
  expect(options[1].textContent).toContain("—");
});

test("selecting a suggestion fills the field without submitting", async () => {
  respondWith([hollowKnight]);
  const submitted = vi.fn();
  renderForm();
  field().closest("form")!.addEventListener("submit", submitted);

  await type("ho");
  await settleDebounce();
  fireEvent.mouseDown(
    await screen.findByRole("option", { name: /Hollow Knight/ }),
  );

  expect(field().value).toBe("Hollow Knight");
  expect(submitted).not.toHaveBeenCalled();
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("selecting with the keyboard fills the field without submitting", async () => {
  respondWith([hollowKnight, hades]);
  renderForm();

  await type("ho");
  await settleDebounce();
  await screen.findByRole("listbox");

  fireEvent.keyDown(field(), { key: "ArrowDown" });
  fireEvent.keyDown(field(), { key: "ArrowDown" });

  expect(pressEnter()).toBe(true);
  expect(field().value).toBe("Hades");
});

test("submits the typed name when no suggestion is highlighted", async () => {
  respondWith([hollowKnight]);
  renderForm();

  await type("ho");
  await settleDebounce();
  await screen.findByRole("listbox");

  expect(pressEnter()).toBe(false);
  expect(field().value).toBe("ho");
});

test("wraps around the list with the arrow keys", async () => {
  respondWith([hollowKnight, hades]);
  renderForm();

  await type("ho");
  await settleDebounce();
  await screen.findByRole("listbox");

  // Up from nothing highlighted lands on the last suggestion.
  fireEvent.keyDown(field(), { key: "ArrowUp" });
  expect(pressEnter()).toBe(true);
  expect(field().value).toBe("Hades");
});

test("highlights the suggestion under the pointer, then closes on blur", async () => {
  respondWith([hollowKnight, hades]);
  renderForm();

  await type("ho");
  await settleDebounce();
  const options = await screen.findAllByRole("option");

  fireEvent.mouseEnter(options[1]);
  expect(options[1].getAttribute("aria-selected")).toBe("true");

  fireEvent.blur(field());
  expect(screen.queryByRole("listbox")).toBeNull();
});

test("a superseded request does not degrade the field", async () => {
  // The first query is still in flight when the next keystroke aborts it;
  // that abort must not read as an autocomplete failure.
  fetchMock.mockImplementation(
    (_url: string, init: { signal: AbortSignal }) =>
      new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
        if (!init.signal.aborted) {
          setTimeout(
            () => resolve({ ok: true, json: async () => ({ items: [] }) }),
            5_000,
          );
        }
      }),
  );
  renderForm();

  await type("hollow");
  await settleDebounce();
  await type("hollow knight");
  await settleDebounce();

  expect(field().getAttribute("role")).toBe("combobox");
});

test("closes the suggestion list on Escape", async () => {
  respondWith([hollowKnight]);
  renderForm();

  await type("ho");
  await settleDebounce();
  await screen.findByRole("listbox");

  fireEvent.keyDown(field(), { key: "Escape" });

  expect(screen.queryByRole("listbox")).toBeNull();
  expect(field().value).toBe("ho");
});

test("degrades to a plain field when suggestions fail, and stops asking", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    status: 502,
  } as unknown as Response);
  renderForm();

  await type("hollow");
  await settleDebounce();

  await waitFor(() =>
    expect(field().getAttribute("role")).not.toBe("combobox"),
  );
  expect(screen.queryByRole("listbox")).toBeNull();

  // The field stays usable, and a search can still be submitted by hand.
  await type("hollow knight");
  await settleDebounce();
  expect(requestedQueries()).toEqual(["hollow"]);
  expect(field().value).toBe("hollow knight");
});

test("degrades the same way when the request itself fails", async () => {
  fetchMock.mockRejectedValue(new TypeError("fetch failed"));
  renderForm();

  await type("hollow");
  await settleDebounce();

  await waitFor(() =>
    expect(field().getAttribute("role")).not.toBe("combobox"),
  );
});

test("stays a plain field when the published minimum is unavailable", async () => {
  renderForm({}, { minimumQueryLength: undefined });

  await type("hollow");
  await settleDebounce();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole("searchbox")).toBeDefined();
});

test("pre-fills the current name and preserves sort/direction as hidden fields", () => {
  renderForm({
    name: "Hollow Knight",
    sort: "title",
    direction: "asc",
    page: "4",
  });

  expect(field().value).toBe("Hollow Knight");
  expect(hiddenFields()).toEqual([
    ["sort", "title"],
    ["direction", "asc"],
  ]);
});

test("omits a page field so submitting restarts at page 1", () => {
  renderForm({ sort: "popularity", page: "5" });

  expect(
    field().closest("form")!.querySelector('input[name="page"]'),
  ).toBeNull();
});

test("carries the applied filters forward so a name search narrows them", () => {
  renderForm({
    platform: ["pc", "nintendo-switch"],
    genre: ["shooter"],
    minimumRating: "80",
    durationKind: "fast",
    minimumDurationHours: "2",
  });

  expect(hiddenFields()).toEqual([
    ["sort", "popularity"],
    ["direction", "desc"],
    // One field per selected id: a native GET form repeats the param, exactly
    // like the sort and pagination links do.
    ["platform", "pc"],
    ["platform", "nintendo-switch"],
    ["genre", "shooter"],
    ["minimumRating", "80"],
    ["durationKind", "fast"],
    ["minimumDurationHours", "2"],
  ]);
});

function hiddenFields(): [string, string][] {
  return Array.from(
    field()
      .closest("form")!
      .querySelectorAll<HTMLInputElement>('input[type="hidden"]'),
  ).map((input) => [input.name, input.value]);
}
