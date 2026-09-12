# Milestone 2 Plan

Status: active execution baseline; M2.2 completed and M2.3 ready

Prepared: 2026-09-12

## 1. Goal

Milestone 2 delivers the complete faceted search experience against the
Milestone 1 API: a localized home and search page where a visitor combines
name, platform, genre, release date, rating, game mode, and duration into one
strict query, sees transparent paginated results, and recovers gracefully from
validation, rate-limit, and upstream failures.

At completion, submitted search state lives entirely in the URL — reload,
back/forward navigation, and a shared link all restore the same query and
page — and the same generated TypeScript client from `packages/contracts`
that already exposes every M1 operation is the only way the web app talks to
the API.

## 2. Module shape

The web app has no application-wide client state store. Submitted search
criteria are the single source of truth in the URL's query string; a small
Zod schema mirrors the API's public `BrowseCriteria` bounds (name length,
allow-listed IDs, date range, rating range, duration bounds, page ceiling) so
the search page can validate and normalize what it reads from the URL before
either rendering or querying, matching the strictness already enforced
server-side. Transient, not-yet-submitted form state (a filter being edited
before "Apply") stays local to the filter form and never reaches the URL or
the network until submitted.

Server Components fetch initial page data from the typed API client for the
request's current URL; Client Components own only interactive controls — the
filter form, the autocomplete input, sort/page controls, and drawer/sheet
open state. The generated `packages/contracts` client is the only seam that
knows the API's base URL and OpenAPI paths; feature code calls it through one
small factory rather than constructing requests itself. FastAPI operation
names, HTTPX, and other provider-side concerns must not leak into web
components.

`next-intl` owns locale routing and all first-party UI strings for this
milestone's surfaces; provider-sourced game text (titles, summaries) is never
run through it, matching the no-automatic-translation rule already
established for the API.

## 3. Cross-cutting delivery rules

Every increment follows these rules:

- use pragmatic TDD through component tests and, once the critical path
  exists, Playwright;
- no filter reaches the URL or the network before an explicit Apply action;
- represent missing card or detail data explicitly; never invent a value IGDB
  did not provide;
- keep an upstream failure visually and semantically distinct from a genuine
  zero-result state;
- keep all first-party UI text localized through `next-intl`; provider text
  (titles, names) is never machine-translated;
- meet WCAG 2.2 AA incrementally as each control ships, not as a final pass;
- regenerate and consume the TypeScript client from `packages/contracts`
  rather than hand-writing request/response types;
- run `pnpm quality` before completing each increment.

## 4. Delivery increments

### M2.1 — Frontend foundations

Status: completed on 2026-09-12.

Deliver:

- Tailwind design tokens and the shadcn/ui primitives the search UI will
  need (button, input, select, checkbox, slider or numeric range, sheet,
  badge/chip, skeleton);
- the typed API client from `packages/contracts` wired into the web app with
  an environment-driven base URL;
- one minimal server-rendered fetch (for example, filter metadata) proving
  the client, environment configuration, and error surface all work end to
  end against the local API.

Acceptance:

- a component test renders each new primitive;
- the proof-of-life fetch renders real data from a locally running API and a
  documented, visible failure state when the API is unreachable;
- no request or response type for this call is hand-written outside the
  generated client.

Outcome: `shadcn@latest init`/`add` (Radix base) supplied button, input,
select, checkbox, slider, sheet, badge, and skeleton under
`src/components/ui/`; their generated theme was rewired in `globals.css` to
reuse this project's existing brand tokens (ink/paper/cobalt/signal) instead
of shadcn's generic neutral palette, and a `--danger` token was added since
none of the brand colors covered destructive actions. `src/lib/api-client.ts`
wraps `createApiClient` from `@whattoplaynext/contracts` behind one
`getApiClient()` factory reading `NEXT_PUBLIC_API_BASE_URL`. The home page's
existing status line now calls it through `getCatalogStatus()` and renders
live filter counts, proving the client end to end against the local API
verified in M1.10.

