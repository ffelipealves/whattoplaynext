# Milestone 3 Plan

Status: in progress — delivery starts with M3.1; owner decisions 2–5 in
section 7 are pending

Prepared: 2026-09-13

## 1. Goal

Milestone 3 turns the search experience into a site: every result leads to a
complete, localized game page with a stable ID-plus-slug URL, the informational
pages and IGDB attribution the release gates require exist, and search engines
can find and correctly describe what should be indexed — and only that.

At completion, a visitor can go from a search result to a game page and back
without losing locale or criteria; an old or mistyped slug lands on the
canonical URL; every page has localized metadata; search pages are `noindex`;
and the sitemap lists the static pages plus a daily selection of up to 500
popular games.

## 2. Module shape

The locale route trees already exist: Milestone 2.2 made `app/[locale]/` the
root layout, and every first-party string already lives in the two message
catalogs. What Milestone 3 adds to localization is metadata, `hreflang`
alternates, and localized system and error pages.

The game page follows the pattern Milestone 2 settled on for search: the route
file under `app/[locale]/games/` only fetches and decides the response (render,
redirect, or not-found), and a feature component under `features/game/`
renders every state, so each state can be rendered, tested, and checked for
accessibility in isolation. Data comes from `GET /api/v1/games/{gameId}`
through the generated client, and failures are classified by the existing
`lib/api-failure.ts`.

The game ID alone identifies the resource; the slug is presentation. The route
corrects any slug with a permanent, locale-preserving redirect, and never
treats the slug as part of what is fetched.

Search-engine behavior is owned by Next.js metadata conventions — confirmed
present in Next.js 16.3: `generateMetadata` with `metadataBase`, `robots.ts`,
`sitemap.ts`, `opengraph-image`, `permanentRedirect` (308), and `not-found`.
Absolute URLs derive from one configured site origin, never a hardcoded domain,
because the product name and domain are deliberately undecided.

The popular-game selection behind the sitemap is a new catalog capability in
the API, reusing the popularity index Milestone 2's fixes already page, and
cached for a day. It returns only eligible games, with the slugs the sitemap
needs.

## 3. Cross-cutting delivery rules

Every increment follows the Milestone 2 rules — pragmatic TDD, `next-intl` for
every first-party string, no hand-written contract types, WCAG 2.2 AA as each
control ships, `pnpm quality` before completing — plus these:

- provider text (titles, summaries, alternative names) is never machine
  translated; when a summary is not in the UI language, the page says which
  language it is in (FR-046);
- every nullable field has an explicit absent state; a missing cover or
  screenshot uses a first-party placeholder with reserved dimensions (FR-039);
- a game that does not exist or is not eligible is a localized not-found with a
  404 status; an upstream failure is a recoverable failure state that is
  neither a 404 nor indexable, so a provider outage can never deindex a page;
- every page's metadata is localized, and canonical and alternate URLs are
  absolute and built from the configured site origin;
- new pages are Server Components; Client Components appear only where
  interaction needs them;
- each new page state gets an axe check like Milestone 2.8's, and each new
  journey a Playwright scenario against the fixture-backed API;
- `pnpm e2e:browsers` runs before the milestone closes.

## 4. Delivery increments

### M3.1 — Browse content eligibility

Pays off technical debt entry 1 before anything links to a game page.

Status: completed on 2026-09-15.

Deliver:

- browse, filtered browse, and autocomplete exclude the game types
  `GET /api/v1/games/{gameId}` already rejects, using the same
  `ELIGIBLE_GAME_TYPES` allow-list rather than a second copy;
- the popularity, duration, and release index walks from Milestone 2's
  follow-ups apply the same constraint when they join against games.

Acceptance:

- no browse or autocomplete result can be a game the detail endpoint answers
  with `GAME_NOT_FOUND`, verified against the adapter's fakes and by hand
  against live IGDB;
- totals and page counts reflect only eligible games, and the fixture-backed
  tests say so explicitly;
- the Milestone 2.4 follow-up timings are re-measured and have not regressed
  materially.

