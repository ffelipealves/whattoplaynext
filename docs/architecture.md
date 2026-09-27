# Architecture

Status: accepted MVP architecture baseline; implementation complete through
Milestone 3, with the Milestone 4 infrastructure and operations marked below
Last updated: 2026-09-27 (Milestone 4.1 operational decisions)

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
- asynchronous Redis-compatible client (`redis` asyncio, since M4.2);
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

Redis is a disposable optimization, not a source of truth. M4.2 added the
`CacheStore` port, its Redis adapter, and the typed `Cache`; M4.3 added the
`CachingCatalog` described below. The popular-game endpoint sets a 24-hour
HTTP cache policy and the Next.js sitemap revalidates daily. The policy below
was decided in M4.1 on 2026-09-27; M4.2–M4.4 implement it.

### 7.1 Where the cache sits

The cache wraps the `Catalog` port: a caching catalog implements the same
interface and delegates to the IGDB catalog on a miss. Routes, domain models,
and the web application do not see cache types. Every value is configuration
with the defaults below, not hard-coded product behavior.

| Resource                       | Fresh TTL | Stale-if-error window after expiry |
| ------------------------------ | --------: | ---------------------------------: |
| Filter metadata                |    7 days |                            30 days |
| Game detail                    |  24 hours |                             7 days |
| Search page                    |    1 hour |                           24 hours |
| Autocomplete suggestions       |    1 hour |                               none |
| Popular-game sitemap selection |  24 hours |                             7 days |
| `GAME_NOT_FOUND` (negative)    |    10 min |                               none |

An empty search or autocomplete result is a successful response and uses its
resource's ordinary TTL. Provider failures, validation failures, and rate-limit
rejections are never cached. Autocomplete has no stale window because a failed
suggestion request already degrades to a plain name field.

### 7.2 Keys and entries

Keys have the shape
`wtpn:{environment}:cache:{apiVersion}:{resource}:s{schemaVersion}:{digest}`,
for example `wtpn:production:cache:v1:search:s1:3f9a…`.

- `digest` is the SHA-256 of a canonical JSON serialization of the validated
  criteria: defaults materialized (an omitted sort equals the explicit
  default), repeated values deduplicated and sorted, keys sorted, no
  whitespace. Raw query text therefore never appears in a key, and key length
  is bounded.
- `schemaVersion` is an integer per resource, bumped whenever the response
  shape or the eligibility rules change, so old entries are simply never read
  again.
- No locale dimension: every API response is locale-independent (stable IDs,
  English source labels, and untranslated provider text). A future localized
  field would add the locale to the digest input.

An entry is a JSON envelope
`{"v": 1, "storedAt": …, "freshUntil": …, "payload": …}`. The Redis TTL is the
fresh TTL plus the stale window; freshness is decided by the application with
an injectable clock. An entry that fails to decode is deleted, logged, and
treated as a miss.

### 7.3 Lookup order and coalescing

1. Fresh entry: return it (`servedFrom: "cache"`).
2. Otherwise ask the provider, subject to rate limiting (§8.1) and the circuit
   (§8.2); store and return the result.
3. If the provider fails, is short-circuited, or is over its global budget and
   an expired entry is still inside its stale window: return it with
   `dataMayBeStale: true`.
4. Otherwise return the existing classified error. A failure never becomes an
   empty result.

