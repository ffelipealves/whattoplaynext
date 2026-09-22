# Architecture

Status: accepted MVP architecture baseline; implementation complete through
Milestone 3, with the Milestone 4 infrastructure and operations marked below
Last updated: 2026-09-22

## 1. Context

This document describes the accepted design and its implementation status.
Product behavior, quality targets, and scope are defined only in the
[product requirements](product-requirements.md). Sections labelled for
Milestone 4 are targets, not claims that the mechanisms already run.

## 2. System view

```text
Browser
  │
  ├── pages, metadata, localized UI
  ▼
Next.js web application (Vercel target)
  │  generated REST client
  ▼
FastAPI service (Render target)
  │
  ├── validation and query normalization
  ├── IGDB transport timeout, retry, and 429 handling (implemented)
  ├── public rate limiting and circuit breaker (Milestone 4)
  ├── Redis-compatible cache (Milestone 4)
  └── IGDB adapter ───────────────► Twitch OAuth / IGDB API

Anonymous analytics ──────────────► Umami Cloud (Milestone 4)
Errors and health ────────────────► monitoring providers (Milestone 4)
```

## 3. Repository layout

```text
whattoplaynext/
├── apps/
│   ├── web/                  # Next.js application
│   └── api/                  # FastAPI application
├── packages/
│   └── contracts/            # generated TypeScript API client
├── docs/
├── compose.yaml              # local supporting services only
└── README.md
```

A specialized monorepo orchestration framework is not required initially.

## 4. Technology choices

### 4.1 Web

- Next.js App Router;
- React and TypeScript with strict checking;
- Tailwind CSS and shadcn/ui;
- `next-intl` for locale routing and translations;
- React Hook Form and Zod for the search form;
- Server Components for initial page data where practical;
- Client Components only for interactive controls;
- pnpm, ESLint, and Prettier.

No Redux or other application-wide client state store is planned. Submitted
search state lives in the URL; transient form state remains local to the form.

### 4.2 API

- FastAPI;
- Pydantic models and settings;
- asynchronous HTTPX client;
- asynchronous Redis-compatible client (Milestone 4);
- structured JSON logging (Milestone 4);
- Poetry dependency management;
- Ruff, mypy, and pytest.

SQLAlchemy and a relational database are excluded until a persistent domain
requirement appears.

### 4.3 Contract

FastAPI OpenAPI is the source of truth. CI regenerates or verifies the typed
TypeScript client in `packages/contracts`. Python and TypeScript models must not
be maintained as independent handwritten copies.

The contract module commits a deterministic OpenAPI snapshot and generates
TypeScript paths with `openapi-typescript`. Its small handwritten interface
creates an `openapi-fetch` client parameterized by those paths. Consumers learn
one factory and the OpenAPI operations; generator and transport details remain
inside the module. Every FastAPI route declares a stable `operationId`, and the
root contract check detects schema or generated-type drift without starting an
HTTP server.

## 5. Domain boundary

### 5.1 Internal API architecture

The FastAPI application uses a selective hexagonal architecture. FastAPI routes
are inbound adapters. Domain modules define small interfaces only at real seams,
and external integrations such as IGDB and Redis provide adapters for those
interfaces. Test fakes use the same seams as production adapters.

Framework, provider, and cache types must not enter domain modules. The
application composition root selects concrete adapters and passes dependencies
to their consumers. A new interface is not introduced for logic that has only
one implementation and no meaningful variation; this avoids pass-through
layers while preserving dependency inversion where it provides leverage.

The web application sends provider-neutral search criteria. It must not build
IGDB-specific query strings.

```ts
type SearchCriteria = {
  name?: string;
  platformIds?: string[];
  genreIds?: string[];
  releaseFrom?: string;
  releaseTo?: string;
  minimumRating?: number;
  gameModeIds?: string[];
  duration?: {
    kind: "fast" | "normal" | "completionist";
    minimumHours?: number;
    maximumHours?: number;
  };
  sort: "popularity" | "rating" | "release-date" | "duration" | "title";
  direction: "asc" | "desc";
  page: number;
  pageSize: 24;
};
```

The strict-matching service consumes this model in the MVP. Future approximate
matching or language parsing must produce or consume the same normalized model
rather than changing UI semantics.

## 6. Provider adapter

Only the IGDB adapter understands APICalypse, provider field names, Twitch
tokens, provider pagination, and IGDB IDs. It maps provider responses into the
public API models.

Responsibilities:

- obtain and refresh a Twitch application token server-side;
- enforce a process-wide and distributed upstream request budget (Milestone 4);
- construct the minimum IGDB field projection;
- join duration or related endpoint data when required;
- normalize nullable fields and image URLs;
- distinguish a valid empty result from an upstream failure;
- expose source and freshness metadata internally;
- tolerate schema evolution without leaking it to the frontend.