Outcome: the IGDB adapter now derives `game_type = (0,8,9)` from the existing
`ELIGIBLE_GAME_TYPES` allow-list and carries it through every `games` query and
count, including autocomplete and the popularity, duration, and release index
joins. Unfiltered popularity now uses the ranked intersection path as well;
page 100 is covered by a regression test that proves it does not reach the
exhaustive fallback. The always-present clause removed the three empty-`where`
branches plus the old direct popularity game query. No web, contract shape, or
Playwright fixture changed.

Live IGDB verification ran cold on 2026-09-15. The old totals were 81,543 for
the direct Visits page and 375,653 for rating; both browse sorts now report
316,258 eligible games. `pnpm smoke:api` passed, all 24 IDs on a sampled popular
page returned 200 from detail, and “The Witcher 3: Wild Hunt - Blood and Wine”
(ID 13166, `game_type=2`) appeared in the old autocomplete query but not the
eligible one. Follow-up timings remained in the same operational range:

| Query                                             | M2 follow-up | M3.1 cold   |
| ------------------------------------------------- | ------------ | ----------- |
| `minimumRating=80`                                | 2.9 s        | 3.2 s       |
| `platform=pc`                                     | 1.9 s        | 3.5–3.6 s   |
| `platform=pc&platform=nintendo-switch`            | 2.4 s        | 2.3 s       |
| `platform=nintendo-switch&genre=indie` + 2–10 h   | 10 s         | 10.3 s      |
| `genre=shooter&minimumRating=80` + ≤ 20 h, page 3 | 6 s          | 6.0 s       |
| `genre=pinball`                                   | 5.6 s        | 3.2 s       |
| `platform=pc&sort=release-date`                   | 3.2 s        | 2.4–2.7 s   |
| `platform=pc` across 2020                         | 58 s         | 63.7–71.8 s |
| unfiltered popularity, page 1                     | direct index | 2.8 s       |
| unfiltered popularity, page 100                   | direct index | 9.8 s       |

The release-range case remains dominated by its known exact-total debt and
showed normal live-provider variance without a query-plan regression. M3.1 also
recorded separately that the product word “released” is not yet enforced; that
owner policy was intentionally not folded into content-type eligibility.

### M3.2 — Game route and canonical slug redirect

Deliver:

- `/[locale]/games/[id]/[slug]` rendering a minimal game page (title and
  cover) from `GET /api/v1/games/{gameId}`;
- a permanent redirect from any other slug, and from `/[locale]/games/[id]`
  alone, to the canonical slug, preserving locale;
- result cards that link to their game page, while choosing an autocomplete
  suggestion keeps its Milestone 2.6 behavior of only filling the field;
- the fixture catalog serving real detail data, reusing the API's sanitized
  `game_detail_*` fixtures, so the game journey can join the Playwright suite.

Acceptance:

- a wrong or outdated slug answers 308 to the canonical URL in the same locale;
- a non-numeric or non-positive ID and a `GAME_NOT_FOUND` response render the
  localized not-found with a 404 status;
- an upstream failure renders the Milestone 2.7 failure state, not a 404;
- a Playwright scenario goes from a search result to its game page and back,
  with criteria and locale intact.

### M3.3 — Complete game-detail presentation

Deliver:

- everything FR-034 lists: summary with its source-language indicator, release
  dates per platform, genres, themes, platforms, game modes, multiplayer
  details, ratings with source and vote count, durations, age ratings, and
  external links;
- user and critic ratings shown separately when both exist (FR-036);
- fast, normal, and completionist durations shown where each exists, with how
  many submissions each is based on (FR-035);
- external links labeled as external and never implying price or availability
  (FR-038).

Acceptance:

- a component test renders the complete and the sparse fixture and asserts an
  explicit absent state for every nullable field, never an invented value;
- provider text renders untranslated in both locales, with the language
  indicator appearing only when the summary's language differs from the UI's;
- an axe check over the complete, sparse, and failure states reports no
  critical or serious violations.

### M3.4 — Responsive images and first-party placeholders

Deliver:

