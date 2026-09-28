# Technical Debt Register

Known compromises that are deliberate, understood, and not yet worth paying
off. Each entry says what it costs today and what paying it off would involve,
so a future decision can be made on evidence rather than memory.

This is not a bug list: everything here works as designed. Defects go to the
milestone plans and their outcome notes. Items marked **blocking** must be
resolved before the release gate that names them.

Last reviewed: 2026-09-27, at the Milestone 4 closeout. Milestone 4 resolved
1b, 4, and 18, partly paid 2, 2b, 9, and 10, and added 17, 19, and 20–25. The mobile INP
finding (15) was re-measured and now includes the game page in this
environment.

For the closed-beta handoff, the highest-impact open items are:

- the cold-query costs (2 and 2b): warm requests are now about 1 ms, but the
  first request for each shape still pays;
- mobile search INP (15);
- process-local resilience (17), before a second API instance runs.

The release gate that remains is testing actual branded browsers (14).
Entries 20–25 were found while delivering Milestone 4 and are not paid yet.
Accepted security risks, such as the CSP's `'unsafe-inline'`, live in the
[security review](security-review.md) rather than here. The other entries are
deliberate compromises, not newly found defects.

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

### 1b. “Released games” is not enforced as a catalog condition — **resolved in M4.3**

The MVP scope says released base games, remakes, and remasters, but eligibility
currently constrains only `game_type`. Detail, browse, and autocomplete do not
require a past release date or otherwise distinguish announced and unreleased
records, so they agree with one another but are broader than that word in the
product requirements.

This was made explicit while closing M3.1 instead of silently expanding an
increment about content type into a release-state policy.

