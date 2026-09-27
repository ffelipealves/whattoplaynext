# Milestone 4 Plan

Status: completed on 2026-09-27 — M4.1 through M4.9 accepted; see the [Milestone 4 review](milestone-4-review.md)

Prepared: 2026-09-22

## 1. Goal

Milestone 4 turns the provider-backed MVP into a service that can absorb
repeated traffic and provider degradation safely. It adds the Redis cache,
request protection, operational visibility, security hardening, and the
anonymous analytics boundary required before closed-beta traffic.

The milestone does not change the search contract or add personalization. It
should reduce the cold-query costs already measured in the
[technical debt register](technical-debt.md), preserve useful stale data when
IGDB is unavailable, and make every degradation visible to both the visitor
and the operator.

## 2. Delivery order

```text
M4.1 decisions and contracts
          │
          ▼
M4.2 Redis foundation ──► M4.3 catalog cache ──► M4.4 stale/degraded cache
          │                         │                    │
          └──────────────► M4.5 rate limiting ──► M4.6 circuit breaker

M4.7 observability ──► M4.8 security ──► M4.9 analytics and closeout
```

M4.2–M4.4 establish the cache semantics before rate limiting and circuit
breaking decide whether a request may reach the provider. M4.7 can begin after
M4.2 exposes cache outcomes, but its final dashboards and alerts depend on the
states from M4.5 and M4.6.

## 3. Cross-cutting delivery rules

- Redis is an optimization, never the source of truth; every cache failure has
  a bounded provider or stale-data path.
- Cache keys use canonical validated criteria, API version, response schema
  version, and only the locale-sensitive dimensions that affect the response.
- Provider and client errors retain the existing stable error codes and
  correlation IDs; resilience must not turn failures into empty results.
- Every new operational state has a fixture-backed unit or integration test,
  plus a browser scenario when it changes visible web behavior.
- Secrets, full IP addresses, provider payloads, and arbitrary query text are
  never written to logs or analytics.
- `pnpm quality` remains the required gate. Cache and resilience tests must
  run without Redis credentials or live IGDB access; a small dedicated Redis
  integration profile may be opt-in.
- Performance measurements compare cold, warm, stale, and provider-failure
  paths using a repeatable fixture and a documented live smoke profile.

## 4. Delivery increments

### M4.1 — Decisions and operational contracts

Status: planned.

Decide and document:

- cache key shape, TTLs, negative caching, stale-if-error window, and stampede
  protection;
- public and route-specific rate-limit budgets, identity source, and response
  headers;
- circuit thresholds, half-open behavior, and provider-degradation states;
- readiness versus liveness semantics;
- analytics events, allowed properties, retention, and prohibited values;
- whether “released game” means a past global date, a platform date, or another
  owner-approved policy.

Status: completed on 2026-09-27.

Acceptance:

- the decisions are recorded in the architecture, API contract, and debt
  register;
- every M4 increment has a measurable outcome and a test seam;
- the release-gate decisions are labelled separately from engineering work.