- cover and screenshot images served through `next/image` with responsive
  sizes, reserved dimensions, and lazy loading below the fold (NFR-004);
- a first-party placeholder for a missing cover or screenshot (FR-039);
- a screenshot presentation that stays keyboard operable.

Acceptance:

- CLS stays at 0 on the game page with covers and screenshots loading,
  measured by extending `pnpm e2e:vitals` to the game page;
- no image above the fold is lazy, and none below it is eager;
- placeholders reserve the same dimensions as the image they stand in for.

### M3.5 — Localized system states

Deliver:

- a localized not-found page for unknown routes and missing games, and a
  localized error boundary for unexpected failures;
- the rate-limit, upstream-unavailable, and validation states from Milestone
  2.7 available to the game page as well as search;
- classified failures for filter metadata, paying off technical debt entry 5,
  so the sidebar explains an outage the same way the results do.

Acceptance:

- each system state renders distinct, correctly localized copy in both
  locales, with the right HTTP status;
- no system state is indexable;
- a component test covers every state, and an axe check reports no critical or
  serious violations.

### M3.6 — Informational pages and IGDB attribution

Deliver:

- About/Data Sources, Privacy, and Terms drafts in both locales, marked as
  drafts pending review;
- the planned attribution — "Game data and images provided by IGDB" — in a
  persistent footer on catalog-backed pages and on About/Data Sources, without
  an IGDB logo (external prerequisites, section 5).

Acceptance:

- all three pages are reachable from the footer in both locales and are
  indexable;
- the attribution is visible without opening any secondary screen on every
  catalog-backed page;
- the drafts say plainly that they are not yet reviewed, and nothing on them
  claims a legal position the owner has not approved.

### M3.7 — Metadata, canonical URLs, and robots

Deliver:

- a required site-origin setting feeding `metadataBase`, so canonical,
  alternate, and Open Graph URLs are absolute without hardcoding a domain;
- localized `generateMetadata` for the home, informational, and game pages,
  with canonical and `hreflang` alternates for both locales (NFR-029, NFR-031);
- Open Graph and social preview metadata for game pages, using the cover when
  one exists and a first-party image when it does not;
- `noindex` on every search route (NFR-030) and a `robots.ts`.

Acceptance:

- search pages are `noindex` in both locales, however they were reached;
- game pages expose a canonical URL that ignores the slug they were requested
  with, plus alternates for both locales;
- a production build without a configured site origin fails loudly rather than
  shipping relative or guessed canonical URLs;
- the metadata is asserted by tests against rendered output, not only by
  inspection.

### M3.8 — Popular-game selection and sitemap

Deliver:

- a catalog capability returning up to 500 popular eligible games with their
  slugs, and a public API route for it, cached for 24 hours as the
  architecture's cache table specifies;
- a `sitemap.ts` listing static routes in both locales and the popular-game
  selection (NFR-032), refreshed daily rather than frozen at build time.

Acceptance:

- the sitemap contains every static route and at most 500 game URLs, all
  canonical and absolute;
- an upstream failure produces a sitemap with the static routes still listed,
  never an error response or an empty file;
- the selection is covered by adapter tests with fakes and verified once by
  hand against live IGDB.

### M3.9 — Accessibility and the core journey

Deliver:

- a keyboard pass and a screen-reader smoke test across the core journey —
  search, open a game, read it, follow an external link, return — in both
  layouts;
- Playwright scenarios for the game journey, the slug redirect, not-found, and
  the metadata that must hold in a real browser;
- the autocomplete scenario technical debt entry 10 identifies as the next
  browser-level gap worth closing.

Acceptance:

- the keyboard and screen-reader smoke tests pass for the core journey and are
  recorded (roadmap exit criterion);
- every new page state has an axe check with no critical or serious
  violations;
- the new scenarios pass in the quality gate and in `pnpm e2e:browsers`.

### M3.10 — Milestone 3 closeout

Deliver:

- a Milestone 3 review mirroring the Milestone 2 review, with evidence for
  every exit criterion;
- a Core Web Vitals spot check of the game page alongside the search page;
- the browser matrix, a final contract-drift check, and a technical debt
  register review.

