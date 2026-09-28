# What To Play Next — API

The public HTTP application uses FastAPI and Python 3.14. It is the only
credential-bearing part of the product and exposes provider-neutral game data
under `/api/v1`, behind a response cache, per-visitor rate limits, a provider
throttle and circuit breaker, redacted JSON logs, and security headers.

## Architecture

The API follows a selective hexagonal architecture:

- `http` contains inbound FastAPI adapters;
- `core` contains application composition and typed configuration;
- domain modules define their own interfaces at real seams;
- `adapters/igdb` contains the Twitch token lifecycle, the authenticated IGDB
  transport, its throttle, and its circuit breaker;
- `adapters/redis` implements the cache and counter stores;
- `cache` owns the response cache and `CachingCatalog`, `ratelimit` the
  visitor identity and budgets, and `core` the settings, telemetry, and
  structured logging;
- IGDB, Redis, and test fakes are adapters behind those interfaces;
- domain modules must not import FastAPI, HTTPX, Redis, or IGDB types.

The health endpoint has no outbound dependency or variable implementation, so
it does not introduce an artificial port.

## Install

```bash
pnpm run setup
```

## Run

```bash
pnpm infra:up
pnpm dev:api
```

The health endpoint is available at <http://localhost:8000/api/v1/health>.

Every response includes `X-Request-ID`. A caller-supplied identifier is
propagated when it contains 1–128 ASCII letters, digits, `.`, `_`, or `-` and
starts with a letter or digit; otherwise the API generates a UUID. Error
responses use the stable envelope documented in
[API contract](../../docs/api-contract.md#5-errors), include the same identifier
in `error.requestId`, and never expose framework or provider details.

## Environment

Copy `.env.example` to `.env`; every setting is listed there with its default.
`WTPN_REDIS_URL` points at the local Compose Redis, a blank value disables the
cache, and an unreachable Redis never blocks startup.
`WTPN_TWITCH_CLIENT_ID` and `WTPN_TWITCH_CLIENT_SECRET` are optional locally,
but they must be provided together; without them the catalog reports itself
unavailable. The Twitch secret, `WTPN_EDGE_TOKEN`, and
`WTPN_IDENTITY_HMAC_KEY` are masked in every representation of the settings.
`WTPN_ENVIRONMENT=production` refuses `WTPN_DEBUG=true`, sends HSTS, and
switches off `/docs`, `/redoc`, and `/openapi.json`.

## Twitch application token

`TwitchTokenManager.get_access_token()` is the application-facing seam for an
app access token. It acquires tokens through the official client-credentials
flow, reuses each token in memory until 60 seconds before expiry, and shares one
refresh among concurrent callers in the same process. The HTTP boundary
classifies rejected credentials, timeouts, provider unavailability, and invalid
responses without retaining provider payloads in its exceptions.

Automated tests use a controllable clock and in-memory HTTP transports. They do
not require credentials or contact Twitch. `main.build_catalog()` wires
`Settings` into this manager for production; see
[Production composition](#production-composition).

## IGDB transport

`IgdbTransport.query()` is the provider-facing seam for APICalypse requests. It
sends POST requests only from the backend with `Client-ID`, `Authorization`, and
an explicit field projection in the request body. Each attempt has a bounded
timeout and the complete operation has a separate deadline.

Timeouts, connection failures, `429`, and `5xx` responses receive at most one
retry. Transient waits use jitter; numeric `Retry-After` values are capped at
two seconds. Permanent `4xx` responses are not retried. Successful payloads must
be JSON arrays of records, while errors expose only stable categories and an
optional bounded retry delay.

Tests replace both HTTP and time-related effects, so they remain deterministic
and never contact IGDB.

The transport also exposes a narrow `count()` operation for IGDB's object-shaped
`/{endpoint}/count` response. It preserves the same authentication, retry, and
error-classification behavior without weakening `query()`'s array guarantee.

## Filter metadata

`GET /api/v1/filters` is the first complete catalog slice. Its route depends on
the small `Catalog.get_filter_metadata()` interface, so HTTP tests inject a
deterministic fake while the IGDB adapter is exercised through sanitized
fixtures. Provider numeric IDs and names are translated into application-owned
IDs and labels; unknown records are excluded in a stable order.

The endpoint always includes all duration kinds, sort options, and public query
bounds. Provider failures are translated to the stable HTTP error envelope and
cannot become an empty successful response. Without configured Twitch
credentials, the application starts safely and reports the catalog as
unavailable; see [Production composition](#production-composition).

## Game browsing

`GET /api/v1/games` exposes strict provider-neutral search. It accepts name,
repeated platform/genre/game-mode identifiers, release bounds, minimum combined
rating, duration kind and bounds, sort, direction, and page. Duration bounds are
submitted in hours from 1 through 1,000 and converted to inclusive whole-second
bounds; `normal` is the default kind. Inputs are normalized before reaching the
catalog: names are trimmed, repeated values are deduplicated, public IDs are
allow-listed, ranges are checked, unknown parameters are rejected, and the page
size remains fixed at 24. Values within one category use OR; categories use AND.

Rating, release-date, and title sorts translate directly to explicit IGDB game
fields. Popularity without filters keeps the efficient M1.5 IGDB Visits path.
For filtered popularity, the adapter obtains the exact matching game IDs in
500-item batches, fetches their Visits values, applies a stable order, and then
selects the requested page. This preserves every validated filter instead of
substituting another popularity measure.

Missing cover, release year, combined rating, duration, platform, genre, or
mode data is represented as `null` or an empty list. The adapter joins the
minimal `game_time_to_beats` projection and exposes `normally` as
`normalDurationSeconds`; fast and completionist values are requested only when
their criteria require them. With selected platforms, a game satisfies release
bounds when any selected platform release is inside the interval; without a
platform filter, `first_release_date` is used. Duration and platform-release
evaluation happen before paging so totals remain exact. Unknown durations sort
last and are excluded only by active duration bounds, which sets
`excludedUnknownDuration=true`. Successful empty pages remain distinct from
classified provider failures.

## Title autocomplete

`GET /api/v1/games/autocomplete` accepts a required `q`, trimmed and validated
to 2–100 characters, and optional repeated platform context using the same
allow-listed identifiers as browsing. Unknown parameters are rejected and a
missing or out-of-range `q` fails HTTP validation before reaching the catalog.

The IGDB adapter issues a `search` query so suggestions follow the provider's
relevance ranking rather than a sort field; platform context narrows the same
query with the existing AND/OR translation. Each suggestion normalizes only
id, slug, title, release year, and cover, and the response never exceeds eight
items regardless of how many the provider returns. Missing release year or
cover values remain `null`. Classified upstream failures remain distinct from
a successful, non-empty response, and this endpoint never affects the
behavior of `GET /api/v1/games`.

## Game detail

`GET /api/v1/games/{gameId}` accepts a positive integer path parameter and
returns complete normalized detail: official and alternative names, summary,
cover and screenshots, platform-specific release dates, genres, themes,
platforms, game modes, aggregated multiplayer support, user/critic/combined
ratings, fast/normal/completionist durations, age ratings, and allow-listed
external links. Genres, platforms, and game modes reuse the exact identifiers
exposed by `/filters` and `/games`; themes, names, summary, age ratings, and
external-link labels preserve the provider's own text instead of an
application-owned identity, since they are display-only.

Multiplayer fields are aggregated across every platform's
`multiplayer_modes` record with OR logic, and `maxPlayers` is the highest
`onlinemax`/`offlinemax` value reported for any of them. The three duration
measures share one provider submission count rather than one count per
measure, matching the IGDB `game_time_to_beats` shape; a measure is `null`
when IGDB has no value for it.

Eligibility enforces the MVP content scope: only released base games and
their separately cataloged remakes and remasters resolve. An absent game ID
and an excluded content type (DLC, expansion, bundle, mod, and similar)
both return `GAME_NOT_FOUND`, so a request cannot distinguish "does not
exist" from "exists but excluded." Classified upstream failures keep their
own distinct codes.

Eligibility reads IGDB's `game_type` field (not the similarly-named but
non-existent `category`) — a live smoke-test run caught this exact mismatch;
see [Milestone 1 review](../../docs/milestone-1-review.md#live-smoke-test-findings)
for what it found and fixed. The `age_ratings.organization.name` /
`age_ratings.rating_category.rating` shape and the `WEBSITE_LABELS` codes
(read from `websites.type`) are confirmed correct against live data.

## Production composition

`main.build_catalog()` is the single seam that decides whether the
application talks to real IGDB. When `WTPN_TWITCH_CLIENT_ID` and
`WTPN_TWITCH_CLIENT_SECRET` are both configured, it composes one shared
`httpx.AsyncClient`, the Twitch token manager, the IGDB transport, and
`IgdbCatalog`, and closes that client when the application shuts down. When
either credential is absent, `create_app()` falls back to the same
`UnavailableCatalog` used throughout local development and automated tests —
there is no hardcoded default catalog, only this explicit decision made once
at startup from typed settings.

Run the opt-in manual smoke test to confirm the production adapter against
real data:

```bash
pnpm smoke:api
```

It requires local Twitch credentials in `.env` and network access, calls
`get_filter_metadata`, `browse_games`, `autocomplete`, and `get_game_detail`
through the exact same `Catalog` interface the HTTP routes use, and prints
only counts and titles — never credentials or raw provider payloads. It is
intentionally excluded from `pnpm quality` and CI, which must stay
deterministic and credential-free.

## Response cache

`Cache` (`cache/cache.py`) stores versioned JSON envelopes through the small
`CacheStore` port, and `RedisCacheStore` implements that port with a bounded
pool, one 200 ms deadline per operation, and no client retries. Any Redis
failure becomes a miss or a skipped write, followed by a 30-second bypass so an
outage does not add a timeout to every request. `cache_key()` builds namespaced,
schema-versioned keys from a SHA-256 digest of canonical criteria. The policy
behind these values is in [architecture §7](../../docs/architecture.md#7-caching).

`CachingCatalog` (`cache/catalog.py`) applies that cache to every `Catalog`
capability with the lifetimes in `CachePolicy` (override with
`WTPN_CACHE_TTL__SEARCH_FRESH_SECONDS` and similar), remembers a missing game
for ten minutes, and makes concurrent identical misses share one provider call.

The composition root builds the cache from settings only when it also builds
the catalog. A test or the browser fixture server that injects a catalog gets
no cache unless it injects a store as well, so it can never reach a developer's
configured Redis. Tests use `tests/cache_fakes.py`. An opt-in test exercises a
real Redis:

```bash
pnpm infra:up
WTPN_TEST_REDIS_URL=redis://localhost:6379/15 pnpm test:api
```

## Rate limiting

`http/rate_limit.py` charges each catalog request to a visitor; health checks
are exempt. The visitor is the `X-WTPN-Client-Address` the web server
forwards, trusted only with a matching `X-WTPN-Edge-Token`; otherwise it is
the socket peer, or an `X-Forwarded-For` entry chosen by
`WTPN_TRUSTED_PROXY_HOPS`. Addresses become keyed HMAC digests before
reaching Redis, and they are never logged.

- **Public ceiling**: 60 requests per minute (`WTPN_RATE_LIMIT_*`), using
  sliding-window counters that fall back to an in-process store while Redis
  is down.
- **Provider-reaching budget**: 20 per minute, charged by `CachingCatalog` only
  to a caller that would start a provider call. Over it, the caller gets stale
  data if any, otherwise `429`.

## Provider throttle and circuit breaker

`adapters/igdb/throttle.py` spaces every IGDB attempt, retries included, to
IGDB's own ceiling of four starts per second and eight in flight.
`adapters/igdb/circuit.py` opens after five consecutive timeout, unavailable,
or `429` outcomes, fails fast with the remaining open time, and closes after
one successful probe. A refused turn and an open circuit both reach the
visitor as `503 UPSTREAM_UNAVAILABLE` with a retry delay, or as stale data.
Both are process-local (technical debt 17).

## Observability

`core/structured_logging.py` writes one JSON object per log line and keeps
only allow-listed fields. Exceptions keep their type and stack, never their
message. `http/correlation.py` writes one `http.request` line per request:

- the route template, status, and duration;
- the cache outcomes and provider attempts;
- the rate-limit decision and the circuit state.

Uvicorn's access log is switched off because it printed addresses and query
strings. `GET /api/v1/health` is liveness and makes no I/O.
`GET /api/v1/health/ready` reports the cache and circuit for monitoring
without calling IGDB.

## Checks

```bash
pnpm format:api:check
pnpm lint:api
pnpm typecheck:api
pnpm test:api
pnpm build:api
```

`pnpm measure:api` (add `-- --redis` to go through the configured Redis) is
an opt-in live profile of cold versus warm search timings; like
`pnpm smoke:api`, it needs Twitch credentials and is never part of the gate.

Run these commands from the repository root. `pnpm quality` runs the complete
web, API, and contracts quality gate; `pnpm check` is an alias. No Twitch, IGDB,
or Redis configuration is required for these checks.
