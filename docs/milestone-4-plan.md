# Milestone 4 Plan

Status: in progress — M4.1 and M4.2 accepted on 2026-09-27; M4.3 implemented with its live measurements pending; M4.4 through M4.9 not started

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
opt-in test runs against a real Redis when `WTPN_TEST_REDIS_URL` is set; it
was not run for this increment because no Redis or Docker was available on
the development machine. The API suite passed 231 tests with one opt-in skip
at 94% coverage (100% for the new modules), with ruff and strict mypy clean and
the committed OpenAPI contract unchanged. No catalog route uses the cache yet.

### M4.3 — Catalog cache and request coalescing

Status: implemented on 2026-09-27; the two live-IGDB acceptance measurements
are pending.

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
production build passed. The Playwright journeys did not run on the
development machine: the Chromium shell lacks system libraries (`libnspr4`),
and installing them needs administrator rights. CI runs them.

Pending, both needing Twitch credentials against live IGDB: the warm-path
timing for the duration and platform-release-range shapes (debt 2 and 2b),
and the changed eligible totals after the released rule.

### M4.4 — Stale-if-error and provider degradation

Status: planned.

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

### M4.5 — Public and upstream-aware rate limiting

Status: planned.

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

### M4.6 — Circuit breaker and request-storm protection

Status: planned.

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

### M4.7 — Correlation, logs, health, and metrics

Status: planned.

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

### M4.8 — Security boundary hardening

Status: planned.

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

### M4.9 — Analytics and milestone closeout

Status: planned.

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
