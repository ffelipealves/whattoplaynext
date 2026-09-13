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

## Unfiltered search (`/games`)

`app/[locale]/games/page.tsx` is the search results route. Submitted state
lives entirely in the URL — `features/search/browse-params.ts` parses `name`,
`sort`, `direction`, and `page` from `searchParams` with Zod, clamping
out-of-range values (page above 100, an unknown sort) to the nearest valid
bound rather than forwarding a request the API would reject anyway. Sorting
and pagination (`sort-links.tsx`, `pagination-links.tsx`) are plain
server-rendered `Link`s that carry the rest of the active query forward; the
name field (`name-search-form.tsx`) is a native GET `<form>` with hidden
`sort`/`direction` inputs so a new search preserves them while intentionally
resetting to page 1. None of this needs a Client Component.

`getSearchResults()` follows `getCatalogStatus()`'s pattern from the home
page: a classified API error and a rejected `fetch()` both become one
`{ok: false}` result. `results-grid.tsx` renders that as a state visually and
semantically distinct from a genuine zero-result page, which itself echoes
the submitted name back to the visitor. `app/[locale]/games/loading.tsx`
shows a skeleton grid via Next's route-level Suspense boundary while the
server-rendered fetch resolves. Game cover art renders through `next/image`;
`next.config.ts` allow-lists `images.igdb.com` for this.

## Checks

```bash
pnpm lint:web
pnpm typecheck:web
pnpm test:web
pnpm build:web
```

Run these commands from the repository root. `pnpm quality` runs the complete
web, API, and contracts quality gate; `pnpm check` is an alias.
