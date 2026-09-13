# Technical Debt Register

Known compromises that are deliberate, understood, and not yet worth paying
off. Each entry says what it costs today and what paying it off would involve,
so a future decision can be made on evidence rather than memory.

This is not a bug list: everything here works as designed. Defects go to the
milestone plans and their outcome notes. Items marked **blocking** must be
resolved before the release gate that names them.

Last reviewed: 2026-09-13, after Milestone 2.8.

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

### 2b. Release-date sort with a platform filter is effectively unusable — **blocking for closed beta**

Selecting a platform _and_ sorting by release date sends the query down
`_locally_evaluated_page`, because per-platform release dates live on a nested
field the games endpoint cannot sort by. Unlike the duration path, nothing
narrows the scan first: every matching game is read 500 at a time, so
`platform=pc&sort=release-date` walks ~207,000 games. Measured against the
local API with no cache: **over 75 s** (no response within the timeout), while
the same sort without a platform filter answers in 1.8 s.

Found during Milestone 2.8's keyboard pass — pressing Enter on the "Release
date" sort link with a platform applied simply never completes. The client
navigation is correct; the destination is not.

Paying it off means the same treatment the other two paths got: page the
sortable side and intersect, rather than reading every match. Release dates
have no small index to invert against the way play time does, so the likely
shape is capping the candidate scan at the pages a visitor can actually reach
(100 pages of 24) and accepting an approximate total, or dropping to
`first_release_date` ordering when the platform-specific date is not what the
sort promises.

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
exist — count for nothing in the gate, and a regression in a page would not
fail it. The exclusion made sense when `app/` held only composition; it holds
real request handling now.

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
