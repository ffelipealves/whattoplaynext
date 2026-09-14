# Milestone 2 Review

Status: closeout accepted

Reviewed: 2026-09-13

Audited baseline: `ceab3ea` (the closeout's browser matrix); this review lands
in the closeout commit that follows it

This review closes the search-experience portion of Milestone 2. It records
what was delivered, the defects that only a real browser or live provider data
could surface, the verification the closeout ran, and the evidence behind each
exit criterion in the [roadmap](roadmap.md). Compromises deliberately carried
forward are kept in the [technical debt register](technical-debt.md) rather
than restated here.

## Executive summary

Milestone 2 delivered a localized, URL-driven faceted search over the
Milestone 1 API: name search with debounced autocomplete, structured filters in
a desktop sidebar and a mobile drawer, removable active-filter chips, sorting,
bounded pagination, and distinct states for validation, rate limits, and
upstream failures. Submitted state lives entirely in the URL, so a copied link
restores the same search, and nothing is applied before an explicit action.
The milestone contains 10 planned increments, all completed through pragmatic
TDD.

At closeout the web application carries 194 component tests,
the API 170 tests, and a Playwright suite of
nine scenarios driving a real browser against the real
application composed with a fixture catalog. `pnpm quality` runs all of it
without network access or credentials.

Driving the new UI against live IGDB found what Milestone 1's fixtures could
not: a rating filter that could never be served, and three query shapes that
read the whole catalog to page one screen of it. All are fixed. The quality
gate itself turned out to have been red in CI from M2.1 to M2.6 while passing
on every developer machine; that is fixed too, and every push since has been
green.

## Increment history

| Increment        | Commit    | Delivered outcome                                                                                                                                                                                 |
| ---------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2.1             | `4cb414e` | shadcn/ui primitives themed to the project palette, the typed API client behind one factory, and a proof-of-life server fetch with a documented failure state.                                    |
| M2.2             | `32896f1` | `next-intl` locale routing for English and Brazilian Portuguese, replacing the hand-rolled dictionary, with a remembered locale preference.                                                       |
| M2.3             | `d1f22dd` | `GET /[locale]/games` with name search, sorting, a 24-item grid with explicit absent states, a loading skeleton, distinct zero-result and failure states, and pagination bounded at 100 pages.    |
| M2.4 and M2.5    | `b04ddf3` | Structured filters validated against the API's published allow-lists, an Apply-only react-hook-form draft rendered as both the desktop sidebar and the mobile drawer, removable chips, Clear all. |
| M2.4 follow-up   | `8ab34eb` | An integer rating bound IGDB can actually serve, and filtered browse queries that page the popularity and duration indexes instead of reading every match.                                        |
| M2.6             | `5baf5df` | Name autocomplete through a same-origin route handler: an ARIA combobox, a 300 ms debounce from the published minimum length, and permanent degradation to a plain field on failure.              |
| CI fix           | `a0eb970` | The contracts package builds on install, so the gate no longer typechecks against a module a fresh checkout does not have yet.                                                                    |
| M2.7             | `dd51b4d` | Classified API failures carried with the result, one distinct localized state per code with retry timing, and URL criteria the parser had to ignore reported instead of silently dropped.         |
| M2.8             | `d09c891` | An axe check over four page states, a labelled rating slider, an always-present result-count live region, and a real-browser keyboard pass across 57 named focus stops.                           |
| M2.8 follow-up   | `c7115ce` | Release-date sorting and release ranges on a selected platform page the release index instead of scanning the catalog.                                                                            |
| M2.9             | `c5f9736` | A Playwright suite in `pnpm quality` against the real application composed with a fixture catalog, covering the six critical journeys.                                                            |
| M2.10            | `ceab3ea` | A named browser matrix across Chromium, Firefox, and WebKit at desktop and mobile viewports, filter journeys that hold in either layout, and opt-in Core Web Vitals measurements.                 |
| M2.10 (closeout) | (this)    | The cross-browser and responsive pass, Core Web Vitals spot checks, the final contract-drift check, and this report.                                                                              |

Supporting commits `4d50e34` and `7f77817` divided the milestone and prepared
the M2.4 handoff; `2378448` and `649d01b` recorded technical debt and brought
the documentation up to the delivered state. None carried product behavior.
M2.5's drawer shipped inside M2.4's commit because both layouts render the same
form; the plan records both outcomes separately.

## Capabilities available now

- `GET /[locale]/games`, a server-rendered search route whose composition lives
  in `features/search/search-page.tsx`, so every state can be rendered and
  checked in isolation.
- URL criteria parsed with Zod against the bounds `GET /api/v1/filters`
  publishes, so the allow-listed platform, genre, and game-mode ids exist in
  one place only — and every criterion a link asked for that could not be
  honoured is reported to the visitor.
- A structured filter form with an Apply-only draft, rendered identically as a
  desktop sidebar and a mobile drawer, with removable chips and Clear all as
  plain links.
- Name autocomplete reaching the API only through this application's own route
  handler, so the typed client and the API base URL never ship to browsers.
- One classifier (`lib/api-failure.ts`) that turns any API error response into
  a speakable state, including requests that never arrived and responses that
  were not the published envelope.
- Every first-party string in English and Brazilian Portuguese; provider text is
  never machine-translated.
- `pnpm e2e` in the quality gate, `pnpm e2e:browsers` for the on-demand matrix
  (also a manual CI job), and `pnpm e2e:vitals` for Core Web Vitals spot
  measurements.

## Intentionally not delivered in Milestone 2

Per the plan's scope guardrails: game-detail pages, canonical slug redirects,
Open Graph and sitemap behavior, and the static information pages (Milestone
3); Redis caching, public rate limiting, a circuit breaker, analytics, and the
feedback prompt (Milestone 4); and system-wide localized error pages
(Milestone 3). Browse-side content eligibility, first flagged in the
[Milestone 1 review](milestone-1-review.md#deferred-external-actions), is still
open and is now entry 1 of the technical debt register, blocking for public
beta.

## Findings that fixtures could not surface

Every increment was checked by hand against live IGDB data as well as by tests,
following the plan's external-dependency rule. That combination found defects
neither approach would have found alone.

**A rating filter could never be served.** Every
`GET /api/v1/games?minimumRating=<value>` returned `UPSTREAM_INVALID_RESPONSE`.
Probing IGDB directly showed its query language rejects any decimal literal in
a `where` comparison — `total_rating >= 80` is accepted, `80.0` and `80.5` are
not — while the API modelled the threshold as a float, and its own adapter test
asserted the broken clause against a fake transport. The bound is now an
integer in the published contract.

**Three query shapes read the whole catalog to page it.** Any filter with the
default popularity sort listed every matching id and each one's popularity to
rank 24 of them; `platform=pc` alone meant roughly 830 requests against a
provider allowing four per second, and never answered within 240 s. Duration
filters, release-date sorting on a selected platform, and release ranges on a
selected platform had the same shape. All four now read whichever index is
smaller and stop as soon as the requested page is settled; the plan's follow-up
entries record the measured before and after for each.

**The quality gate was red in CI for six increments.** The web application
consumes the contracts package through its untracked build output, and the gate
only built it at its final step. Every developer machine already had that
output from an earlier run, so `pnpm quality` passed locally throughout M2.1 to
M2.6 while every CI run failed at typechecking. A `prepare` script now builds
the package on install; the fix was verified in a fresh clone before it was
pushed.

**Two accessibility defects were invisible without an accessibility tree.** The
M2.3 retry link used `href=""`, which is not exposed as a link at all, and the
rating slider's label sat on the Radix root while `role="slider"` is on its
thumb, so the control shipped unnamed. Both are fixed and covered.

**Scripted clicks do not behave like a visitor's.** The search route sits
inside a Suspense boundary, so React leaves it dehydrated until the first real
interaction and then replays the event. A scripted `element.click()` bypasses
that and falls through to native form submission, which looked exactly like
broken hydration during manual verification. The filter form's controls now
carry the API's own parameter names, so that fall-through produces a valid
filtered URL, and the Playwright suite uses trusted input throughout.

## Cross-browser and responsive verification

The Playwright suite ran against a production build and the fixture-backed API
in five configurations:

| Configuration   | Engine                           | Viewport   | Result             |
| --------------- | -------------------------------- | ---------- | ------------------ |
| chromium        | Chromium 153.0.8010.12           | 1280 × 720 | Pass — 9 of 9      |
| desktop-firefox | Firefox 155.0                    | 1280 × 720 | Pass — 9 of 9      |
| desktop-webkit  | WebKit 26.6                      | 1280 × 720 | Pass — 9 of 9 (CI) |
| mobile-chromium | Chromium 153.0.8010.12 (Pixel 7) | 412 × 839  | Pass — 9 of 9      |
| mobile-webkit   | WebKit 26.6 (iPhone 14)          | 390 × 664  | Pass — 9 of 9 (CI) |

Every scenario passed in every configuration: 45 of 45, none of them flaky.
The run happened in two places. On the Ubuntu 24.04 machine the closeout was
done on, Chromium at both sizes and Firefox passed all 27 of their runs, but
WebKit could not launch at all — it needs system libraries that machine lacked
and could not install without administrator rights. The manual "Browser
matrix" CI job exists for exactly that case: on a hosted runner it installed
those libraries and ran all five configurations
([run 34793478043](https://github.com/ffelipealves/whattoplaynext/actions/runs/34793478043)),
passing 45 of 45 in two minutes. CI retries a failing test once and reports a
test that passes only on retry as flaky; none did.

The layout scenarios are the responsive half of the pass. At 1280 px the filter
sidebar is visible and the drawer trigger is not; at 412 px and 390 px it is
the other way round; and in both layouts, in every engine, a checked box leaves
the URL and the result count untouched until Apply, which then applies
platform AND genre and renders the matching chip.

This pass is honest about what it is not. NFR-013 asks for the two latest stable
releases of Chrome, Edge, Firefox, and Safari; Playwright ships one build of
each engine, not two branded releases, and none of the three engines here is a
retail browser. Chromium stands in for both Chrome and Edge, which share its
engine; WebKit is the engine behind Safari but not Safari itself, which runs
only on Apple platforms. A release-time check on real Chrome, Edge, Firefox, and
Safari — the second-latest versions included — remains a manual step for the
closed-beta gate, and is recorded as such in the technical debt register.

## Core Web Vitals spot check

`pnpm e2e:vitals` measures the search page in Chromium on a desktop viewport and
on a Pixel 7 viewport with 4× CPU throttling, with real interactions for INP —
two filter checkboxes on desktop; opening the drawer, closing it, and reopening
it on mobile. These are lab numbers from one machine against NFR-003's 75th-percentile
field targets — a spot check, as the plan asks, not formal performance testing.

| Backend          | Layout                  | LCP        | INP      | CLS   |
| ---------------- | ----------------------- | ---------- | -------- | ----- |
| Fixture catalog  | Desktop                 | 616 ms     | 32 ms    | 0     |
| Fixture catalog  | Mobile, 4× CPU throttle | 1,024 ms   | 464 ms   | 0     |
| Live IGDB, cold  | Desktop                 | 3,828 ms   | 24 ms    | 0     |
| Live IGDB, cold  | Mobile, 4× CPU throttle | 4,608 ms   | 472 ms   | 0     |
| Target (NFR-003) |                         | ≤ 2,500 ms | ≤ 200 ms | ≤ 0.1 |

Two targets are met everywhere and two findings are recorded.

**CLS is 0 in every run**, including the two against live IGDB, where cover art
loads after the first paint. Covers render into a fixed-aspect box, which is
consistent with nothing moving when they arrive.

**INP is a client-side cost, and it misses on mobile.** Desktop interactions
took 24–32 ms. On the throttled mobile viewport the first tap on "Filters" took
464–472 ms, closing the drawer 112 ms, and reopening it 248 ms — the same
profile against the fixture and against live IGDB, which is what shows the
backend plays no part. The first tap pays for hydrating the route's Suspense
boundary on top of mounting the whole filter form; the reopen, already
hydrated, is still over target on its own. This is entry 15 of the technical
debt register.

**LCP misses on the live cold path, and only there.** With identical markup and
client code, the fixture build painted its largest element in 616 ms on desktop
and 1,024 ms on mobile; the build against live IGDB took 3,828 ms and 4,608 ms.
That gap is consistent with server response time rather than rendering: the
route renders dynamically and waits for two sequential API calls before any
result text paints, and with no cache in front of IGDB each of those calls is
cold — `GET /api/v1/filters` alone measured 2.1 s in this session. Redis
caching (Milestone 4) and the sequential metadata fetch recorded as debt entry
9 are the levers; LCP should be measured again once caching exists, since cold
numbers are the worst case rather than the typical one.

Each configuration was measured once. These numbers say where to look, not what
75% of visitors see.

## Contract drift check

`pnpm contract:check` regenerated the OpenAPI document and the TypeScript types
from the FastAPI application and found both committed artifacts current. The
web application was also checked for drift the generator cannot see: every call
to `/api/v1` goes through the generated client, the only direct `fetch` is the
same-origin autocomplete route, and no request or response type is written by
hand. The one deliberate narrowing — selected ids cast to the contract's enum
unions at a single documented seam — is entry 8 of the debt register.

## Acceptance result

### Roadmap exit criteria

| Criterion                                                          | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every agreed filter works alone and in representative combinations | Pass   | `browse-params.test.ts` covers each filter's parsing and bounds; `filter-form.test.tsx` covers OR within a category and AND across; `test_translates_strict_and_or_criteria_to_the_games_endpoint` and the release/duration tests cover the API; `layouts.spec.ts` applies a platform + genre combination in a real browser. Each filter was also verified by hand against live IGDB during its increment. |
| A copied URL restores the same submitted criteria and page         | Pass   | `search.spec.ts` › "a shared URL restores the same search, and back and forward keep it" loads a URL with name, sort, direction, and page and asserts the field, the active sort, and the count.                                                                                                                                                                                                           |
| Back and forward navigation behave correctly                       | Pass   | The same Playwright scenario navigates, goes back, and goes forward, asserting the URL and the restored name field at each step.                                                                                                                                                                                                                                                                           |
| No filter is applied before explicit submission                    | Pass   | `filter-form.test.tsx` › "no selection reaches the URL before Apply"; `layouts.spec.ts` › "a filter reaches the URL only on Apply, combined with AND across categories" asserts the URL and the count are unchanged with boxes checked, in both layouts.                                                                                                                                                   |
| 24-item pagination is stable and bounded                           | Pass   | `browse-params.test.ts` clamps pages below 1 and above 100; `pagination-links.test.tsx` bounds the rendered window; `search.spec.ts` › "pagination moves through the result set" asserts a distinct second page and its `aria-current`.                                                                                                                                                                    |

### M2.10 acceptance

| Criterion                                                                   | Result | Evidence                                                                                                                               |
| --------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm quality` passes, including Playwright, without network or credentials | Pass   | The closeout run below, with the nine Playwright scenarios inside the gate; it never contacts Twitch or IGDB and needs no credentials. |
| Every Milestone 2 exit criterion in the roadmap has recorded evidence       | Pass   | The exit-criteria table above.                                                                                                         |
| Core Web Vitals are spot-checked on the search page and recorded            | Pass   | The Core Web Vitals section above.                                                                                                     |

## Quality evidence

The `pnpm quality` run behind this review produced, locally and again in CI on
the audited baseline
([run 34793478043](https://github.com/ffelipealves/whattoplaynext/actions/runs/34793478043)):

- generated OpenAPI and TypeScript contract artifacts were current;
- Prettier and Ruff formatting checks passed;
- ESLint, Ruff lint, and strict mypy (Python 3.14, `strict = true`) checks
  passed;
- contracts: 1 test passed;
- web: 194 tests passed across 25 files, with 99.5% statement, 98.19% branch, 99.14% function, and 99.75% line coverage (90% statements/lines/functions and 80% branches required);
- API: 170 tests passed with 93.28% overall statement and branch coverage (90%
  required floor);
- Playwright: 9 scenarios passed in Chromium against the fixture-backed API;
- the contracts package, Next.js application, and Python source/wheel packages
  built successfully.

For comparison, Milestone 1 closed with 1 web test and 155 API tests, and the
gate ran no browser at all.

## Deferred work

The [technical debt register](technical-debt.md) holds everything carried
forward, with what each item costs and what paying it off involves. Two entries
gate a release: browse-side content eligibility (public beta) and the manual
retail-browser pass (closed beta). The IGDB partnership response and
attribution tracked in [External prerequisites](external-prerequisites.md)
remain unchanged from Milestone 1.

## M3 handoff

Milestone 3 can build game-detail pages on the existing `GET
/api/v1/games/{gameId}` contract and the patterns this milestone established: a
route that only fetches, a feature component that renders every state, failures
classified by `lib/api-failure.ts`, and strings in both message catalogs. The
fixture catalog's `get_game_detail` currently answers `GAME_NOT_FOUND`; it will
need real fixture detail before a detail journey can join the Playwright suite.
