# Milestone 1 Plan

Status: all ten increments delivered; engineering closeout accepted in
[Milestone 1 review](milestone-1-review.md), with the live IGDB smoke test
pending owner-provided Twitch credentials

Prepared: 2026-09-10

## 1. Goal

Milestone 1 delivers a provider-neutral catalog interface through the public
FastAPI routes while keeping Twitch authentication, IGDB requests, APICalypse,
and provider schemas inside one IGDB adapter.

At completion, automated tests use deterministic fakes and fixtures, while a
manual smoke test can exercise the same application interfaces against live
IGDB data using local server-side credentials.

## 2. Module shape

The application-facing catalog module owns a small interface with the
capabilities required by the use cases:

- obtain normalized filter metadata;
- search normalized game summaries;
- obtain autocomplete suggestions;
- obtain one normalized game detail.

The production `IGDB` adapter and the deterministic test fake satisfy this
interface at the external-provider seam. The adapter hides token acquisition,
APICalypse construction, response projection, pagination, duration joins, and
provider error classification.

Provider HTTP transport, time, and retry waiting are internal seams of the
adapter implementation so its tests can replace external effects. Query
builders and response mappers remain implementation details rather than public
ports. FastAPI, HTTPX, Twitch, and IGDB types must not appear in normalized
domain or application models.

## 3. Cross-cutting delivery rules

Every increment follows these rules:

- use pragmatic TDD through the module interface or public HTTP interface;
- add the smallest observable behavior before generalizing it;
- use handcrafted or recorded, sanitized fixtures for provider responses;
- never call Twitch or IGDB from the automated test suite;
- regenerate and commit OpenAPI and TypeScript artifacts with every public
  contract change;
- represent missing provider values as `null`, never invented defaults;
- keep empty successful results distinct from provider failures;
- keep credentials in backend configuration and out of logs, errors, fixtures,
  browser code, and Git;
- run `pnpm quality` before completing each increment.

## 4. Delivery increments

### M1.1 — HTTP errors and request correlation

Status: completed on 2026-09-10.

Deliver:

- normalized error types and stable public error envelope;
- request ID creation or propagation at the FastAPI edge;
- handlers for application, validation, and unexpected errors;
- safe English fallback messages without provider payloads or stack traces.

Acceptance:

- integration tests observe the documented envelope and request ID;
- invalid input, not found, upstream unavailable, invalid upstream response,
  and timeout errors remain distinguishable;
- the existing health endpoint remains dependency-free.

### M1.2 — Twitch application-token module

Status: completed on 2026-09-10.

Deliver:

- client-credentials token acquisition using backend-only settings;
- in-memory token reuse before expiry and refresh with a safety margin;
- single-flight refresh inside one process;
- authentication failure classification and secret-safe diagnostics;
- controllable time and fake HTTP behavior in tests.

Acceptance:

- tests cover first acquisition, reuse, expiry, concurrent refresh, malformed
  response, timeout, and rejected credentials;
- no token or client secret appears in logs or public errors.

Outcome: the token manager now exposes one application-facing method, caches a
validated grant until its safety margin, and single-flights refreshes within the
process. Its HTTP boundary implements Twitch's form-encoded client-credentials
exchange and emits only stable, secret-safe failure categories. Deterministic
tests cover the lifecycle and external HTTP behavior without network access.

### M1.3 — IGDB transport and bounded retry

Status: completed on 2026-09-11.

Deliver:

- authenticated server-side requests to the IGDB endpoint;
- required headers, minimal field projections, and bounded timeouts;
- at most one retry for eligible transient failures with jitter;
- bounded `Retry-After` handling and provider error classification;
- no retry for invalid requests or permanent authentication failures.

Acceptance:

- deterministic tests cover success, timeout, rate limit, transient 5xx,
  permanent 4xx, retry exhaustion, and malformed payloads;
- retries cannot exceed the configured attempt and deadline limits.

