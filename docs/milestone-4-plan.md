# Milestone 4 Plan

Status: planned — M4.1 through M4.9 not started

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

Acceptance:

- the decisions are recorded in the architecture, API contract, and debt
  register;
- every M4 increment has a measurable outcome and a test seam;
- the release-gate decisions are labelled separately from engineering work.

### M4.2 — Redis foundation

Status: planned.

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

### M4.3 — Catalog cache and request coalescing

Status: planned.

Deliver:

- cache integration for filter metadata, search pages, game detail, and the
  autocomplete path where its policy is approved;
- the planned TTLs: filters seven days, details 24 hours, search one hour,
  negative lookups short and configurable;
- canonical serialization of criteria and schema-versioned entries;
- in-flight miss coalescing so concurrent identical requests share one
  provider call;
- hit/miss/fill metadata in the internal result path.

Acceptance:

- repeated requests hit cache without contacting the provider;
- equivalent criteria produce the same key and different criteria cannot
  collide;
- concurrent misses result in one upstream request;
- the duration and platform-release-range debt has a measured warm-path result.

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
