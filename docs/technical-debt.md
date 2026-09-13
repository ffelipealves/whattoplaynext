# Technical Debt Register

Known compromises that are deliberate, understood, and not yet worth paying
off. Each entry says what it costs today and what paying it off would involve,
so a future decision can be made on evidence rather than memory.

This is not a bug list: everything here works as designed. Defects go to the
milestone plans and their outcome notes. Items marked **blocking** must be
resolved before the release gate that names them.

Last reviewed: 2026-09-13, after Milestone 2.9.

## Provider and API

### 1. Browse does not enforce content eligibility — **blocking for public beta**

`GET /api/v1/games/{gameId}` rejects anything outside `ELIGIBLE_GAME_TYPES`
(base games plus remakes and remasters), but browse does not: `_where_query`
never constrains `game_type`, so DLC, expansions, bundles, and mods count as
results. It shows as a jarring total — a rating sort reports ~375,000 games
against the ~73,000 the popularity index covers — and as occasional non-game
entries in a page.

First flagged in the [Milestone 1 review](milestone-1-review.md#deferred-external-actions);
Milestone 2.3 then observed it from the frontend. Paying it off means adding
the eligibility clause to the browse `where` and to the candidate queries, and
accepting that every total and page count changes. The fixture-backed API
tests will need their expected counts revisited.

### 2. A duration filter still costs seconds on a cold cache

Evaluating play time has to read two IGDB datasets and join them locally, since
`games` cannot be filtered by a field that lives on `game_time_to_beats`.
Milestone 2.4's follow-up cut a duration-filtered search from ~30 s to ~10 s by
bounding the smaller index first, but ~10 s is the floor for that shape of
query against a provider allowing four requests per second.

Redis hides this in normal operation; it is only the cold path that hurts, and
Milestone 4 owns caching. Paying it off further would mean caching the duration
index itself — it is small enough (~9,300 rows) to hold whole — rather than
re-reading it per request.

### 2b. A platform release range still materializes its whole match set

**Resolved for the sort; partially resolved for the range.** Ordering by a
platform's release date used to read every matching game; it now pages the
`release_dates` index in date order and stops as soon as the requested page
cannot change, taking `platform=pc&sort=release-date` from over 75 s (no
response) to 3.2 s. A release _range_ on a platform now reads that index
bounded by the dates instead of scanning the catalog, which took
`platform=pc` + all of 2020 from over 180 s to 58 s.

What remains is the count. That shape matches 12,265 games, and an exact
`totalItems` — which pagination depends on — means resolving every one of them
through the games endpoint to apply the rest of the filter: about fifty
requests against a provider allowing four per second. Narrower ranges are
proportionally better (a year of Switch indies answers in 18 s), and Redis
hides all of it once warm.

Paying off the rest means either giving up an exact total for this shape, or
skipping the join when the platform is the only game-level criterion — the
index walk alone already determines the result set then, since every candidate
it returns has a release on the selected platform.

### 3. The popularity fallback still reads every match

`_every_matching_id_by_popularity` lists every matching id and then every id's
popularity. The index walk added in Milestone 2.4's follow-up avoids it for
broad filters, and the `POPULARITY_WALK_THRESHOLD` gate keeps it to small match
sets where it costs a handful of requests — but it is still an O(matches) path
that a pathological filter (many matches, none of them ranked) can reach.

It is bounded in practice and correct in all cases, which is why it stays.

### 4. The API has no rate limiter of its own

`RATE_LIMITED` only ever surfaces when IGDB itself returns 429; nothing
protects the provider from this service, or this service from a caller. The
architecture places rate limiting before provider access, and Milestone 4 owns
it. The consequence today is that the frontend's rate-limit state — copy,
retry timing, and all — has never run against a live 429 and is covered by
component tests alone.

## Web application

### 5. Filter metadata failures are still generic

Since Milestone 2.7, a failed search carries a classified `ApiFailure` and
explains itself. `getFilterMetadata` still collapses every failure to
`{ok: false}`, so the sidebar says "Filters unavailable" whether the API was
rate-limited, timed out, or was never reached — and the page can end up
explaining the same outage two different ways at once.

Paying it off is small and mechanical: return the failure from
`getFilterMetadata` the way `getSearchResults` does, and give
`FiltersUnavailable` the same per-code copy. It was left out of 2.7 to keep
that increment to the surface its acceptance criteria named.

### 6. Autocomplete never recovers without a reload

`useAutocomplete` turns itself off permanently once a request fails, which is
deliberate: retrying on every keystroke against a provider that just rate-
limited us is how a soft failure becomes a hard one. The cost is that a
visitor whose suggestions failed once keeps a plain field for the rest of the
page's life, even after the API recovers.

A backoff that re-enables after a delay would fix it without reintroducing the
retry storm, but needs a deliberate policy rather than a guessed interval.

### 7. `src/app/**` sits outside the coverage floor

Coverage thresholds cover `src/features/**` and `src/lib/**`. Pages and route
handlers are excluded, so the autocomplete route handler's tests — which do
exist — count for nothing in the gate.

Milestone 2.8 shrank this by moving the search page's composition into
`features/search/search-page.tsx`, leaving the route with data fetching alone;
what remains outside the floor is four thin files and one route handler. It is
worth either extending the floor to `src/app/**` or writing down why those
files are exempt, rather than leaving the boundary where it landed by
accident.

### 8. Selected ids are cast to the contract's unions

`features/search/selected-ids.ts` casts `string[]` to the generated client's
narrower enum unions at a single documented seam. The alternative is a second
copy of the allow-lists in the frontend, which the architecture explicitly
rejects: the published `GET /api/v1/filters` response is the source of truth,
and it is only known at runtime. The cast is safe because unknown ids are
dropped at parse time when that response is available and rejected by the API
when it is not.

Kept deliberately; recorded so the next reader does not "fix" it by
hardcoding the enums.

### 9. The search page reads filter metadata before it can search

Parsing the URL needs the published allow-lists and limits, so the games route
awaits `GET /api/v1/filters` before it can parse criteria and only then queries
results. That is one extra sequential round trip on every search page view,
against an endpoint the API caches for seven days.

Removing it means either giving up URL validation against the published
allow-list, or caching the metadata in the web application — the latter is a
Milestone 4 concern.

## End-to-end suite

### 10. The browser suite stops at the Milestone 2.3 journeys

The six scenarios cover exactly the six journeys Milestone 2.9 named: name
search, URL restoration with back and forward, pagination, the locale switch,
an upstream failure, and a zero-result. Everything built after that — the
filter sidebar and drawer, the chips, autocomplete, the ignored-criteria
notice — has component tests and was verified by hand in a browser, but no
browser-level regression test.

The gap that matters most is Apply, because it is the one interaction whose
correctness depends on hydration: a draft that reaches the URL only on submit,
through a client navigation. Component tests assert the query string it
pushes; nothing asserts that a real click in a real browser gets there. Adding
a filters scenario to the existing suite is cheap now that the fixture catalog
honours platform and genre criteria.

### 11. `pnpm e2e` leaves the build pointing at the fixture API

The suite builds the web application with `NEXT_PUBLIC_API_BASE_URL` pointing
at its own fixture server, because that value is inlined at build time and
cannot be changed afterwards. The quality gate runs the suite _before_ `pnpm
build` so the canonical output is the last one written, but running `pnpm e2e`
on its own leaves `.next` built against port 8100 — a later `pnpm start` would
then talk to a server that is no longer running.

`pnpm dev:web` is unaffected, which is why this has not bitten anyone yet.
Paying it off means building the suite's application into its own `distDir`,
so the two builds stop sharing one directory.

### 12. A stale server can be reused locally

`reuseExistingServer` is on outside CI, so a run reuses whatever already
listens on 3100 or 8100. That is what makes repeated local runs fast, and it
is also how a suite can pass against a build from twenty minutes ago. CI
always starts its own, so this never produces a false green there — but it can
locally, and the failure mode (passing tests, stale code) is the kind that
costs an afternoon.

### 13. Only Chromium

One browser project is configured. Milestone 2.10 owns the cross-browser pass
(the two latest stable releases of Chrome, Edge, Firefox, and Safari), and
whether that becomes a permanent matrix in the gate or a periodic manual pass
is a decision for that increment: a four-browser matrix on every push buys
less than it costs when the suite is six scenarios long.