Outcome: the authenticated HTTP transport now sends explicit APICalypse
projections with the required IGDB headers and validates successful response
shapes. Per-attempt timeouts and an operation deadline bound all work. Timeout,
network, rate-limit, and server failures receive at most one retry with injected
jitter or a capped numeric `Retry-After`; permanent client failures are not
retried. Provider payloads remain outside classified exceptions, and all tests
use in-memory HTTP and time controls.

### M1.4 — Filter-metadata vertical slice

Status: completed on 2026-09-11.

Deliver:

- normalized identifier/label and filter-metadata models;
- the first capability on the catalog interface plus a deterministic fake;
- IGDB queries and fixture-backed mappings for genres, game modes, and the
  approved platform groups;
- stable public slugs independent of raw provider labels;
- deterministic ordering and explicit exclusion of unsupported values;
- `GET /api/v1/filters` through route, application logic, and the production
  IGDB adapter;
- allow-listed durations, sorts, and validation bounds;
- regenerated TypeScript client.

Acceptance:

- the route matches the documented public shape;
- route tests replace the external adapter without patching internals;
- provider identifiers do not leak into application-owned public identifiers;
- sanitized fixtures cover known, unknown, renamed, and missing fields;
- mapping tests exercise the catalog interface rather than mapper internals;
- an upstream failure cannot become an empty successful filter list.

Outcome: the provider-neutral catalog interface now exposes normalized filter
metadata through `GET /api/v1/filters`. The IGDB adapter requests only IDs and
names, maps curated provider IDs to stable application-owned platform, genre,
and game-mode identities, ignores unsupported records, and keeps deterministic
ordering. Static durations, sorts, and validation bounds are required in the
OpenAPI shape. Sanitized fixtures cover known, renamed, unknown, and missing
provider data; classified upstream errors remain distinct from empty success.

### M1.5 — Browse-games vertical slice

Status: completed on 2026-09-11.

Deliver:

- normalized game-summary, image, rating, pagination, and response-meta models;
- provider-neutral search criteria with browse defaults;
- unfiltered `GET /api/v1/games` with popularity ordering and 24-item pages;
- fixture-backed IGDB mapping and regenerated TypeScript client.

Acceptance:

- the endpoint returns summaries without requiring optional provider fields;
- missing cover, rating, duration, release, genre, platform, or mode values
  remain `null` or empty according to the contract;
- empty catalog results are successful and distinct from upstream failures.

Outcome: the provider-neutral catalog now exposes 24-item unfiltered pages
through `GET /api/v1/games`, with page 1 and popularity descending as defaults.
The IGDB adapter uses the current IGDB Visits popularity primitive, obtains an
exact total from its count endpoint, fetches a minimal game projection, and
restores popularity order. Complete and sparse sanitized fixtures cover
nullable and list-valued optional data; empty pages remain successful while all
existing provider failure classifications propagate. OpenAPI and the generated
TypeScript client include the browse operation.

### M1.6 — Strict search criteria and IGDB query translation

Status: completed on 2026-09-11.

Deliver:

- validation and normalization for name, platform, genre, dates, rating, game
  mode, sort, direction, page, and repeated values;
- strict AND logic across categories and OR logic within a category;
- provider query construction hidden inside the IGDB adapter;
- stable sorting and bounded pagination.

Acceptance:

- public integration tests cover valid combinations, unknown parameters,
  invalid bounds, duplicate values, defaults, and the 100-page ceiling;
- adapter tests prove AND/OR translation without asserting irrelevant query
  formatting;
- the adapter never silently relaxes a valid query.

Outcome: `GET /api/v1/games` now validates and normalizes name, repeated
platform/genre/mode values, first-release bounds, minimum combined rating,
sort, direction, and pages 1–100. Public IDs are allow-listed, duplicates are
removed in caller order, unknown parameters and invalid ranges receive the
stable validation envelope, and sensible direction defaults depend on sort.
The IGDB adapter escapes name input, translates OR within categories and AND
across categories, preserves exact filters for popularity through batched IGDB
Visits resolution, and maps rating, release-date, and title sorts directly.
Duration and platform-specific release semantics remain explicitly deferred to
M1.7. OpenAPI and the TypeScript client expose the M1.6 criteria.

