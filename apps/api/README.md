# What To Play Next — API

The public HTTP application uses FastAPI and Python 3.14. It is the only
credential-bearing part of the product and will expose provider-neutral game
data under `/api/v1`.

## Architecture

The API follows a selective hexagonal architecture:

- `http` contains inbound FastAPI adapters;
- `core` contains application composition and typed configuration;
- domain modules define their own interfaces at real seams;
- `adapters/igdb` contains the Twitch token lifecycle and authenticated IGDB
  transport;
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

Copy `.env.example` to `.env`. `WTPN_REDIS_URL` has a safe local default;
`WTPN_TWITCH_CLIENT_ID` and `WTPN_TWITCH_CLIENT_SECRET` are optional until live
IGDB access is implemented, but must always be provided together. The settings
loader treats blank example credentials as absent and masks the secret in model
representations.

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

The IGDB category codes behind `WEBSITE_LABELS` and the nested
`age_ratings` field expansion are best-effort from documentation rather than
verified live responses; running the live smoke test below against real
IGDB data is expected to confirm or correct them.

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

## Checks

```bash
pnpm format:api:check
pnpm lint:api
pnpm typecheck:api
pnpm test:api
pnpm build:api
```

Run these commands from the repository root. `pnpm quality` runs the complete
web, API, and contracts quality gate; `pnpm check` is an alias. No Twitch, IGDB,
or Redis configuration is required for these checks.