Two real bugs surfaced during manual verification rather than unit testing
alone: `getCatalogStatus()` did not catch a rejected `fetch()` (the API
process fully unreachable, as opposed to a classified HTTP error), which
crashed the page instead of showing the documented offline message — found by
actually stopping the local API and reloading, then fixed and covered by a
regression test. Separately, `apps/web` newly depending on
`@whattoplaynext/contracts` means its build output must exist before `next
dev`/`next build` run; the root `dev` and `dev:web` scripts now build
contracts first. Coverage thresholds extend to `src/lib/**`; generated
`src/components/ui/**` primitives are excluded from the threshold, matching
the project's existing "generated code excluded" precedent for contract
types, but still carry a smoke test per the acceptance criteria above.

### M2.2 — `next-intl` adoption

Status: completed on 2026-09-12.

Deliver:

- locale routing and message catalogs for English and Brazilian Portuguese
  replacing the hand-rolled dictionary in `features/landing/content.ts`;
- first-visit locale detection with a manually overridable, locally
  remembered preference (no account, no unique identifier);
- the existing landing page migrated with no observable behavior change.

Acceptance:

- a component or route test confirms both locales render the landing page
  correctly through `next-intl`;
- switching languages persists across reload without a server round trip
  keyed to an identifier;
- `content.ts`'s bespoke locale dictionary is removed, not left as a second
  parallel pattern.