### M1.7 — Release and duration semantics

Status: completed on 2026-09-11.

Deliver:

- platform-specific release-date filtering and first-release fallback;
- fast, normal, and completionist duration mapping;
- duration enrichment when the required data comes from another IGDB endpoint;
- strict exclusion of unknown rating or duration only when its filter is active;
- `excludedUnknownDuration` response metadata.

Acceptance:

- tests cover multiple selected platforms, platform dates inside and outside
  the interval, missing dates, missing ratings, and missing durations;
- duration bounds are inclusive and use whole seconds internally;
- joins preserve result order, pagination, and games with unrelated missing
  data.

Outcome: selected-platform release bounds now evaluate the matching platform
records with OR semantics, while searches without platforms retain the
first-release fallback. Duration criteria default to normal play, convert
validated hour values to inclusive whole seconds, and map fast, normal, and
completionist measures from the IGDB time-to-beat endpoint. Cross-resource
criteria are evaluated before paging so ordering and exact totals survive the
join. Cards receive normal duration when available; unrelated missing fields
remain intact, unknown duration sorts last, and only active duration bounds set
`excludedUnknownDuration=true`. OpenAPI and the TypeScript client expose the
complete M1.7 query surface.

### M1.8 — Autocomplete vertical slice

Status: completed on 2026-09-12.

Deliver:

- `GET /api/v1/games/autocomplete` through the catalog interface;
- query validation, optional platform context, fixed eight-item limit, and
  normalized title/year/cover suggestions;
- fixture-backed IGDB query and mapping;
- regenerated TypeScript client.

Acceptance:

- fewer than two or more than 100 characters are rejected consistently;
- results never exceed eight and missing year or cover remains nullable;
- autocomplete failure remains distinguishable and does not change normal
  search behavior.

Outcome: `GET /api/v1/games/autocomplete` now extends the catalog interface
with a provider-neutral autocomplete capability. The HTTP boundary trims and
validates `q` to 2–100 characters, accepts repeated platform context, and
rejects unknown parameters with the standard validation envelope. The IGDB
adapter issues a relevance-ranked `search` query, narrows it with the same
AND/OR platform translation used by browse, and caps normalized title/year/
cover suggestions at eight regardless of the provider's response size.
Suggestions omit rating, genre, platform, and duration data by design, and
classified upstream failures remain distinct from empty results. OpenAPI and
the TypeScript client expose the new operation.

### M1.9 — Game-detail vertical slice

Status: completed on 2026-09-12.

Deliver:

- `GET /api/v1/games/{gameId}` through the catalog interface;
- normalized detail models for names, summary, images, releases, genres,
  themes, platforms, modes, multiplayer data, ratings, durations, age ratings,
  and allow-listed external links;
- fixture-backed detail mapping and regenerated TypeScript client.

Acceptance:

- tests cover a complete fixture and a sparse fixture;
- an absent eligible game returns `GAME_NOT_FOUND` while upstream failures keep
  their own error codes;
- the numeric IGDB ID is the resource identity and provider text is preserved
  without automatic translation.

Outcome: `GET /api/v1/games/{gameId}` now extends the catalog interface with a
provider-neutral detail capability returning names, summary, cover,
screenshots, platform-specific releases, genres, themes, platforms, game
modes, aggregated multiplayer support, user/critic/combined ratings,
fast/normal/completionist durations with a shared submission count, age
ratings, and allow-listed external links. Genres, platforms, and game modes
reuse the same stable identifiers as `/filters` and `/games`; names, summary,
theme names, age ratings, and external-link labels preserve provider text
without translation. Eligibility enforces the MVP content scope from
`docs/product-requirements.md#3.2` — released base games plus their
separately cataloged remakes and remasters — collapsing both an absent game
ID and an excluded content type into the same `GAME_NOT_FOUND` response so a
request cannot distinguish the two. Complete and sparse sanitized fixtures
cover full and nullable/empty detail; classified upstream failures remain
distinct from not-found. OpenAPI and the TypeScript client expose the
complete M1.9 operation.

