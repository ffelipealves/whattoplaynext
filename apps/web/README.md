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

`WTPN_SITE_ORIGIN` is the server-only public origin used for canonical,
alternate, Open Graph, and robots URLs. It is required even though the final
domain is not selected: use `http://localhost:3000` locally and configure the
actual origin independently in each deployed environment. Values with a path,
query, hash, credentials, or a non-HTTP protocol are rejected.

`WTPN_API_EDGE_TOKEN` is the server-only secret shared with the API's
`WTPN_EDGE_TOKEN`; with it, calls made for a visitor carry that visitor's
address so the API can rate-limit visitors separately. `NEXT_PUBLIC_UMAMI_*`
configures analytics, which stays off without a website ID.

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
generated `@whattoplaynext/contracts` package; feature code never imports
`openapi-fetch` or hand-writes request/response types. Calls made while
serving a visitor use `getVisitorApiClient()`. It sends one `X-Request-ID` per
render and, with the edge token, the first `X-Forwarded-For` entry as the
visitor's address (never `X-Real-IP`). The sitemap, which renders outside any
request, uses the header-free `getApiClient()`. `src/components/ui/` holds the shadcn/ui primitives still in use (button,
checkbox, kbd, sheet, skeleton, slider) themed through the CSS variables in
`globals.css`.

The site is dark only: `<html>` always carries `.dark`. `globals.css` defines
the "ink/ember" scale (`--color-ink-*`, `--color-ember-*`, the rating tones
`good`/`mid`/`low`), maps the shadcn tokens onto it, and adds the motion
keyframes and the `scrollbar-*` and `grain` utilities. `ink-400`, the muted
text colour, is lighter than the reference's so it clears 4.5:1 on every card
and panel surface; text never sits on `ink-700`. Fonts are Geist, Geist Mono,
and Bricolage Grotesque with its optical-size axis for headings.

## Search (home page)

`app/[locale]/(browse)/page.tsx` fetches; `features/search/search-page.tsx`
renders. The home page is the search; `/games` redirects to it with its query. Submitted state lives entirely in the URL — nothing is applied before
an explicit action, and a copied link restores the same search. The one
exception is the genre chip row (`genre-chips.tsx`): each chip is a link to
the same search with that genre toggled, so it applies at once.

The header (`site-header.tsx`) lives in `(browse)/layout.tsx` on this route,
so it stays put while a new search loads, and reads the criteria from the URL
(`header-search.tsx`) to keep them when a name is searched from it. Other
routes render the same header without autocomplete: only this route loads the
filter metadata, which `getFilterMetadata` memoizes per render so the layout
and the page share one call. The language switch is a plain link, a full
load, so switching locale on a game page is never intercepted into the modal.

`view=list` lays the results out as rows (`ResultRow`); it is parsed with the
other criteria, carried by every link, and never sent to the API or counted as
a new search. On the bare home page (no criteria, default sort, first page),
`features/featured/` features the first four results above them; their
details stream in behind a same-size placeholder, so the results never wait.

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

The filter form's release and play-time sliders hold the URL's strings in
their draft, so an exact date or hour count from a shared link survives until
its own thumb moves; those values also ride as hidden fields for a submit
before hydration.

## Game pages and the modal

`app/[locale]/games/[id]/[slug]/page.tsx` renders the full page
(`GameDetailPage`), with its canonical redirect, metadata, and error
boundaries. A game opened by a client navigation from inside the site — a
result card, the featured carousel — is intercepted by
`app/[locale]/@modal/(.)games/[id]/[slug]/page.tsx` and shown in
`game-modal.tsx` over the page it came from, with the same
`GameDetailContent`. A reload or a shared link loads the full page. The
`@modal` slot's `default.tsx` and `page.tsx` return nothing, so the slot is
empty on a full load and closes on a client navigation back to the home page.

Previous and next in the modal step through the results page it was opened
from: `RegisterResultSequence` records the page's games in a context
(`result-sequence.tsx`) that sits above both the page and the slot. Steps
replace the open game, so Back closes the modal and returns the search at its
scroll position. The intercepted route shows failures inside the modal rather
than throwing, so the page behind it never gives way to an error screen.

`lib/api-failure.ts` classifies one API error response into a state the UI can
speak about, including the two the envelope cannot express — a request that
never arrived, and a response that was not the published envelope at all.
`search-failure.tsx` renders one distinct explanation per state, with the
retry timing a rate-limited response provides, and offers no retry for the
codes that mean the criteria themselves were rejected.

## Stale data

When the API answers from an expired cache entry because IGDB failed,
`features/catalog/stale-data-notice.tsx` shows a localized note with the save
time in UTC above the results and at the top of the game page. It never
presents such data as current.

## Security headers

`src/lib/security-headers.ts` builds the headers `next.config.ts` sends with
every page:

- a CSP with `default-src 'self'`, closed `object-src`, `base-uri`,
  `form-action`, and `frame-ancestors`, and the analytics origins only when
  analytics is configured;
- `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Cross-Origin-Opener-Policy`, and `Permissions-Policy`;
- HSTS and `upgrade-insecure-requests` only for an `https://` site origin.

`'unsafe-inline'` remains in `script-src` for the App Router's inline
bootstrap; the [security review](../../docs/security-review.md) records why.
`X-Powered-By` is off.

## Analytics

`src/features/analytics/` is the only code that talks to Umami:

- `events.ts` holds the allow-list of events, properties, and buckets, and
  enforces it at run time;
- `track.ts` owns `window.umami`. It queues early calls until the script
  loads, and it sends page views by route template (`/en/games/[game]`) with
  an empty title and the referrer's host only;
- small client components in `trackers.tsx` emit the search, sort, game,
  external-link, failure, and stale events.

No search text, title, slug, game ID, URL, or filter value is ever sent.

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

Every configuration is a named project in `playwright.config.ts`, selected with
`--project` so no script depends on shell-specific environment syntax: the gate
runs `chromium`; `pnpm e2e:browsers` runs the desktop and mobile matrix; and
`pnpm e2e:vitals` runs the `vitals-*` projects, which measure LCP, INP, and CLS
on the search and game pages and report them against NFR-003's targets.

The suite's build turns analytics on against a recording stub that the fixture
API serves (`/e2e/umami-stub.js`), so `analytics.spec.ts` inspects the
payloads that would be sent. `security.spec.ts` checks the headers and fails
on any CSP violation. Set
`E2E_BASE_URL` to point any of them at an application you are already serving
— a build against the live API, say — and the suite starts no servers of its
own.

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
