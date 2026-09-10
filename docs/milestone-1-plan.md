# Milestone 1 Plan

Status: active execution baseline; M1.2 completed

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

### M1.4 — Filter-metadata vertical slice

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

### M1.5 — Browse-games vertical slice

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

### M1.6 — Strict search criteria and IGDB query translation

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

### M1.7 — Release and duration semantics

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

### M1.8 — Autocomplete vertical slice

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

### M1.9 — Game-detail vertical slice

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

### M1.10 — Composition, live smoke test, and closeout

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