Identical in-flight misses in one process share a single provider call and
its outcome, including a failure. There is no distributed lock: the MVP runs
one API instance (see [technical debt 17](technical-debt.md#17-resilience-state-is-process-local)).

### 7.4 Redis failures

Redis operations use a 200 ms timeout and a bounded pool of ten connections.
After a Redis error the cache is bypassed for 30 seconds instead of paying the
timeout on every request; requests then go to the provider under the normal
rate limits and circuit. A process without Redis configured runs with the
cache disabled. Upstash Redis Free is 256 MB, so the Redis instance runs with
an `allkeys-lru` eviction policy; M4.3 measures entry sizes before compression
is considered.

## 8. Resilience

The IGDB transport already has bounded timeouts, one retry for eligible
transient failures, jitter, and bounded `Retry-After` handling. The web
application renders classified provider failures and retry timing. The
following policies were decided in M4.1 on 2026-09-27; M4.5 and M4.6 implement
them. Until then, the provider's own 429 can surface as `RATE_LIMITED`.

### 8.1 Rate limiting

Every API call comes from the Next.js server, including autocomplete through
its route handler, so the API's socket peer is the web server rather than the
visitor. Visitor identity is therefore forwarded:

- the web server sends the visitor address in `X-WTPN-Client-Address` together
  with a shared secret in `X-WTPN-Edge-Token`, on every API call it makes for
  a visitor. It reads the first `X-Forwarded-For` entry, so the proxy in front
  of it must overwrite that header: Vercel does, Caddy does for untrusted
  clients, and Nginx needs `proxy_set_header X-Forwarded-For $remote_addr`;
- the API trusts the forwarded address only when the token matches in
  constant time; otherwise it uses the socket peer, or the
  `X-Forwarded-For` entry selected by a configured trusted-hop count when the
  API itself sits behind a platform proxy;
- IPv4 addresses are used whole and IPv6 addresses are reduced to their `/64`
  prefix, then replaced by a keyed HMAC-SHA256 digest. Only the digest reaches
  Redis, with a TTL equal to the window. Addresses are never logged.

Budgets use a sliding-window counter per identity:

| Budget                   | Default                   | Counted requests                                         |
| ------------------------ | ------------------------- | -------------------------------------------------------- |
| Public ceiling           | 60 per minute per client  | every catalog route                                      |
| Provider-reaching budget | 20 per minute per client  | cache misses that would call the provider                |
| Global provider limiter  | 4 per second, 8 in flight | every IGDB request from the process (IGDB's own ceiling) |

Cache hits and coalesced followers do not consume the provider-reaching
budget. Health endpoints are exempt. A client over the public ceiling receives
`429 RATE_LIMITED` with `Retry-After` and `retryAfterSeconds`; a client over
the provider-reaching budget receives stale data when an entry is still in its
window, and the same `429` otherwise (refined in M4.5). A
request that cannot obtain a global provider slot within its remaining
operation deadline falls back to stale data, then to
`503 UPSTREAM_UNAVAILABLE` with a short retry delay, because the visitor did
not cause that pressure. When Redis is unavailable, per-client limits fall back
to an in-process limiter with the same budgets.

Success responses carry no `RateLimit-*` headers: the only caller is the web
server, which has no use for them.

### 8.2 Circuit breaker

Implemented in M4.6. One process-local circuit protects IGDB access, including
token requests.

- Counted failures are the outcome of a transport operation after its own
  retry: timeout, connection failure or `5xx`, and `429`. Validation, not
  found, invalid provider requests, invalid provider responses, and rejected
  authentication do not count; the last two are logged at error level instead,
  because opening the circuit cannot fix them.
- Five consecutive counted failures open the circuit for 30 seconds.
- After that, the next provider call is a single half-open probe while other
  callers keep the open behavior. Success closes the circuit and resets the
  count; failure reopens it with the open duration doubled, capped at five
  minutes.
- While open, requests are served from fresh cache, then stale cache, and
  otherwise receive `503 UPSTREAM_UNAVAILABLE` with `retryAfterSeconds` equal
  to the remaining open time, rounded up.

### 8.3 Degradation states

| State         | Visitor sees                                                     | Operator sees                     |
| ------------- | ---------------------------------------------------------------- | --------------------------------- |
| Fresh         | normal page                                                      | cache hit or provider success     |
| Stale         | results plus a localized notice with the time the data was saved | `stale` cache outcome, open cause |
| Unavailable   | existing recoverable failure state with retry timing             | classified error, circuit state   |
| Rate-limited  | existing rate-limit state                                        | per-budget rejection              |
| Cache offline | normal page, possibly slower                                     | readiness `degraded`              |

### 8.4 Liveness and readiness

- `GET /api/v1/health` stays the liveness check: no I/O, always `200` while the
  process serves requests. Platform health checks and restarts use only this
  endpoint, so an IGDB outage never restarts the API.
- `GET /api/v1/health/ready` reports dependency state for monitoring. It sends
  at most one Redis `PING` with the 200 ms timeout, reads the in-memory circuit
  state, and never calls IGDB. It exposes no host, port, or credential.

## 8a. Released-game eligibility

Decided by the owner on 2026-09-27: a game is released when its IGDB
`first_release_date` is present and no later than the end of the current UTC
day. The clause joins the existing `game_type` allow-list in every games query
and count, in autocomplete and the popular selection, and in the detail check,
which answers `GAME_NOT_FOUND` for an unreleased game. A game whose first
release happened on a platform outside the MVP scope counts as released; that
imprecision was accepted in exchange for a rule that needs no release-date
join. M4.3 implemented it before the first cache entry is written:
`IgdbCatalog` takes an injectable day so tests pin the cutoff.

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

Milestone 4 adds two secrets, both server-only and both using the redacting
type: the edge token shared by the web server and the API (§8.1), and the key
of the HMAC that replaces visitor addresses. The web server's copy of the edge
token must never use the `NEXT_PUBLIC_` prefix. Because the browser never calls
the API, the API emits no CORS allowance at all, and its public routes accept
only `GET`.

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

Decided in M4.1 for M4.7:

- the web server creates one request ID per incoming page or route-handler
  request and sends it as `X-Request-ID` on every API call it makes for that
  request; the API carries it into cache and provider log events;
- the API writes one JSON log line per request with the request ID, method,
  route template (never the raw path or query string), status, duration, cache
  outcome, provider call count and outcome, rate-limit decision, and circuit
  state, plus separate events for circuit transitions and cache decode
  failures;
- logs never contain query values, visitor addresses or their digests, request
  headers other than the request ID, provider payloads, or secrets, and
  redaction tests enforce this;
- the metrics required by NFR-026 are derived from those structured events
  first. The log and monitoring destinations, and their 14-day retention, are
  chosen together with the deployment target, which is still open.

## 11a. Analytics

Decided in M4.1 for M4.9. Umami Cloud receives cookieless events from the
browser through one typed web module; nothing else calls Umami. Automatic
tracking is off: page views are sent manually with the route template as the
URL (for example `/pt-br/games/[game]`), no query string, and the referrer
reduced to its host. Do Not Track is honored, and analytics is disabled
whenever its website ID is not configured, including in tests.

| Event                   | Allowed properties                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| page view               | locale, route template                                                                                      |
| `search-submitted`      | locale, filter categories used, sort, direction, result-count bucket, response-time bucket, refinement flag |
| `sort-changed`          | locale, sort, direction                                                                                     |
| `game-detail-viewed`    | locale, entry (`search-result`, `autocomplete`, `direct`), time-since-search bucket                         |
| `external-link-clicked` | locale, link category from the external-link allow-list                                                     |
| `failure-shown`         | locale, surface (`search`, `game`, `filters`), stable error code                                            |
| `stale-data-shown`      | locale, surface                                                                                             |
| `usefulness-answered`   | locale, answer (`yes`, `not-yet`) — only once the FR-047 prompt exists                                      |

Buckets are fixed ranges, not raw values: result count `0`, `1–24`, `25–240`,
`241–2,400`, `>2,400`; response time `<0.5 s`, `0.5–2.5 s`, `2.5–10 s`,
`>10 s`; time since search `<30 s`, `30 s–2 min`, `2–10 min`, `>10 min`.
Filter categories are names such as `platform` or `duration`, never the
selected values.

Prohibited in every event and property: search text, game titles, slugs, and
IDs, full URLs and query strings, filter values, IP addresses, request IDs,
provider text, error messages, and secrets. Umami itself receives the
visitor's address to derive country and a daily session hash; that
third-party processing, and the six-month retention of NFR-023, are
public-beta privacy-review items.

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