**Decided and implemented on 2026-09-27 in M4.3.** The owner chose the global
rule: `first_release_date` present and no later than the end of the current
UTC day, applied with the `game_type` allow-list to detail and every discovery
path ([architecture §8a](architecture.md#8a-released-game-eligibility)). The
residual imprecision is accepted: a game first released on a platform outside
the MVP scope counts as released. It lands in M4.3, before any entry is
cached, so the change needs no cache invalidation. `IgdbCatalog` takes an
injectable day, and every games query, count, autocomplete, popular-selection
batch, and the detail check carry
`first_release_date != null & first_release_date <= <end of today>`. The
eligible total fell from 316,258 to 233,997 in the live smoke test on
2026-09-27.

### 2. A duration filter still costs seconds on a cold cache — **partly paid in M4.3**

Evaluating play time has to read two IGDB datasets and join them locally, since
`games` cannot be filtered by a field that lives on `game_time_to_beats`.
Milestone 2.4's follow-up cut a duration-filtered search from ~30 s to ~10 s by
bounding the smaller index first, but ~10 s is the floor for that shape of
query against a provider allowing four requests per second.

No Redis cache is active yet, so this cost can affect current live requests.
Milestone 4 owns the first cache layer: M4.3 caches a search page for an hour,
so only the first identical request pays. On 2026-09-27 the
Switch + indie + 2–10 h shape measured 9.5 s cold and 0.99 ms warm (p95,
in-memory store, so excluding the Redis round trip). Paying it off further would mean
caching the duration index itself — it is small enough (~9,300 rows) to hold
whole — rather than re-reading it per request.

### 2b. A platform release range still materializes its whole match set — **partly paid in M4.3**

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
provider allowing four per second. Narrower ranges are proportionally better;
the M4.3 search cache serves repeated requests warm (`platform=pc` + all
of 2020: 67.1 s cold, 1.08 ms warm p95 on 2026-09-27, 10,536 matches after the
released rule), but a cold range still has this cost, and while it runs it also holds the process-wide provider
limiter that M4.5 adds.

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

### 4. The API has no rate limiter of its own — **resolved in M4.5**

`RATE_LIMITED` only ever surfaces when IGDB itself returns 429; nothing
protects the provider from this service, or this service from a caller. The
architecture places rate limiting before provider access, and Milestone 4 owns
it. The frontend's rate-limit copy and retry timing are covered by component
tests and a fixture-backed game-detail Playwright scenario, but have not been
verified against a live provider 429.

**Decided in M4.1 and implemented in M4.5**, with a live check against the
production composition ([Milestone 4 plan](milestone-4-plan.md#m45--public-and-upstream-aware-rate-limiting)).
Because every API call
comes from the Next.js server, the web server forwards the visitor's address
with a shared edge token, and the API limits by a keyed digest of it
([architecture §8.1](architecture.md#81-rate-limiting)). An accepted residual
risk: visitors behind one carrier-grade NAT address, common on Brazilian
mobile networks, share a budget. The budgets are configuration, so they can
be raised if closed-beta logs show legitimate rejections.

## Web application

### 5. Filter metadata failures are still generic — **resolved in M3.5**

Milestone 3.5 made `getFilterMetadata` retain the classified `ApiFailure`,
including a published retry delay and request ID. The desktop sidebar and
mobile drawer now use the same per-code copy map as search and game failures,
so rate limits, provider failures, timeouts, invalid responses, and an
unreachable API remain distinct instead of collapsing to "Filters
unavailable." Their failure markup is non-indexable and covered in both
locales. The increment also fixed an adjacent classifier bug that interpreted
a missing `Retry-After` header as zero seconds.

### 6. Autocomplete never recovers without a reload

`useAutocomplete` turns itself off permanently once a request fails, which is
deliberate: retrying on every keystroke against a provider that just rate-
limited us is how a soft failure becomes a hard one. The cost is that a
visitor whose suggestions failed once keeps a plain field for the rest of the
page's life, even after the API recovers.

A backoff that re-enables after a delay would fix it without reintroducing the
retry storm, but needs a deliberate policy rather than a guessed interval.

Milestone 4.5 made this more likely: suggestions now count toward the
visitor's 60-per-minute public budget, so a fast typist near the limit can get
one `429`, and it switches suggestions off until reload. The API's
`Retry-After` would give the backoff its interval, which makes the policy
easier to choose than it was.

### 7. `src/app/**` sits outside the coverage floor

Coverage thresholds cover `src/features/**` and `src/lib/**`. Pages and route
handlers are excluded, so the autocomplete route handler's tests — which do
exist — count for nothing in the gate.

Milestone 2.8 shrank the gap by moving search-page composition into
`features/search/search-page.tsx`. Milestone 3 then added the game route's
redirect-or-not-found dispatch, `robots.ts`, and `sitemap.ts` under `src/app/`.
The decision is now to extend the floor to relevant app files or document a
clear exemption policy, rather than treating the exclusion as accidental.

Milestone 3.2 kept the detail fetch, failure classification, ID parsing, and
canonical-path construction under `features/game/`, but the thin route's
redirect/not-found dispatch and segment error boundaries remain outside the
unit-coverage floor. Their observable 308, 404, and 500 behavior is covered by
Playwright against a production build; the coverage-boundary decision remains
open. The later `robots.ts` and `sitemap.ts` are also outside the unit-coverage
floor, though their responses and the bounded popular selection have unit and
production-browser tests.

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

### 9. The search page reads filter metadata before it can search — **partly paid in M4.3**

Parsing the URL needs the published allow-lists and limits, so the games route
awaits `GET /api/v1/filters` before it can parse criteria and only then queries
results. That is one extra sequential round trip on every search page view.
The seven-day Redis policy was confirmed in M4.1 and lands in M4.3; it
removes the provider cost of that round trip but not the round trip itself.

Removing it means either giving up URL validation against the published
allow-list, or caching the metadata in the web application — the latter is a
Milestone 4 concern.

Milestone 2.10 put a number on it. Against live IGDB with no cache, the search
page's LCP was 3,828 ms on desktop and 4,608 ms on a throttled mobile viewport,
against 616 ms and 1,024 ms for the identical build on the fixture catalog. Two
sequential cold API calls stand between the request and the first result text,
and `GET /api/v1/filters` alone measured 2.1 s cold. Caching the metadata —
here or in Redis — is the cheapest lever on that gap.

Milestone 4.3 caches the filter metadata in Redis for seven days, so after the
first request the sequential call costs a warm API round trip, about a
millisecond inside the API, instead of 2.1 s against IGDB. The round trip
itself remains; removing it still means caching the metadata in the web
application.

## End-to-end suite

### 10. Part of the search page has no browser-level test — **partly paid**

**Partly paid in Milestones 2.10 and 3.9.** The Apply interaction — the one
interaction whose correctness depends on hydration — is now covered:
`e2e/layouts.spec.ts` checks the boxes, asserts the URL and count stay untouched,
applies, and asserts platform AND genre and the resulting chip, in the sidebar
on desktop and the drawer on mobile, across every engine in the matrix.
Removing a single chip is covered the same way.

Milestone 3.9 added real-browser autocomplete coverage for debounce, keyboard
selection, and degradation. Still covered only by component tests and hand
verification: Clear all, the filter form's validation messages, the
ignored-criteria notice, and the duration notice. The superseded-request abort
path remains covered by the component test with fake timers, not a browser
scenario.

Milestone 4 added browser journeys for stale results, security headers and
CSP, and analytics payloads. The gaps listed above are unchanged.

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

Since Milestone 4.9 the suite's build also turns analytics on, loading a stub
script from the fixture API. A `pnpm start` after `pnpm e2e` would therefore
try to load `http://127.0.0.1:8100/e2e/umami-stub.js` as well. The fix is the
same.

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
`pnpm e2e:browsers` and in CI through the "Browser matrix" job, triggered by a
manual dispatch or a push commit containing `[browser-matrix]`.

The reasoning: 27 scenarios times five configurations on every push would
cost more than the regressions they could plausibly catch. WebKit needed
system libraries that were missing on the Ubuntu machine at the M2 closeout;
those were installed by M3.10, when the local and hosted matrices both passed
135/135. The cost of keeping the matrix opt-in is that an engine-specific
regression surfaces only when someone runs it — at least every release
candidate.

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

Milestone 3.4's full vitals run reproduced the same issue at 512 ms for the
mobile search interaction. Its new game-page measurement remained independent:
controlled delayed cover and screenshot loads produced CLS 0 on desktop and
mobile.

Milestone 3.10 rechecked both pages against the fixture build. Search measured
LCP/INP/CLS of 724 ms/40 ms/0 on desktop and 1,248 ms/448 ms/0 on the
4×-throttled mobile viewport; its mobile interactions were 448, 120, and 272
ms. The game page measured 248 ms/104 ms/0 on desktop and 332 ms/144 ms/0 on
mobile, including opening, advancing, and closing its screenshot dialog.
Thus the mobile search INP finding is unchanged, while the game page met the
lab targets. These still are not field p75 measurements.

The Milestone 4 closeout re-measured on a different machine (WSL2, Docker
running). Mobile search INP was 950–1,300 ms and mobile game-page INP 230–320
ms. The Milestone 3 closeout commit, rebuilt and measured alternately on the
same machine, gave 1,040–2,576 ms, and so did a build without analytics. The
gap from the Milestone 3 numbers is the environment, not a regression, but it
means the game page is also over 200 ms here. Field data remains the deciding
measurement.

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

Milestone 3.10 added an explicit `[browser-matrix]` push-commit trigger, which
runs the quality gate and matrix as jobs of one push workflow. It lets a
closeout request matrix verification without a competing manual dispatch, but
does not remove this concurrency issue when someone does dispatch manually.

## Resilience

### 17. Resilience state is process-local

Decided in M4.1. Miss coalescing, the circuit breaker, the global provider
limiter, and the fallback rate limiter used while Redis is down all live in
the API process. That is correct for the single API instance the MVP runs:
one process sees every request, so it can coalesce them and count failures
exactly.

It stops being correct once more than one API instance runs. Each instance
would coalesce only its own misses, open its own circuit, and allow IGDB's
four requests per second on its own, so two instances could together exceed
the provider's ceiling.

Paying it off means moving the provider limiter and circuit state into Redis
and adding a short Redis lock around cache fills. Do that before running a
second instance, not before closed beta.

## Local verification

### 18. The web unit suite times out under machine load — **resolved on 2026-09-27**

Found on 2026-09-27 while verifying M4.4, on a WSL machine that was also
running Docker Desktop and Redis (load average 5–9 on 12 cores). Under
`pnpm coverage:web`, the axe checks in `search-page.a11y.test.tsx` and
`game-detail-page.a11y.test.tsx` exceeded Vitest's 5-second test timeout. One
timeout then cascaded into “Axe is already running” in the next test of the
same file. `filter-panel.test.tsx`'s drawer test also exceeded Testing
Library's one-second `waitFor`. The same failures reproduced with the M4.4 page
changes stashed. Every affected file passes when run alone, and a 30-second
test timeout clears the axe tests. The drawer test's `waitFor` still failed at
that setting.

Nothing was wrong with the product, but a local gate that fails for reasons
unrelated to the change trains people to ignore it. The fix:

- `test/axe.ts` now holds the axe helpers both files had copied. It chains each
  run after the previous one, so a run abandoned by a timed-out test can no
  longer fail the next test.
- Both axe files set a 30-second test timeout with `vi.setConfig`.
- The drawer assertion waits up to ten seconds, inside a 20-second test.

Verified the same day: three consecutive `pnpm coverage:web` runs passed
245/245 at load averages up to 6.8. Two concurrent full suites, one with
coverage, at a load average of 8.6, also both passed 245/245.

### 19. The debounce journey depends on wall-clock gaps

Found at the Milestone 4 closeout. `accessibility.spec.ts` types “Wit”, waits
100 ms, types “Witcher”, and expects exactly one suggestion request, relying on
the 300 ms debounce to swallow the first. When five browser projects run in
parallel on a loaded machine, the gap between the two keystrokes can exceed
300 ms, a request for “Wit” is legitimately sent, and the assertion fails.
That happened on Firefox and mobile Chromium during `pnpm e2e:browsers`. The
same test passed three times in a row on Firefox alone.

The autocomplete behaves correctly; the test measures real time on a machine
it does not control. Paying it off means asserting the debounce with a
controlled clock (Playwright's `page.clock`), or asserting only that the last
query was requested rather than the exact list.

## Operations

### 20. Dependency audits are manual

Found in M4.8. `pnpm audit` and `pip-audit` were run by hand for the security
review. The first found a high advisory in `js-yaml`, fixed with a workspace
override. Neither audit runs in CI, so a new advisory surfaces only when
someone thinks to look.

Paying it off is a CI job running `pnpm audit --prod` and `pip-audit` over the
API environment, failing on high or critical findings. A scheduled trigger
would also catch advisories published after a merge. **Blocking for public
beta**, as recorded in the [security review](security-review.md).

### 21. Redis memory use is unbounded and unmeasured

Found in M4.9. The architecture sizes the cache for Upstash Redis Free (256
MB) and requires an `allkeys-lru` eviction policy, but:

- the local Compose Redis sets neither `maxmemory` nor an eviction policy;
- no one has measured the size of a cached search page or detail entry;
- nothing estimates how many distinct searches a day of closed-beta traffic
  would keep for the 25-hour search lifetime.

The deployed Redis could fill up and reject writes. The cache would then
degrade into the 30-second bypass and fail open, which is safe but slow.

Paying it off means measuring entry sizes with `pnpm measure:api --redis`,
setting `maxmemory` and `allkeys-lru` in `compose.yaml` to match production,
and confirming the eviction setting on the chosen Redis host.

### 22. A missing edge token or proxy-hop setting collapses every visitor into one budget

Found in M4.5. The API tells visitors apart only by the address the web server
forwards with the edge token. Without `WTPN_EDGE_TOKEN` and
`WTPN_API_EDGE_TOKEN`, every visitor is charged to the web server's own
address.

On a host that puts a proxy in front of the API, such as Render, the socket
peer is that proxy for every caller. Without `WTPN_TRUSTED_PROXY_HOPS`,
direct callers also share one identity. Either way, the whole site shares 60
requests per minute. A search page makes two API calls, so a handful of
visitors would start getting `429`.

Nothing warns about this at startup. Paying it off means logging a warning,
and in production refusing to start, when no edge token is configured, and
adding the proxy-hop value to each deployment's checklist.

### 23. The operational scripts are not type-checked

Found in M4.7. `scripts/smoke_igdb.py`, `scripts/measure_catalog.py`, and
`scripts/export_openapi.py` are linted and formatted, but mypy checks only
`src` and `tests`. Checking them fails today on untyped imports of the
installed package.

A script that drifts from the application's API would fail only when someone
runs it against live IGDB. Paying it off means adding `scripts` to the mypy
configuration with the package importable as source.

## Analytics

### 24. Two analytics measures are approximations

Found in M4.9. The name search is a native GET form, so submitting it
reloads the page and clears the in-memory analytics session, which leaves two
measures approximate:

- `search-submitted.refinement` is true only for searches changed without a
  reload (filters applied, chips removed), never for a new name search;
- `responseTime` for a reloaded search is measured from navigation start, so
  it includes page load, not only the API.

Umami's own daily session grouping can still count repeated searches per
session, so the secondary metric is recoverable. It is just not exact in this
flag. Paying it off means either a client-side submission for the name form
or accepting the definitions and documenting them in the analytics review
before public beta.

### 25. The usefulness prompt (FR-047) is not built

Found in M4.9. FR-047 allows an optional “Did you find something interesting?”
prompt with `Yes` and `Not yet`, and the analytics allow-list reserves a
`usefulness-answered` event for it. Neither exists in the web application. The
primary metric does not depend on it, but the secondary “anonymous response to
the usefulness prompt” in the product requirements cannot be measured until
it does.

Building it is small: a dismissible prompt on the results page, the event,
and its allow-list entry and tests. It needs a product decision on placement
and frequency, which is why it was not added silently.
