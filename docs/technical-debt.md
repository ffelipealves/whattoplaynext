# Technical Debt Register

Known compromises that are deliberate, understood, and not yet worth paying
off. Each entry says what it costs today and what paying it off would involve,
so a future decision can be made on evidence rather than memory.

This is not a bug list: everything here works as designed. Defects go to the
milestone plans and their outcome notes. Items marked **blocking** must be
resolved before the release gate that names them.

Last reviewed: 2026-09-15, after Milestone 3.1.

## Provider and API

### 1. Browse does not enforce content eligibility — **resolved in M3.1**

Milestone 3.1 made browse, every games-side index join, counts, and autocomplete
use the same `ELIGIBLE_GAME_TYPES` allow-list as detail. DLC, expansions,
bundles, mods, and other rejected types can no longer become results that link
to `GAME_NOT_FOUND`; one adapter-level guard drives every query strategy and
requires the eligibility clause on every `games` query and count.

Live IGDB counts on 2026-09-15 put the change in concrete terms: the old direct
popularity total was 81,543 and the old rating total was 375,653; both now
report 316,258 eligible games. The popularity total grows because it now counts
all eligible games, including unranked ones, while its first 100 pages remain
settled from the Visits index. All 24 games on a sampled page returned 200 from
detail. An unfiltered autocomplete for “Blood and Wine” returned the type-2
expansion `13166`; the eligible query returned no suggestion.