The exact numeric IGDB category codes for external-link types and the
`age_ratings` field shape used here are best-effort from documentation and
training knowledge, not verified against live data (M1.1–M1.9 use only
fixtures by design). Confirm both during the M1.10 live smoke test and adjust
`WEBSITE_LABELS` or the age-rating field expansion in
`adapters/igdb/catalog.py` if real responses disagree.

### M1.10 — Composition, live smoke test, and closeout

Status: engineering completed on 2026-09-12; live smoke-test verification
pending owner-provided Twitch credentials.

Deliver:

- production composition of token, transport, and catalog adapters;
- startup behavior that remains safe when optional local credentials are absent;
- one opt-in manual smoke command that queries live filter, search,
  autocomplete, and detail data without printing credentials;
- final contract/client drift check and Milestone 1 evidence report.

Acceptance:

- `pnpm quality` passes without network access or credentials;
- with owner-provided local credentials, the smoke command observes real data
  through all four catalog capabilities;
- the TypeScript client exposes every M1 operation;
- all Milestone 1 exit criteria in the roadmap have recorded evidence.

Outcome: `main.build_catalog()` is now the single composition seam deciding
whether the application talks to real IGDB. When both `WTPN_TWITCH_CLIENT_ID`
and `WTPN_TWITCH_CLIENT_SECRET` are configured it composes one shared
`httpx.AsyncClient`, `TwitchTokenManager`, `IgdbTransport`, and `IgdbCatalog`,
closing that client on application shutdown; when either is absent,
`create_app()` falls back to `UnavailableCatalog`, exactly as before this
increment. `pnpm smoke:api` runs `apps/api/scripts/smoke_igdb.py`, an opt-in
command excluded from `pnpm quality` and CI that exercises all four `Catalog`
capabilities against live data and prints only counts and titles. It has been
verified to fail safely and informatively without configured credentials;
observing real IGDB data requires the owner to first create a Twitch
application, which remains an explicit, tracked action in
[External prerequisites](external-prerequisites.md) rather than an
engineering task. Three of the four Milestone 1 exit criteria have full
automated evidence; the fourth (the live smoke test observing real data) is
implemented and ready but not yet executed. Full evidence is recorded in
[Milestone 1 review](milestone-1-review.md).

## 5. Scope guardrails

Milestone 1 does not add Redis response caching, public rate limiting, a circuit
breaker, production telemetry, or frontend search screens. Those belong to
Milestones 2 and 4. M1.2 may cache the short-lived Twitch token in process, and
M1.3 implements only the bounded timeout/retry behavior required to make direct
provider access safe enough for this milestone.

## 6. External dependency timing

M1.1 through M1.9 can be developed with fakes and sanitized fixtures. Before
M1.10, the owner must create the Twitch application and place its Client ID and
Client Secret in the ignored local API environment file. The IGDB commercial
inquiry and final product-domain decision remain public-beta gates rather than
M1 implementation blockers.

## 7. Milestone 1 closeout and Milestone 2 handoff

All ten increments are delivered; [Milestone 1 review](milestone-1-review.md)
records the full increment history, capability inventory, and per-criterion
acceptance evidence. Two items remain explicit owner or follow-up actions
rather than open Milestone 1 engineering work:

- running `pnpm smoke:api` with a real Twitch application's credentials to
  observe live IGDB data and confirm or correct the best-effort
  `WEBSITE_LABELS` and `age_ratings` assumptions documented in the M1.9 and
  M1.10 outcomes above;
- adding the same base-game content-type eligibility that M1.9 enforces for
  `GET /api/v1/games/{gameId}` to the `GET /api/v1/games` browse path, which
  does not yet exclude DLC, expansions, or mods.

Milestone 2 (search experience) can start from the generated TypeScript
client and the documented [API contract](api-contract.md) without waiting on
either item.
