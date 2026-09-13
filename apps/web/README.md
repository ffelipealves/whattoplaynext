# What To Play Next — Web

The public web application uses Next.js App Router, strict TypeScript, and
Tailwind CSS. English is the default locale and Brazilian Portuguese is the
secondary locale.

## Development

```bash
pnpm dev:web
```

Open <http://localhost:3000/>. `src/proxy.ts` (Next.js 16's renamed
middleware) redirects the bare root to a locale — the visitor's browser
language when recognized, otherwise English — and remembers the choice in a
`NEXT_LOCALE` cookie so a later visit or the language switcher does not
re-negotiate it. English is the default locale and Brazilian Portuguese is
the secondary locale, both always prefixed (`/en`, `/pt-br`).

Copy `.env.example` to `.env.local` when overriding local configuration. Every
`NEXT_PUBLIC_` value is visible to browsers and must not contain a credential.
`NEXT_PUBLIC_API_BASE_URL` is the API origin; generated endpoint paths already
contain the `/api/v1` prefix.

## Internationalization

`next-intl` owns locale routing and every first-party UI string; provider
text (game titles, summaries) is never routed through it. `src/i18n/routing.ts`
is the single source of truth for supported locales, consumed by the
middleware (`src/proxy.ts`), the navigation helpers (`src/i18n/navigation.ts`,
re-exporting a locale-aware `Link`), and `src/i18n/request.ts`. The request
config reads the current locale through `next/root-params` (Next.js 16.3+)
rather than the deprecated `requestLocale` callback parameter, which is only
possible because `app/[locale]/layout.tsx` is the actual root layout — there
is no separate unlocalized `app/layout.tsx`.

Messages live in `messages/en.json` and `messages/pt-br.json`, one flat
namespace per feature (for example `Landing`). Components read them with
`useTranslations("Landing")` from `"next-intl"`, which works in both Server
and Client Components; there is no more hand-rolled per-locale content
dictionary. Add a new UI string by adding the same key to both message files,
not by branching on the locale in component code.

## API client and design system

`src/lib/api-client.ts` is the only place that constructs a client from the
generated `@whattoplaynext/contracts` package; feature code calls
`getApiClient()` rather than importing `openapi-fetch` or hand-writing
request/response types. `src/components/ui/` holds shadcn/ui primitives
(button, input, select, checkbox, slider, sheet, badge, skeleton) themed
through the CSS variables in `globals.css`, which reuse this project's own
brand palette rather than shadcn's generic defaults.

The home page proves this wiring end to end: it fetches filter metadata on
the server and renders "Live catalog: N platforms · N genres · N modes" next
to the primary action. Stop the local API and reload to see the documented
failure state instead — "Catalog temporarily unavailable" — rather than a
crashed page; `getCatalogStatus()` treats both a classified API error and a
rejected fetch (API process unreachable) as the same graceful "unreachable"
state.

## Search (`/games`)

`app/[locale]/games/page.tsx` fetches; `features/search/search-page.tsx`
renders. Submitted state lives entirely in the URL — nothing is applied before
an explicit action, and a copied link restores the same search.

`features/search/browse-params.ts` parses every criterion with Zod against the
bounds `GET /api/v1/filters` publishes, so the allow-listed platform, genre,
and game-mode ids exist in one place only: the API's own response. It returns
what it had to ignore alongside what it parsed, and `ignored-criteria.tsx`
says so, rather than quietly searching for something other than the URL claims.

Everything that can be a link is one. Sorting, pagination, each active-filter
chip's remove affordance, Clear all, and the retry on a failed search are all
plain server-rendered `Link`s carrying the rest of the criteria forward.

Three surfaces need a Client Component, and each degrades:

- **the filter form** (`filter-form.tsx`, react-hook-form) keeps a draft that
  reaches neither the URL nor the network until Apply. Its controls carry the
  API's own parameter names, so a submit that lands before hydration still
  produces a valid filtered URL. `filter-sidebar.tsx` and `filter-drawer.tsx`
  render the same form, which is why both layouts cannot drift apart;
- **the name field** (`name-search-form.tsx`) is still a native GET form
  carrying every applied filter as hidden fields; the ARIA combobox sits on
  top. `use-autocomplete.ts` asks for nothing below the published minimum
  length or inside a 300 ms window, aborts superseded requests, and turns
  itself off for good on failure rather than retrying against a provider that
  just rate-limited us. The browser reaches suggestions through
  `app/api/autocomplete/route.ts`, not the API directly, so the API's base URL
  and the typed client stay on the server;
- **the drawer** owns only whether it is open.

`lib/api-failure.ts` classifies one API error response into a state the UI can
speak about, including the two the envelope cannot express — a request that
never arrived, and a response that was not the published envelope at all.
`search-failure.tsx` renders one distinct explanation per state, with the
retry timing a rate-limited response provides, and offers no retry for the
codes that mean the criteria themselves were rejected.

## Accessibility

`search-page.a11y.test.tsx` runs axe over four states — desktop, the opened
drawer, a failed search, and the ignored-criteria notice — and fails on any
critical or serious violation. Colour contrast is the one rule jsdom cannot
evaluate and is checked in a real browser instead.

The result count is a live region that is always present, because a
`role="status"` rendered only alongside its content announces nothing, and
applying a filter is a client navigation with no page load to announce it.

## End-to-end

`e2e/` holds the Playwright suite; `pnpm e2e` runs it from the repository
root. It starts the real API composed with a fixture catalog
(`apps/api/tests/e2e/`) and a production build of this application on ports
8100 and 3100, so it needs no credentials and collides with nothing you have
running. A production build rather than `next dev`, which refuses to run twice
in one directory.

## Checks

```bash
pnpm lint:web
pnpm typecheck:web
pnpm test:web
pnpm e2e
pnpm build:web
```

Run these commands from the repository root. `pnpm quality` runs the complete
web, API, and contracts quality gate; `pnpm check` is an alias.
