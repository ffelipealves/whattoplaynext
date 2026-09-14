# Milestone 3 Plan

Status: proposed; owner decisions in section 7 are pending

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
recommendation; the plan above assumes it.

1. **Pay browse content eligibility first (M3.1).** Recommended. Once result
   cards link to game pages, every ineligible browse result becomes a link to a
   not-found page. The alternative is deferring it to its public-beta gate and
   accepting those dead links during closed beta.
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
