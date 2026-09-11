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
not require credentials or contact Twitch. Production wiring from `Settings`
into the provider stack remains part of M1.10 composition.

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
cannot become an empty successful response. Until M1.10 composes live provider
credentials, the default application starts safely and reports the catalog as
unavailable when this endpoint is called without an injected catalog.

## Game browsing

`GET /api/v1/games` exposes the M1.5 unfiltered browse slice. It accepts only an
optional `page` from 1 through 100, uses a fixed page size of 24, and returns
provider-neutral summaries ordered by the current IGDB Visits popularity
primitive. The adapter pages and counts popularity primitives, fetches a
minimal explicit game projection for those IDs, and restores popularity order.

Missing cover, release year, combined rating, duration, platform, genre, or
mode data is represented as `null` or an empty list. Duration remains `null`
until M1.7 enrichment. Successful empty pages remain distinct from classified
provider failures. Current response metadata is `servedFrom="provider"`,
`dataMayBeStale=false`, and `excludedUnknownDuration=false`. Production wiring
remains deferred to M1.10, so the default catalog still reports unavailable.

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