Acceptance:

- `pnpm quality` passes, including Playwright, without provider credentials;
- every Milestone 3 exit criterion in the roadmap has recorded evidence;
- the browser matrix passes in CI.

## 5. Scope guardrails

Milestone 3 does not add Redis caching, a public rate limiter, a circuit
breaker, analytics, or the feedback prompt — those remain Milestone 4. Where an
increment needs a cache before then (the popular-game selection, the sitemap),
it uses HTTP and framework caching only, so Milestone 4 can replace the
mechanism without changing behavior. It does not choose the product name or
domain, send the IGDB partnership inquiry, or approve legal text: those are
owner actions, and Milestone 3 builds so that none of them requires rework when
they land. Price, availability, and regional storefront data stay out of scope
entirely.

## 6. External dependency timing

No external action blocks any Milestone 3 increment. Three shape how work
lands:

- **Domain:** undecided. M3.7 reads the site origin from configuration, so the
  eventual domain is a setting rather than a code change.
- **IGDB attribution:** the wording and placement are planned but not
  approved. M3.6 implements the planned text so it can be adjusted in one place
  once the partnership reply arrives.
- **Legal review:** Privacy and Terms ship as marked drafts. Their review, and
  a privacy contact, remain public-beta gates the owner closes.

## 7. Decisions for the owner

These change what gets built, so they are the owner's to make. Each has a
recommendation; the plan above assumes it. None of the open ones blocks M3.1:
decisions 2 and 5 are needed before M3.2, decision 4 before M3.6, and decision
3 before M3.7.

1. **Pay browse content eligibility first (M3.1).** Recommended. Once result
   cards link to game pages, every ineligible browse result becomes a link to a
   not-found page. The alternative is deferring it to its public-beta gate and
   accepting those dead links during closed beta.
   **Accepted on 2026-09-14:** the owner chose to start Milestone 3 with M3.1.
2. **Game URL shape.** Recommended: `/[locale]/games/[id]/[slug]`, with
   `/[locale]/games/[id]` redirecting. The alternative is `/[locale]/games/[id]-[slug]`.
   Both satisfy FR-032, but whichever ships first is expensive to change once
   pages are indexed.
3. **Site origin before a domain exists.** Recommended: a required setting,
   with builds failing when it is missing. The alternative, a temporary
   placeholder domain, risks indexing canonical URLs that will later be wrong.
4. **Implement the planned attribution now.** Recommended, since changing one
   footer string later is cheap and the public-beta gate requires visible
   attribution regardless.
5. **Game pages during an upstream outage.** Recommended: a recoverable failure
   state with a 5xx status and `noindex`. The alternative, serving the last
   known page, needs the Milestone 4 cache and would pull that work forward.

## 8. M3.1 next-session handoff

Start from `main` with a clean tree. M3.1 is API-only: no web, contract-shape,
or Playwright fixture change is expected — only totals and which games appear
change.

### Where eligibility has to reach

Everything lives in `apps/api/src/whattoplaynext_api/adapters/igdb/catalog.py`.
Build the clause from `ELIGIBLE_GAME_TYPES` — `game_type = (0,8,9)`, sorted —
so detail and browse share one definition.

- `_where_query` is the seam almost every browse path shares. Adding the
  clause there reaches the count and page of the rating, release-date, and
  title sorts (`_search_query`); `_candidate_records`; `_games_by_ids` and
  `_matching_ids` through `_where_with_ids`; `_every_matching_id_by_popularity`;
  `_release_ordered_records`; and both index-first local paths
  (`_durations_in_range`, `_games_released_in_range`), which join through
  `_games_by_ids`.
- With the clause always present, `_where_query` never returns an empty
  string, so the empty-where branches in `_candidate_games_query`,
  `_search_query`, and `_where_with_ids` become dead. Remove them rather than
  keep untested branches.