The M1.2 token implementation is process-local and deliberately narrow.
`TwitchTokenManager.get_access_token()` hides credentials, expiry bookkeeping,
and concurrency from its consumers. It refreshes 60 seconds before expiry and
uses a double-checked asynchronous lock so concurrent callers share one token
request. A separate HTTP boundary owns Twitch's wire format and reduces failures
to authentication rejected, timeout, unavailable, or invalid response without
including provider payloads. Redis token sharing is not part of this seam.

The M1.3 IGDB transport accepts an endpoint and an explicit APICalypse query,
obtains authentication through the token seam, and owns all provider HTTP
details. Each request has a five-second default timeout inside a ten-second
operation deadline. A timeout, connection failure, `429`, or `5xx` response may
be retried once; jitter applies to local backoff and numeric `Retry-After` is
capped at two seconds. Authentication and other permanent `4xx` failures are
never retried. Successful responses must be arrays of records, preventing an
invalid provider payload from becoming an empty catalog result.

M1.4 introduces the application-owned `Catalog` interface at the variable
provider seam. Its filter-metadata capability returns only normalized models;
FastAPI and IGDB types remain outside that interface. The IGDB implementation
queries only `id` and `name`, resolves numeric IDs through curated tables, and
emits stable public IDs and English labels regardless of upstream renames.
Unknown or identifier-less records are excluded in allow-list order. Transport
failures are translated to application errors before reaching the HTTP adapter,
so an upstream failure cannot masquerade as empty metadata.

M1.5 extends `Catalog` with provider-neutral browse criteria and a normalized
game-page result. Because the current IGDB `Game` schema no longer exposes the
legacy popularity field, the adapter uses the documented IGDB Visits
popularity primitive: it counts and pages `popularity_primitives` ordered by
`value` descending, fetches a minimal explicit projection from `games`, and
restores primitive order. The transport has a separate validated `count()`
operation for IGDB's object response while its general `query()` contract
remains array-only. Optional provider data becomes `null` or an empty list. At
the M1.5 boundary, metadata reported direct, non-stale provider data and no
duration-based exclusion; M1.7 extends that behavior below.

M1.6 expands those criteria with allow-listed public platform, genre, and mode
identifiers plus normalized name, release, rating, sort, direction, and page
values. The HTTP adapter rejects unknown fields and invalid ranges before the
provider seam. The IGDB adapter builds escaped APICalypse clauses with OR
inside repeated categories and AND across categories. Rating, release-date, and
title ordering stay on `games`. Filtered popularity first obtains every exact
matching game ID in provider-sized batches, resolves the corresponding IGDB
Visits values, applies an ID tie-breaker, and only then selects the requested
page; this avoids silently replacing popularity or dropping filters. At that
increment boundary, platform-specific release selection and all duration joins
and sorting remained assigned to M1.7.

M1.7 evaluates criteria that span IGDB resources before pagination. When a
platform and release range are both present, the candidate game projection adds
only `release_dates.platform` and `release_dates.date`; any selected-platform
release may satisfy the interval. Without a platform, filtering stays on
`first_release_date`. Duration values are joined from `game_time_to_beats`, with
`hastily`, `normally`, and `completely` mapped to provider-neutral fast, normal,
and completionist seconds. The query requests only the selected measure plus
`normally` when card enrichment also needs it. Candidate IDs are filtered and
ordered before slicing the 24-item page, keeping totals exact and unknown values
last for sorting. Missing durations remain eligible unless an inclusive duration
bound is active; only that policy sets `excludedUnknownDuration`.

Milestone 2 replaced exhaustive popularity and release/duration scans on broad
queries with bounded index walks; Milestone 3.1 applied the detail endpoint's
eligible `game_type` rule to every discovery path and count. The exhaustive
popularity fallback and exact count on a broad platform release range remain
documented in the [technical debt register](technical-debt.md).

## 7. Caching

Redis is a disposable optimization, not a source of truth. Its client, cache
keys, coalescing, and stale-if-error behavior are Milestone 4 work; through
Milestone 3 the API does not read or write Redis. The popular-game endpoint
sets a 24-hour HTTP cache policy and the Next.js sitemap revalidates daily.

Planned configurable Redis TTLs:

| Resource                                      |           Fresh TTL |
| --------------------------------------------- | ------------------: |
| Search response                               |              1 hour |
| Game detail                                   |            24 hours |
| Genres, platforms, modes, and filter metadata |              7 days |
| Empty/negative lookup                         | short, configurable |
| Popular-game sitemap selection                |            24 hours |

Cache keys will be generated from a canonical serialization of validated
criteria, API version, locale-sensitive presentation needs, and response
schema version. Identical in-flight cache misses will share one upstream
request.

Expired cache entries may be retained for a bounded stale-if-error window. A
cache outage should fall back to rate-limited IGDB access when Milestone 4
implements this path.