Outcome: the decisions are recorded in
[architecture §7, §8, §8a, §11, and §11a](architecture.md#7-caching), the
[API contract](api-contract.md) (readiness, rate limiting, and freshness
metadata), and the [debt register](technical-debt.md) (1b, 2, 2b, 4, 9, and
new entry 17). Section 7 below lists them with their labels. Reading the web
application while deciding changed one premise of the plan: the browser never
calls the API, so the API sees the web server's address and cannot rate-limit
visitors by its socket peer. The owner chose a forwarded, token-authenticated
visitor address.

Each remaining increment now has one measurable outcome and the seam its tests
use. No test needs Redis or IGDB credentials unless marked opt-in.

| Increment | Measurable outcome                                                                                                  | Test seam                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| M4.2      | With Redis stopped, every catalog route still answers from the provider, and liveness makes zero dependency calls.  | Application-owned cache interface with an in-memory fake and a failing fake; opt-in real-Redis profile. |
| M4.3      | A repeated identical request makes zero provider calls; 20 concurrent identical misses make one; warm p95 < 500 ms. | Caching catalog around a counting fake `Catalog`, injectable clock, canonical-key unit tests.           |
| M4.4      | With the provider failing, an expired in-window entry is served as stale; after the window, the classified error.   | Failing fake catalog plus clock advance; web component and Playwright scenario for the stale notice.    |
| M4.5      | The 61st request in a minute and the 21st provider-reaching miss are rejected with `Retry-After`; hits are not.     | Rate-limit interface with an in-memory store and injectable clock; header-forging API tests.            |
| M4.6      | After five consecutive failures, zero provider calls until the probe; one successful probe closes the circuit.      | Circuit unit tests with an injectable clock; fake transport that fails on demand.                       |
| M4.7      | One request ID appears in web, API, cache, and provider events; redaction tests find no forbidden value.            | Captured log records in API tests; web test that asserts the outgoing `X-Request-ID`.                   |
| M4.8      | Header tests pass on both surfaces; cross-origin and non-`GET` API requests are rejected.                           | API integration tests and a production-build Playwright header check.                                   |
| M4.9      | Every captured analytics payload in the critical journeys contains only allow-listed events and properties.         | Typed analytics module with a capturing sink injected in component and Playwright tests.                |

### M4.2 — Redis foundation

Status: completed on 2026-09-27.

Deliver:

- an async Redis adapter behind a small application-owned interface;
- namespaced, versioned keys and typed serialization;
- connection timeouts, bounded pool settings, and startup/readiness behavior;
- cache health information without exposing connection details;
- deterministic fakes for unit and API integration tests.

Acceptance:

- cache reads, writes, expiry, serialization failure, and Redis unavailability
  are tested;
- the API remains usable when Redis is absent;
- no provider call is made synchronously by the liveness endpoint.

Outcome: `CacheStore` is the application-owned port, `RedisCacheStore` its
Redis adapter (`redis` 8.1 asyncio, ten pooled connections, one 200 ms deadline
per operation, client retries disabled), and `Cache` the typed facade that
writes `{v, storedAt, freshUntil, payload}` envelopes with a Redis TTL of the
fresh lifetime plus the stale window. `cache_key()` implements the M4.1 key
shape. A store failure becomes a miss or a skipped write and starts a
30-second bypass; an undecodable entry is deleted and logged as
`cache.decode_failed` without its contents; errors never carry Redis hosts or
ports. `Cache.health()` reports `up`, `down`, or `disabled` for the M4.7
readiness endpoint. A blank `WTPN_REDIS_URL` disables the cache, and timeout,
pool size, and bypass length are bounded settings.

The composition root builds the cache from settings only alongside the
production catalog; an injected catalog receives only an injected store, so
tests and the browser fixture server cannot reach a developer's Redis. Tests
cover the fakes-based behavior, a refused connection, and a server that
accepts connections but never answers (it fails within the deadline). An
opt-in test runs against a real Redis when `WTPN_TEST_REDIS_URL` is set. It
was first run on 2026-09-27, after the owner enabled Docker Desktop in WSL:
all eight store tests passed against the Compose `redis:8.2.9-alpine`,
including write, read, TTL expiry, and delete. The API suite passed 231 tests with one opt-in skip
at 94% coverage (100% for the new modules), with ruff and strict mypy clean and
the committed OpenAPI contract unchanged. No catalog route uses the cache yet.

### M4.3 — Catalog cache and request coalescing

Status: completed on 2026-09-27.

Deliver:

- cache integration for filter metadata, search pages, game detail, and the
  autocomplete path where its policy is approved;
- the planned TTLs: filters seven days, details 24 hours, search one hour,
  negative lookups short and configurable;
- canonical serialization of criteria and schema-versioned entries;
- in-flight miss coalescing so concurrent identical requests share one
  provider call;
- hit/miss/fill metadata in the internal result path;
- the released-game rule from [architecture §8a](architecture.md#8a-released-game-eligibility),
  landed first so no entry is cached under the old eligibility.

Acceptance:

- repeated requests hit cache without contacting the provider;
- equivalent criteria produce the same key and different criteria cannot
  collide;
- concurrent misses result in one upstream request;
- the duration and platform-release-range debt has a measured warm-path result;
- unreleased and undated games are excluded from detail and every discovery
  path, and the changed live totals are recorded.

Outcome: the released-game rule landed first in its own commit. `IgdbCatalog`
takes an injectable day, every games query and count carries
`first_release_date != null & first_release_date <= <end of today>`, and the
detail check applies the same rule to the record it fetches by ID.

`CachingCatalog` (`cache/catalog.py`) implements the `Catalog` port around the
provider catalog. It caches filters, search pages, autocomplete, the popular
selection, and game detail with the M4.1 lifetimes, plus a ten-minute
`GAME_NOT_FOUND` marker. `CachePolicy` holds every lifetime and is configurable
through `WTPN_CACHE_TTL__*` variables. Entries are written with their stale
window already included, so M4.4 only has to read them. Identical in-flight
misses share one shielded provider call: a caller that disconnects does not
cancel it, and a failure reaches every waiting caller without being cached or
retried. `record_cache_outcomes()` exposes hit, miss, and coalesced outcomes to
the request for M4.7. Responses now carry `servedFrom: "cache"` on a hit and
`dataAsOf`, the time the provider produced the data; the contract and generated
client were regenerated.

The composition root wraps the production catalog. An injected catalog is
wrapped only when a cache store is injected too, so existing HTTP tests and the
browser fixture server keep uncached behavior. Testing the HTTP composition
caught one defect before commit: a hit reported the envelope's storage time
instead of the provider time the first response had shown.

Verification: 261 API tests passed with one opt-in skip at 94% coverage (98% for
`cache/catalog.py`), including a hit without a provider call, 20 concurrent
misses making one call, key equivalence and separation, every lifetime, the
negative marker, and an unavailable Redis. The contract check, formatting,
lint, type checks, web and contracts unit coverage (237 web tests), and the
production build passed. After the owner installed Chromium's system
libraries in WSL, `pnpm e2e` passed all 27 Playwright journeys locally.

Live IGDB verification ran on 2026-09-27 with owner-configured credentials.
`pnpm smoke:api` passed all four capabilities. The eligible total fell from
316,258 (M3.1) to 233,997 once unreleased and undated games were excluded.
Cold versus warm timings went through `CachingCatalog` with an in-memory store,
because no Redis was available, so the warm figures exclude the Redis round
trip; the warm p95 is over 20 repeated requests:

| Query                                           | Total   | Cold   | Warm p95 |
| ----------------------------------------------- | ------- | ------ | -------- |
| `platform=nintendo-switch&genre=indie` + 2–10 h | 707     | 9.5 s  | 0.99 ms  |
| `platform=pc` + all of 2020                     | 10,536  | 67.1 s | 1.08 ms  |
| unfiltered, sorted by rating                    | 233,997 | 2.2 s  | 0.90 ms  |

A follow-up through the real local Redis on the unfiltered rating shape
measured 1.76 s cold and 1.00 ms p50 / 1.96 ms p95 warm over 100 requests, so
the Redis round trip adds about a millisecond. The warm path is far inside
NFR-001's 500 ms p95; the cold shapes are unchanged, as expected.

### M4.4 — Stale-if-error and provider degradation

Status: completed on 2026-09-27.

Deliver:

- stale entries with an explicit bounded stale window;
- stale responses marked in metadata and logs;
- fallback ordering: fresh cache, provider, stale cache when the provider fails,
  then the existing classified error;
- localized web states explaining stale or unavailable data without claiming
  freshness;
- tests for cache unavailable, provider unavailable, invalid provider data,
  timeout, and stale expiry.

Acceptance:

- cache hit, miss, stale, expired, and unavailable paths are all covered;
- provider failures never become successful empty results;
- the sitemap and popular-game selection preserve their existing static-route
  fallback behavior.

Outcome: `CachingCatalog` now answers in the documented order: a fresh entry,
then the provider, then an expired entry still inside its stale window, and
otherwise the classified error. Only provider failures (`RATE_LIMITED` from
IGDB, `UPSTREAM_UNAVAILABLE`, `UPSTREAM_TIMEOUT`, and
`UPSTREAM_INVALID_RESPONSE`) may fall back. Validation, not-found, and
internal errors never do, because stale data would hide a caller mistake or a
defect. The store's TTL enforces the window, so nothing extra is tracked. A
stale answer carries `servedFrom: "cache"`, `dataMayBeStale: true`, and its
original `dataAsOf`. It is logged as `cache.stale_served` with only the
resource and error code, and recorded as a `stale` cache outcome. It is not
rewritten into the cache, so the next request asks the provider again.
Coalesced callers all receive the same fallback. Autocomplete has no stale
window and fails as before. Filter metadata, which has no `meta`, is served
stale without a marker.

The web application shows `StaleDataNotice` above search results and at the
top of the game page. It is a localized note with the save time in UTC inside
a `<time>` element, and a date-free variant when the time is unknown. The
browser fixture catalog gained a `trigger-stale-data` name; a new Playwright
journey checks the warning in both locales and that stale results are neither
an alert nor an empty result. The sitemap route is unchanged: it still falls
back to static pages when the API fails, and a stale popular selection is now
simply a successful answer.

Verification: 275 API tests passed (14 new stale tests), and all 28 Playwright
journeys passed, as did the build, lint, type checks, formatting, and the
contract check. The web unit suite passed apart from load-sensitive timeouts
that also fail without this change; see
[technical debt 18](technical-debt.md#18-the-web-unit-suite-times-out-under-machine-load).

### M4.5 — Public and upstream-aware rate limiting

Status: completed on 2026-09-27.

Deliver:

- a configurable per-client public ceiling, initially 60 requests per minute;
- lower budgets for uncached routes that consume IGDB quota;
- a bounded identity strategy that does not log or persist full IP addresses;
- `429`, `Retry-After`, and `retryAfterSeconds` behavior through the existing
  error envelope;
- tests for allowed, rejected, reset, and route-specific requests.

Acceptance:

- a client cannot exhaust the provider budget through repeated uncached calls;
- cache hits do not consume the upstream budget unnecessarily;
- rate-limit state is visible and localized in the web application.

Outcome: delivered in three API commits and one web commit.

- **Identity** (`ratelimit/identity.py`): a forwarded
  `X-WTPN-Client-Address` counts only with a constant-time match of
  `X-WTPN-Edge-Token`. Otherwise the socket peer, or the `X-Forwarded-For`
  entry chosen by `WTPN_TRUSTED_PROXY_HOPS`, is used. IPv6 is reduced to its
  `/64`, and IPv4-mapped IPv6 to its IPv4 address. Every address is replaced
  by a 32-character HMAC-SHA256 digest, keyed by `WTPN_IDENTITY_HMAC_KEY` or
  a random per-process key.
- **Budgets** (`ratelimit/limiter.py`): a sliding-window counter built from two
  fixed windows. Redis does `INCR`, `EXPIRE`, and `GET` in one pipeline, and an
  in-process store takes over while Redis is down. Rejected requests count
  too, so a hammering client stays limited. `Retry-After` is the computed
  wait until one more request fits.
- **Public ceiling**: a router dependency on the filters and games routes
  applies 60 per minute; health is exempt. A rejection returns the existing
  `429 RATE_LIMITED` envelope with `Retry-After` and `retryAfterSeconds`.
- **Provider-reaching budget**: `CachingCatalog` charges 20 per minute only to
  a caller that would start a provider call. Hits and coalesced followers pay
  nothing. One refinement to the M4.1 decision: a caller over this budget gets
  stale data when an entry is still in its window, and `429` only otherwise.
  The provider stays protected either way.
- **Global provider ceiling** (`adapters/igdb/throttle.py`): every IGDB
  attempt, retries included, takes a turn from a process-wide throttle. Turns
  start 0.25 s apart, with at most eight open, and settings cannot exceed
  IGDB's four per second and eight open. A turn that cannot start within the
  remaining operation deadline is refused as `UNAVAILABLE`, which falls back
  to stale data or `503`, never `429`.
- **Web**: `getVisitorApiClient()` forwards the first `X-Forwarded-For` entry
  with `WTPN_API_EDGE_TOKEN` on every call made for a visitor (search,
  filters, detail, and autocomplete through its route handler). It never
  trusts `X-Real-IP`. The sitemap keeps the header-free client because it
  renders outside any request. The existing localized rate-limit states
  cover the visible side.

Verification: 324 API tests passed with the opt-in Redis test skipped; the
Redis store tests also passed against the local Redis 8.2. The web suite
passed 249 tests, all 28 Playwright journeys passed, and the full
`pnpm quality` gate was green. A live check ran against the production
composition with local Redis and IGDB credentials. A direct caller got 60
responses of 200, then 429 with `Retry-After: 50`. Two token-forwarded
visitors each got 200 from their own budgets. A wrong token was charged to
the caller's exhausted budget and got 429. Redis held only
`wtpn:ratelimit:v1:{budget}:{digest}:{window}` keys, with no address in any
key.

### M4.6 — Circuit breaker and request-storm protection

Status: completed on 2026-09-27.

Deliver:

- closed, open, and half-open circuit states around provider access;
- failure classification and thresholds that exclude validation and not-found
  responses;
- bounded retry plus coalescing interaction rules;
- recovery after a successful probe;
- a readiness/degradation signal suitable for monitoring.

Acceptance:

- repeated upstream failures open the circuit and stop new provider calls;
- concurrent callers receive a stable recoverable state rather than creating a
  request storm;
- the circuit closes after a successful half-open probe;
- cache and stale-if-error behavior remains correct while the circuit is open.

Outcome: `ProviderCircuit` and `CircuitBreakingTransport`
(`adapters/igdb/circuit.py`) wrap every IGDB operation, including the
transport's own retry and the token request. Five consecutive timeout,
unavailable, or `429` outcomes open the circuit for 30 seconds. While it is
open, calls fail at once as `UNAVAILABLE` with the remaining open time,
rounded up, as the retry delay. After that, exactly one caller probes while
the others are told to retry in a second. Success closes the circuit and
resets the open period. A counted failure reopens it for twice as long, capped
at five minutes. A cancelled probe hands the turn to the next caller.

Invalid requests, invalid responses, and rejected authentication never open
the circuit; they are logged at error level as `provider.failure_not_counted`.
A probe answered that way closes the circuit, because IGDB did answer. Calls
admitted before the circuit opened that fail late do not extend it.
Transitions are logged as `circuit.opened`, `circuit.half_open`, and
`circuit.closed`. The circuit is exposed on `app.state.provider_circuit` for
the M4.7 readiness endpoint, and it is `None` without a configured provider.
The thresholds are settings (`WTPN_CIRCUIT_*`).

Two adjacent defects were fixed on the way:

- `fix(api)` made the transport classify `TwitchTokenError`. A Twitch outage
  had escaped as an unclassified exception, which the HTTP boundary could only
  report as `500 INTERNAL_ERROR`, bypassing the stale fallback. A regression
  test covers all four token failure reasons.
- The catalog now passes a known retry delay through for every provider
  failure, not only `429`, so the open circuit's remaining time reaches the
  visitor as `retryAfterSeconds`. The translation test that pinned the old
  rule was updated deliberately.

An integration test drives `CachingCatalog` over `IgdbCatalog` through the
circuit. With the circuit open, a fresh entry is served fresh, an expired one
stale, and a miss gets `503 UPSTREAM_UNAVAILABLE` with a 30-second retry,
without a single further IGDB call. The API passed 349 tests with the opt-in
Redis test skipped (98% coverage for the circuit module), and the full
`pnpm quality` gate, including all 28 Playwright journeys, was green.

### M4.7 — Correlation, logs, health, and metrics

Status: completed on 2026-09-27.

Deliver:

- structured JSON logs for route, status, duration, request ID, cache outcome,
  provider outcome, rate-limit state, and circuit state;
- end-to-end request ID propagation through web, API, cache, and provider;
- liveness and readiness endpoints with safe dependency status;
- metrics for latency, errors, cache hit/miss/stale, provider quota pressure,
  rate limits, and circuit transitions;
- redaction tests for secrets, full IP addresses, provider payloads, and query
  values.

Acceptance:

- an operator can follow one request without exposing sensitive values;
- logs contain no secret or full IP address;
- health checks distinguish process failure from dependency degradation;
- representative performance measurements are reproducible.

Outcome:

- **Logs** (`core/structured_logging.py`): every log is one JSON object
  carrying the time, level, logger, event, request ID, and only allow-listed
  fields. Any other `extra` is dropped, so a call site cannot leak a value.
  Exceptions keep their type and a `file:line:function` stack, never their
  message.
- **Third-party loggers**: `configure_logging()` routes Uvicorn's own
  messages through the same formatter. It switches off Uvicorn's access log,
  which printed the client address and the full URL with its query string,
  and holds HTTPX at `WARNING`.
- **Request telemetry** (`core/telemetry.py`): a per-request context
  collects every provider attempt (`ok`, `server-error`, `rate-limited`,
  `timeout`, `network-error`, `token-*`, `throttled`, `circuit-open`), the
  time spent waiting on the provider throttle, and the rate-limit decision.
- **`http.request`**: one line per request, 500s included, with the method,
  route template, status, duration, cache outcomes, provider attempts, wait,
  rate-limit decision, and circuit state. The template is the API prefix
  plus the route as declared, never the raw path or query string.
  Unexpected errors, which were previously silent, now also log
  `http.unhandled_error`.
- **Request ID**: the web sends one per page render (React `cache`) as
  `X-Request-ID` on every API call, so a visitor-facing error reference
  matches the API's log line.
- **Readiness**: `GET /api/v1/health/ready` reports `cache` and `provider`.
  It returns `200` when ready or degraded and `503` without a configured
  provider, is never rate-limited, and never calls IGDB.
- **Metrics**: derived from the `http.request` fields and the `circuit.*`,
  `cache.stale_served`, and `ratelimit.store_unavailable` events, as decided
  in M4.1. The metrics destination remains a deployment release gate.
- **Measurements**: `pnpm measure:api` reproduces the cold and warm profile
  against live IGDB, through memory or with `--redis` through the configured
  Redis, deleting the keys it wrote.

Verification: redaction tests send a distinctive search phrase, a forwarded
address, a forged `X-Forwarded-For`, and the edge token, and find none of them
(nor `127.0.0.1` or a `?`) anywhere in the captured log output. The API passed
363 tests, the web 250, and all 28 Playwright journeys, and `pnpm quality` was
green.

A live run of the served app produced only JSON lines, with no access log. It
carried the web's `live-probe-1` request ID, `cache: ["miss"]`,
`providerAttempts: ["ok"]`, `rateLimit: "allowed"`, `circuit: "closed"`, and
the template `/api/v1/games`. It contained no search text, visitor address,
or token; the only `127.0.0.1` was Uvicorn's own bind address.
`pnpm measure:api --redis` then measured, through the real Redis:

| Query                            | Cold    | Warm p50 | Warm p95 |
| -------------------------------- | ------- | -------- | -------- |
| unfiltered, sorted by rating     | 1.74 s  | 0.91 ms  | 1.18 ms  |
| Switch + indie + 2–10 h (debt 2) | 10.81 s | 1.19 ms  | 1.45 ms  |
| PC + all of 2020 (debt 2b)       | 67.68 s | 1.01 ms  | 1.37 ms  |

### M4.8 — Security boundary hardening

Status: completed on 2026-09-27.

Deliver:

- security headers appropriate to the deployed web and API surfaces;
- explicit CORS policy for the intended origins;
- validation and payload-size review at every public route;
- secret-loading and error-redaction review;
- dependency and generated-contract review for accidental credential or
  provider-data exposure.

Acceptance:

- browser and API security-header tests pass;
- unexpected origins and methods are rejected according to policy;
- secrets do not appear in responses, logs, bundles, or error pages;
- the security review records accepted residual risks.

Outcome: the [security review](security-review.md) records the boundary,
every verified control with its evidence, and eight accepted residual risks.

- **API**: a security-header middleware, with the headers also set by the
  `500` handler, which runs outside every middleware. Settings refuse debug
  mode in production, production switches off the interactive documentation,
  and each repeated filter is capped at 50 values.
- **Policy**: CORS and method rejection already held and are now tested.
- **Web**: `security-headers.ts` builds a CSP plus `nosniff`, `DENY`,
  `Referrer-Policy`, `Cross-Origin-Opener-Policy`, and `Permissions-Policy`,
  with HSTS only for an HTTPS origin. `X-Powered-By` is switched off.
- **Browser checks**: a new Playwright spec checks the headers and fails on
  any CSP violation across five pages. Its ability to fail was demonstrated.
- **Secrets**: a sentinel-token build found the edge token nowhere in the
  build output.
- **Dependencies**: `pnpm audit` found `js-yaml` 4.3.1 in a development-only
  path, fixed with a workspace override; `pip-audit` was clean.

Verification: the API passed 387 tests with the opt-in Redis test skipped, the
web 255, and the Playwright suite 34 journeys; `pnpm quality` was green.

### M4.9 — Analytics and milestone closeout

Status: completed on 2026-09-27.

Deliver:

- Umami integration behind one server/client boundary;
- an explicit event and property allow-list for search, filter application,
  game-page engagement, and provider-degradation states;
- tests proving prohibited values are absent, including full URLs, queries,
  identifiers, IPs, secrets, and provider text where prohibited;
- a M4 review mirroring the prior milestone reviews;
- technical-debt and release-gate review.

Acceptance:

- analytics inspection confirms only approved events and properties are sent;
- all M4 exit criteria have evidence;
- `pnpm quality` passes and the browser matrix remains green;
- performance targets pass for cold, warm, stale, and degraded profiles;
- the remaining debt is explicitly handed to closed beta, public beta, or a
  later engineering milestone.

Outcome:

- **Integration**: `features/analytics/` is the single boundary.
  `events.ts` holds the typed allow-list, the buckets, the route templates,
  and a run-time `sanitizeEvent` that drops unknown events, keys, and values.
  `track.ts` is the only code that calls `window.umami`: it holds early calls
  in a bounded queue until the script loads, and it sends page views with the
  route template, an empty title, and the referrer's host on the first view
  only. Umami would otherwise send the full URL and a game page's title.
- **Where events come from**: small client components emit search,
  sort-change, failure, and stale events from the search page, and
  detail-view, external-link, failure, and stale events from the game page.
- **Configuration**: analytics is off unless `NEXT_PUBLIC_UMAMI_WEBSITE_ID`
  is set, and the CSP gains only the configured script and collection
  origins.
- **Browser inspection**: the browser suite runs with analytics on against a
  recording stub the fixture API serves. `analytics.spec.ts` checks the
  payloads themselves.

Acceptance results, detailed in the [Milestone 4 review](milestone-4-review.md):

- analytics inspection passes;
- every exit criterion has evidence;
- `pnpm quality` passes;
- warm and degraded profiles meet their targets, but the two debt shapes do
  not meet the uncached target;
- the remaining debt is handed over;
- the browser matrix passed 185/185 once WebKit's system libraries were
  installed.

## 5. Scope guardrails

M4 does not add accounts, personalization, recommendations, price or regional
availability data, catalog replication, an administration panel, monetization,
or a permanent staging environment. It does not resolve the product-name,
domain, IGDB partnership, attribution approval, or legal-review owner actions;
those remain release gates in [External prerequisites](external-prerequisites.md).

The retail-browser requirement remains a closed-beta gate. The coverage-floor,
mobile-search INP, stale local server, and remaining E2E gaps are engineering
follow-ups to address when they improve the M4 exit evidence, not reasons to
silently expand the product scope.

## 6. Handoff from Milestone 3

M3 provides the stable generated contract, provider-neutral catalog seam,
classified failures, correlation IDs, daily sitemap cache policy, fixture
composition root, and browser matrix. M4 should preserve those seams rather
than introducing cache or resilience types into the web feature components.

The first implementation task is M4.1. No Redis credentials, provider
credentials, or production deployment are required to begin the contract and
fake-based cache work.

## 7. M4.1 decisions

Labels: **engineering** decisions can change in a later increment with a
documentation update; **owner** decisions change product behavior and were
made by the owner; **release gate** items must be closed before the named
beta and are not engineering work of this milestone.

1. **Cache policy** — engineering. TTLs, stale windows, key shape, entry
   envelope, and coalescing as in [architecture §7](architecture.md#7-caching).
   Autocomplete is cached without a stale window.
2. **Released-game rule** — owner, accepted on 2026-09-27. A past or same-day
   global `first_release_date`, rather than a platform-specific date. Lands in
   M4.3.
3. **Rate-limit identity** — owner, accepted on 2026-09-27. The web server
   forwards the visitor address with a shared edge token; the API uses a keyed
   digest of it and ignores forwarded addresses without the token.
4. **Budgets** — engineering. 60 requests and 20 provider-reaching misses per
   client per minute, plus IGDB's four per second and eight in flight per
   process ([architecture §8.1](architecture.md#81-rate-limiting)).
5. **Circuit breaker** — engineering. Five consecutive counted failures, a
   30-second open period doubling to five minutes, and a single half-open
   probe ([architecture §8.2](architecture.md#82-circuit-breaker)).
6. **Liveness and readiness** — engineering. Liveness stays I/O-free; readiness
   reports cache and circuit state and returns `503` only when the provider is
   not configured.
7. **Analytics allow-list** — engineering, within FR-049 and FR-050
   ([architecture §11a](architecture.md#11a-analytics)).
8. **Log and monitoring destinations** — release gate for closed beta, open.
   They depend on the deployment target, which the owner postponed on
   2026-09-27; M4.7 emits structured events that any destination can ingest.
9. **Secrets provisioning** — release gate for closed beta. The edge token and
   HMAC key must exist in every deployed environment and must differ between
   preview and production.
10. **Privacy review** — release gate for public beta. The Privacy page must
    name Umami, its six-month retention, and the digest-only handling of
    visitor addresses in rate limiting.