- Two paths bypass `_where_query` and need their own change:
  - **Unfiltered popularity** in `browse_games` counts `popularity_primitives`
    and pages that index directly, then reads the page with `_games_query`,
    which applies no filter. This is where debt entry 1's stray non-games come
    from. With eligibility as an always-on filter, `_has_game_filters` stops
    being the right switch: route this case through `_filtered_popularity_ids`,
    whose `_ranked_matching_ids` walk already intersects each index page with a
    where clause. `page` is capped at 100 and `pageSize` fixed at 24, so the
    deepest request needs 2,400 ranked matches, far inside the ~73,000-game
    index — the exhaustive fallback (debt entry 3) should never trigger for
    this shape; add a test that pins that. `_games_query` will likely lose its
    last caller.
  - **Autocomplete** builds its own clause list in `_autocomplete_query`; add
    the eligibility clause there (IGDB accepts `search` together with `where`).
- Enrichment reads (`_duration_values`, `_popularity_for_ids`) only receive IDs
  that already passed the filter and need no change.
- Expect index walks to read somewhat more pages, since fewer rows per index
  page survive the join; `_release_page_is_settled` and `_ranked_matching_ids`
  already keep reading until the page is full.

### Tests

- `tests/adapters/igdb/test_catalog.py` pins exact provider requests in several
  places — the unfiltered popularity test (its `count_requests` expects
  `popularity_primitives`), the filtered clause-set assertion, and the
  autocomplete request. Change those expectations in the red step; do not
  loosen them into substring checks.
- Add one guard that drives every browse strategy (plain sort, popularity walk,
  exhaustive popularity, duration index, release range, release-order walk)
  plus autocomplete, and asserts that every `games` query and count carries the
  eligibility clause — the same shape as the existing
  `assert all("*" not in query ...)` guard — so no future path can skip it.
- `tests/test_games.py`, `tests/test_autocomplete.py`, and the Playwright
  `tests/e2e/fixture_catalog.py` sit behind the `Catalog` port and should not
  change. If they have to, eligibility has leaked out of the adapter.

### Documentation in the same commit

- `docs/api-contract.md` section 2: "Popularity without filters uses the IGDB
  Visits primitive directly" stops being true. State that browse and
  autocomplete apply the same eligibility as detail and that `totalItems`
  counts only eligible games. Regenerate `packages/contracts/openapi.json` only
  if an OpenAPI description string changes; `pnpm contract:check` catches drift.
- The contract says the MVP includes _released_ base games, but neither detail
  nor browse checks release status. Record that for the owner rather than
  widening M3.1 to fix it.
- `docs/technical-debt.md`: mark entry 1 resolved with the measured totals, and
  revisit entry 3 if the popularity fallback's reach changes.
- This plan: the M3.1 Status/Outcome, following the Milestone 2 pattern.

### Live verification

It needs `WTPN_TWITCH_CLIENT_ID` and `WTPN_TWITCH_CLIENT_SECRET` in
`apps/api/.env`; run the API on its own, with no cache in front of IGDB.

- `pnpm smoke:api` still passes.
- Record `totalItems` before and after for an unfiltered popularity sort and an
  unfiltered rating sort (debt entry 1 recorded ~73,000 and ~375,000).
- Confirm by hand that an expansion or DLC which used to appear in
  autocomplete or on a browse page no longer does, and that every result on a
  sampled page opens through `GET /api/v1/games/{gameId}`.
- Re-time the queries recorded in the M2.4 and M2.8 follow-ups:
  `minimumRating=80` (2.9 s), `platform=pc` (1.9 s),
  `platform=pc&platform=nintendo-switch` (2.4 s),
  `platform=nintendo-switch&genre=indie` with 2–10 h (10 s),
  `genre=shooter&minimumRating=80` with ≤ 20 h on page 3 (6 s),
  `genre=pinball` (5.6 s), `platform=pc&sort=release-date` (3.2 s), and
  `platform=pc` across 2020 (58 s) — plus unfiltered popularity on pages 1
  and 100, which now gain a join.

Finish with `pnpm quality`, one commit following CONTRIBUTING.md (bullet-point
body, final `Milestone: M3.1` trailer, no AI co-author), a push to `main`, and
a green CI run.