## 8. Resilience

The IGDB transport already has bounded timeouts, one retry for eligible
transient failures, jitter, and bounded `Retry-After` handling. The web
application renders classified provider failures and retry timing. The public
rate limiter, circuit breaker, and stale-if-error cache reads are Milestone 4
work; the provider's own 429 can currently surface as `RATE_LIMITED`.

## 9. Security and privacy

The browser is untrusted, the FastAPI service is the only credential-bearing
component, and IGDB and analytics are third-party trust boundaries. Strict
validation runs before provider access, and public errors expose only stable
codes and a correlation ID. Public rate limiting, structured log redaction,
and analytics allow-lists remain Milestone 4 work. The binding requirements
are NFR-015 through NFR-023.

Supported environment-variable names are committed only in `.env.example`
files. Populated `.env` files remain untracked. Browser-visible configuration
uses the `NEXT_PUBLIC_` prefix and never contains credentials; backend settings
use `WTPN_`. Twitch credentials are validated as an all-or-nothing pair and the
secret uses a redacting type in application configuration.

## 10. Rendering and SEO

Next.js renders indexable routes and their metadata on the server. Search state
is encoded in query parameters but result routes emit `noindex`. Game identity
comes from the numeric ID; the slug is corrected with a locale-preserving
canonical redirect. The sitemap reads a bounded popular-game API selection,
revalidates daily, and still lists static pages if that API fails. See NFR-029
through NFR-032 for expected behavior.

## 11. Observability

FastAPI accepts a bounded safe caller identifier or generates a UUID, returns
it in `X-Request-ID`, and includes it in the stable error envelope. End-to-end
propagation through Next.js, future cache and provider operations, structured
telemetry, dashboards, and retention remain Milestone 4 work under NFR-023 and
NFR-025 through NFR-027.

## 12. Deployment

The following are deployment targets, not evidence that public environments
have been provisioned. Costs are historical planning estimates and must be
rechecked before launch.

### Development and closed testing

- Docker Compose with Redis bound to loopback for local development;
- Vercel Hobby for the web application;
- Render Free for the API, accepting cold starts;
- Upstash Redis Free.

### Public beta

- Vercel Pro;
- Render Starter or an equivalent always-on service;
- Upstash Redis Free until measured usage or reliability requires a paid tier.

Expected initial base cost is approximately USD 27 per month before taxes and
usage overages. Provider prices and terms must be rechecked at launch.

Environments:

- local;
- ephemeral pull-request preview;
- production.

There is no permanent staging environment in the MVP.

## 13. CI/CD

GitHub Actions runs formatting/linting, static typing, unit and integration
tests, coverage thresholds, contract-generation verification, and production
builds through the root `pnpm quality` command. This is the same entry point
used locally, so the two environments do not encode different validation
rules. The workflow receives read-only repository access and does not require
provider credentials or live infrastructure.

A small critical Playwright suite runs inside that gate, driving a real browser
against the real application composed with a fixture catalog: it needs no
provider credentials and no live infrastructure, exactly like the rest of the
suite. The workflow installs Chromium for the default gate; its on-demand
browser job runs 27 scenarios in five engine/layout projects on manual dispatch
or a `[browser-matrix]` push commit. Deployment and secret scoping remain
release work rather than an active CI deployment job.

## 14. Testing strategy

The project follows pragmatic test-driven development. Development of domain
rules, use cases, API behavior, and bug fixes follows a small red-green cycle:
write one failing behavioral test through an agreed public seam, implement only
enough behavior to make it pass, and continue with the next vertical slice.
Refactoring happens after the behavior is green and is reviewed separately.

Tests describe observable outcomes and must remain stable when internals are
reorganized. Mocks and fakes are reserved for system boundaries such as IGDB,
Redis, time, and network failures; internal collaborators are exercised through
their public interface. Purely visual, documentation-only, generated-code, and
configuration changes do not require a failing test first, but still require
the relevant automated or manual verification. Every bug fix starts with a
regression test whenever the failure can be reproduced automatically.

Coverage thresholds are enforced per executable package by the root quality
gate. Generated contract types are excluded because measuring generated code
would inflate the signal without protecting project behavior. Thresholds form
a ratchet: they may increase as the system grows, and reductions require an
explicit architectural reason rather than accommodation for an uncovered
change.

- pure unit tests for criteria normalization and strict filter semantics;
- recorded or handcrafted IGDB fixtures for provider mapping;
- no live IGDB dependency in the normal automated suite;
- FastAPI endpoint integration tests;
- frontend component tests for filter and result states;
- Playwright for search, URL restoration, pagination, locale switch, upstream
  error, zero-result behavior, canonical game detail, metadata, sitemap, and
  accessibility journeys against a fixture catalog injected at the API
  composition root;
- automated accessibility checks plus manual keyboard and screen-reader smoke
  testing on critical flows.