Outcome: `app/[locale]/layout.tsx` is now the application's actual root
layout — `app/layout.tsx` and the manual `redirect("/en")` at `app/page.tsx`
are both gone, since `src/proxy.ts` (Next.js 16's renamed middleware)
redirects the bare root to a locale itself. Because the root layout now lives
inside the `[locale]` segment, `src/i18n/request.ts` reads the current locale
through `next/root-params` (introduced in Next.js 16.3, days before this
increment) rather than the officially deprecated `requestLocale` callback
parameter; this only works because there is no non-localized route above
`[locale]` competing for the root-layout position. `messages/en.json` and
`messages/pt-br.json` replace `features/landing/content.ts` entirely,
including one pre-existing bug the migration exposed: the "Draft" badge on
the example card was a hardcoded English string never wired to the old
content dictionary, so it never translated — it now reads `exampleBadge` like
everything else. Locale detection, the `NEXT_LOCALE` cookie, and its
override via the language-switcher `Link` are next-intl's built-in
middleware behavior, not hand-rolled logic; verified live by switching
locales and confirming a fresh visit to `/` afterward lands on the
last-chosen locale without a signed-in identifier. `vitest.config.mts` gained
`server.deps.inline` for `next-intl`/`next` — left external, Vitest hands
next-intl's extensionless `next/...` subpath imports to Node's stricter ESM
resolver, which fails outside of Next's own bundler. Component tests wrap
`LandingPage` in `NextIntlClientProvider` with the real message files (not a
hand-duplicated subset) for both locales.

### M2.3 — Unfiltered search results

Deliver:

- the localized search route with name search, default popularity sort, and
  page 1 as the zero-filter baseline;
- URL-driven page and sort/direction state parsed and validated against the
  same bounds as the API (page 1–100, allow-listed sort values);
- a 24-item result grid using the documented card fields (cover, title,
  release year, platforms, genres, rating and vote count, normal duration,
  game modes), a loading skeleton, and the zero-result state with suggested
  relaxations;
- numbered pagination bounded at 100 pages.

Acceptance:

- reloading, sharing, or using back/forward for a URL with a page and sort
  restores the identical query and results;
- missing card fields (cover, rating, duration, genre, platform, mode) render
  an explicit absent state, never an invented value;
- a genuine zero-result response and an upstream failure are visually and
  semantically distinguishable states;
- a component test covers the loading, populated, zero-result, and card
  null-field states.

### M2.4 — Structured filters (desktop sidebar)

Deliver:

- a desktop sidebar with platform, genre, release-date range, minimum
  rating, game mode, and duration (kind plus bounds) controls sourced from
  `GET /api/v1/filters`;
- explicit Apply and Clear-all actions; no filter reaches the URL before
  Apply;
- individually removable active-filter chips reflecting exactly what was
  applied;
- UI copy explaining the result set when `excludedUnknownDuration` is true.

Acceptance:

- selecting multiple values within one category and submitting reflects OR
  within that category and AND across categories in the resulting URL and
  request;
- removing one chip re-submits with only that criterion cleared, not a full
  reset;
- Clear-all returns to the M2.3 zero-filter baseline;
- a component test drives Apply, Clear-all, and single-chip removal without
  a network call before Apply.

### M2.5 — Mobile filter drawer

Deliver:

- the same filter set from M2.4 presented in a drawer opened by a button
  showing the active-filter count;
- Apply and Clear-all remain reachable without excessive scrolling inside
  the drawer.

Acceptance:

- the drawer and the desktop sidebar submit identical URLs for the same
  selections, verified by a shared test against both layouts;
- the trigger button's active-filter count matches the applied chips exactly.

### M2.6 — Name autocomplete

Deliver:

- debounced suggestions (300 ms) starting at two characters, capped at eight
  results with title, year, and cover where available;
- selecting a suggestion fills the name field without submitting the search;
- graceful degradation to a plain text field when autocomplete fails, without
  blocking manual submission.

Acceptance:

- fewer than two characters or inside the debounce window shows no request;
- a simulated autocomplete failure leaves the name field and full search
  usable;
- a component test covers selection, debounce, and the failure fallback.

### M2.7 — Validation, rate-limit, and upstream-failure states

Deliver:

- mapping from the stable API error envelope
  (`VALIDATION_ERROR`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`,
  `UPSTREAM_TIMEOUT`, `UPSTREAM_INVALID_RESPONSE`) to recoverable UI states;
- a retry action for recoverable failures;
- client-side pre-validation against the M2 Zod schema so obviously invalid
  URL values surface immediately rather than only after a round trip.

Acceptance:

- each mapped error code renders a distinct, correctly localized message;
- an upstream failure never renders as, or is announced as, an empty
  successful result set;
- a rate-limited response surfaces any provided retry timing rather than a
  generic failure.

### M2.8 — Accessibility and keyboard pass

Deliver:

- full keyboard operability across search, filters (both layouts),
  autocomplete, sorting, and pagination, with visible focus throughout;
- programmatic labels for every input and an ARIA live region announcing
  validation messages and result-count changes.

Acceptance:

- an automated accessibility check (for example axe) reports no critical
  violations on the search page in both layouts;
- a manual keyboard-only pass completes the full primary journey from the
  product requirements without a mouse;
- announced live-region text is verified by a component test, not only
  visual inspection.

### M2.9 — Playwright critical path

Deliver:

- a small Playwright suite covering search submission, URL restoration and
  back/forward, pagination, locale switch, upstream error, and zero-result
  behavior, running against a fixture-backed API exactly like the pytest
  suite;
- the suite wired into `pnpm quality`, per the architecture's stated intent
  to add it once these journeys exist.

Acceptance:

- the suite passes without live IGDB access, using fakes or fixtures at the
  API boundary;
- each journey in the deliverable list has at least one passing scenario;
- `pnpm quality` remains green and credential-free with the suite included.

### M2.10 — Milestone 2 closeout

Deliver:

- a cross-browser and responsive verification pass (the two latest stable
  releases of Chrome, Edge, Firefox, and Safari; mobile and desktop
  viewports);
- final contract-drift check and a Milestone 2 evidence report mirroring
  [Milestone 1 review](milestone-1-review.md).

Acceptance:

- `pnpm quality` passes, including the Playwright suite, without network
  access or credentials;
- every Milestone 2 exit criterion in the roadmap has recorded evidence;
- Core Web Vitals targets (LCP, INP, CLS) are spot-checked on the search
  page and recorded, even if formal performance testing remains a later
  milestone concern.

## 5. Scope guardrails

Milestone 2 does not add game-detail pages, canonical/slug redirects, Open
Graph or sitemap behavior, or the About/Data Sources/Privacy/Terms pages —
those belong to Milestone 3. It does not add the feedback prompt or
first-party analytics events — those belong to Milestone 4 alongside Redis
caching, rate-limit headers' full enforcement story, and a circuit breaker.
M2.7's error states cover only the search surface itself; full localized
system-wide error pages (404, generic 500) are Milestone 3 work. Age ratings,
multiplayer details, and other game-detail-only fields are out of scope here
even though the API already returns them.

## 6. External dependency timing

Milestone 1 closed with local Twitch/IGDB credentials already configured and
verified against live data, so Milestone 2 can develop and manually check
every increment against real API responses from the first increment onward;
no new external action is required before any M2 increment. Automated tests
still never depend on live IGDB access, matching the M1 rule extended to the
API boundary the web app now also crosses.