First flagged in the [Milestone 1 review](milestone-1-review.md#deferred-external-actions)
and observed from the frontend in Milestone 2.3; closed before Milestone 3 adds
links from result cards.

### 1b. “Released games” is not enforced as a catalog condition

The MVP scope says released base games, remakes, and remasters, but eligibility
currently constrains only `game_type`. Detail, browse, and autocomplete do not
require a past release date or otherwise distinguish announced and unreleased
records, so they agree with one another but are broader than that word in the
product requirements.

This was made explicit while closing M3.1 instead of silently expanding an
increment about content type into a release-state policy. Resolving it requires
an owner decision about games with missing or platform-specific dates, then one
shared rule across detail and every discovery path.

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

What remains is the count. After M3.1 eligibility, that shape matches 10,597
games and took 63.7–71.8 s in two cold live runs; an exact `totalItems` — which
pagination depends on — means resolving every one of them through the games
endpoint to apply the rest of the filter: about fifty requests against a
provider allowing four per second. Narrower ranges are proportionally better,
and Redis hides all of it once warm.

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

M3.1 routed unfiltered popularity through the same walk. Its deepest public
request needs only 2,400 ranked matches (page 100 × 24), well within the 81,543
rows in the live Visits index; a regression test pins that page without the
fallback. The fallback remains bounded in practice and correct for small or
pathological filtered sets, which is why it stays.

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

Milestone 3 makes the decision due: it adds real logic under `src/app/` — the
game route's redirect-or-not-found decision, `robots.ts`, and `sitemap.ts` —
which would all land outside the floor unless the boundary moves first.

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

Milestone 2.10 put a number on it. Against live IGDB with no cache, the search
page's LCP was 3,828 ms on desktop and 4,608 ms on a throttled mobile viewport,
against 616 ms and 1,024 ms for the identical build on the fixture catalog. Two
sequential cold API calls stand between the request and the first result text,
and `GET /api/v1/filters` alone measured 2.1 s cold. Caching the metadata —
here or in Redis — is the cheapest lever on that gap.

## End-to-end suite

### 10. Part of the search page has no browser-level test

**Partly paid in Milestone 2.10.** The gap that mattered most — Apply, the one
interaction whose correctness depends on hydration — is now covered:
`e2e/layouts.spec.ts` checks the boxes, asserts the URL and count stay untouched,
applies, and asserts platform AND genre and the resulting chip, in the sidebar
on desktop and the drawer on mobile, across every engine in the matrix.
Removing a single chip is covered the same way.

Still covered only by component tests and hand verification: autocomplete
(debounce, selection, degradation), Clear all, the filter form's validation
messages, the ignored-criteria notice, and the duration notice. Autocomplete is
the one worth adding next, since its debounce and abort behave on real timers in
a browser and on fake ones in Vitest.

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

### 13. The gate drives one browser

**Decided in Milestone 2.10.** Every push runs the suite in desktop Chromium
only. The full matrix — Chromium, Firefox, and WebKit, at desktop and mobile
viewports — is named in `playwright.config.ts` and runs on demand, locally with
`pnpm e2e:browsers` and in CI through the manual "Browser matrix" job.

The reasoning: nine scenarios times five configurations on every push would
cost more than the regressions they could plausibly catch, and WebKit needs
system libraries a developer machine often lacks (it could not launch on the
Ubuntu machine the closeout ran on) but a hosted runner can install. The cost
is that an engine-specific regression surfaces only when someone runs the
matrix — which should at least be every release candidate.

### 14. No retail browser has been checked — **blocking for closed beta**

NFR-013 promises the two latest stable releases of Chrome, Edge, Firefox, and
Safari. Milestone 2.10's matrix drives the engines Playwright ships — one build
each of Chromium, Firefox, and WebKit — at desktop and mobile viewports. That
catches engine-level breakage, but it is not the requirement: no branded
release was run, none of the second-latest releases was, Edge was covered only
through the Chromium engine it shares with Chrome, and WebKit is Safari's
engine rather than Safari, which runs only on Apple platforms.

Paying it off is a manual pass at release time on real installs of all four
browsers at both versions, recorded against the same journeys the suite
covers. A hosted cross-browser service could automate it; that is a cost
decision for the beta milestones, not an engineering blocker now.

### 15. Opening the mobile filter drawer is slow to respond

Milestone 2.10's Core Web Vitals spot check measured the search page on a Pixel
7 viewport with 4× CPU throttling. LCP and CLS were comfortably inside NFR-003's
targets; INP was not. Recorded interaction by interaction against the fixture
build:

| Interaction                       | Latency |
| --------------------------------- | ------- |
| First tap on "Filters" (opens it) | 464 ms  |
| Escape (closes it)                | 112 ms  |
| Second tap on "Filters" (reopens) | 248 ms  |

The first tap pays for two things: the route sits inside a Suspense boundary
React hydrates on the first real input, and the drawer mounts the whole filter
form — 35 checkboxes, a slider, and a react-hook-form instance — the moment it
opens. The second tap is already hydrated and still takes 248 ms, so mounting
the form is over the 200 ms target on its own; hydration adds roughly another
200 ms the first time.

On desktop the sidebar is mounted with the page, and its interactions measured
24–32 ms.

These are lab numbers from one throttled machine, not the 75th-percentile field
data NFR-003 is written in, so they say where to look rather than what visitors
see. Candidate fixes, none evaluated yet: mount the genre list lazily or only
when its group is expanded; keep the form mounted but hidden once first opened,
so only the first open pays; or let the boundary hydrate at idle rather than on
the first tap. Confirm with field measurements before public beta.

## Continuous integration

### 16. The browser matrix and pushes to `main` cancel each other

The CI workflow shares one concurrency group per branch —
`ci-${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress` — so a
manual "Browser matrix" dispatch and a push to `main` compete for the same
slot. At the Milestone 2 closeout, dispatching the matrix moments after pushing
`ceab3ea` cancelled that push's run. Nothing went unverified, because a
dispatched run executes the quality gate too and it passed on the same commit,
but the commit's own check reads as cancelled. The reverse costs more: a push
while the matrix is running cancels the matrix, and the five-engine run has to
be dispatched again from the start.

Paying it off is a one-line change: add `${{ github.event_name }}` to the
concurrency group, or move the matrix into a workflow of its own, so a manual
run never competes with a push for the same slot.
