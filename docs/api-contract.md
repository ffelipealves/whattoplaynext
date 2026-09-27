# API Contract

Status: implemented through Milestone 3; the Milestone 4 rate-limit,
readiness, and freshness semantics were decided in M4.1 and are not yet
implemented. The generated OpenAPI schema is the executable authority.
Base path: `/api/v1`

FastAPI OpenAPI is the executable source of truth. The committed schema is
generated at `packages/contracts/openapi.json`, with TypeScript types and client
support in the same package. This document fixes public semantics before each
endpoint is implemented; exact schema component names may be refined without
changing the agreed behavior.

## 1. Conventions

- JSON uses camelCase at the public boundary.
- Dates use ISO 8601 calendar dates.
- Durations are returned in whole seconds and displayed as localized hours by
  the web application.
- Ratings use a 0–100 numeric scale.
- Nullable source values are `null`; they are not replaced with zero.
- List query parameters may repeat, for example
  `platform=pc&platform=playstation-5`.
- All responses can include `requestId` for support correlation.
- Every HTTP response includes `X-Request-ID`. A caller value is propagated only
  when it contains 1–128 ASCII letters, digits, `.`, `_`, or `-` and begins with
  a letter or digit; otherwise the API generates a UUID.
- Unknown parameters are rejected.

## 2. Endpoints

### `GET /api/v1/filters`

Returns the allow-listed platform groups, genres, game modes, duration kinds,
sort options, and public validation bounds required to build the form.

Example shape:

```json
{
  "platforms": [{ "id": "pc", "label": "PC" }],
  "genres": [{ "id": "role-playing-rpg", "label": "Role-playing (RPG)" }],
  "gameModes": [{ "id": "single-player", "label": "Single player" }],
  "durationKinds": ["fast", "normal", "completionist"],
  "sortOptions": ["popularity", "rating", "release-date", "duration", "title"],
  "limits": {
    "pageSize": 24,
    "maximumPage": 100,
    "minimumAutocompleteLength": 2,
    "maximumNameLength": 100,
    "minimumDurationHours": 1,
    "maximumDurationHours": 1000
  }
}
```

The initial platform identifiers are `pc`, `playstation-4`, `playstation-5`,
`xbox-one`, `xbox-series-x-s`, and `nintendo-switch`. They are stable public
identifiers; the IGDB numeric IDs used to resolve them remain inside the
provider adapter. Genre and game-mode identifiers follow the same rule and do
not derive their identity from mutable provider labels.

### `GET /api/v1/games`

M1.7 implements strict search for name, platform, genre, release bounds,
minimum rating, game mode, duration, sort, direction, and page.

Query parameters:

| Parameter              | Type            | Meaning                                              |
| ---------------------- | --------------- | ---------------------------------------------------- |
| `name`                 | string          | Partial title query                                  |
| `platform`             | repeated string | OR within platform category                          |
| `genre`                | repeated string | OR within genre category                             |
| `releaseFrom`          | date            | Inclusive lower release bound                        |
| `releaseTo`            | date            | Inclusive upper release bound                        |
| `minimumRating`        | integer         | Combined IGDB rating, a whole number from 0 to 100   |
| `gameMode`             | repeated string | OR within mode category                              |
| `durationKind`         | enum            | `fast`, `normal`, or `completionist`; default normal |
| `minimumDurationHours` | number          | Inclusive lower duration bound                       |
| `maximumDurationHours` | number          | Inclusive upper duration bound                       |
| `sort`                 | enum            | Defaults to `popularity`                             |
| `direction`            | enum            | `asc` or `desc`; sensible default depends on sort    |
| `page`                 | integer         | Defaults to 1; maximum 100                           |

Response shape:

```json
{
  "items": [
    {
      "id": 1942,
      "slug": "hollow-knight",
      "title": "Hollow Knight",
      "releaseYear": 2017,
      "cover": {
        "url": "https://...",
        "width": 264,
        "height": 374
      },
      "platforms": [{ "id": "pc", "label": "PC" }],
      "genres": [{ "id": "platform", "label": "Platform" }],
      "rating": { "value": 89.2, "count": 1234, "source": "IGDB combined" },
      "normalDurationSeconds": null,
      "gameModes": [{ "id": "single-player", "label": "Single player" }]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 24,
    "totalItems": 240,
    "totalPages": 10
  },
  "query": {
    "sort": "popularity",
    "direction": "desc"
  },
  "meta": {
    "requestId": "...",
    "servedFrom": "provider",
    "dataMayBeStale": false,
    "excludedUnknownDuration": false
  }
}
```

Values repeated within platform, genre, or game mode are deduplicated and use
OR semantics. Active categories are combined with AND semantics and are never
silently relaxed. Name matching uses the provider's case-insensitive partial
comparison. Rating uses `total_rating` and is a whole number: IGDB's query
language rejects a decimal literal, so the bound is published as an integer
rather than accepted and then failed upstream. Release bounds are inclusive and use
the release dates belonging to any selected platform. Without a platform
criterion they fall back to `first_release_date`.

Browse always applies the eligibility rule that detail uses: the base-game,
remake, and remaster `game_type` allow-list plus a past or same-day
`first_release_date`. Popularity reads the IGDB Visits index in
popularity order for both filtered and unfiltered requests and joins each page
against that eligibility constraint plus any caller filters until the requested
page is full. It falls back to listing every matching ID when the match set is
small enough that reading it whole is cheaper. Rating, release-date, and title
sorts use their explicit IGDB game fields when no other join is required.

Evaluations that IGDB cannot express in one query — duration bounds, and
release dates belonging to a selected platform — read whichever side is
smaller: the duration or release index when it is narrower than the match
list, and the match list otherwise. Ordering by a selected platform's release
date pages the release index in date order and stops once no unread release
can change the requested page. Results and totals are exact in every case.

Duration bounds accept 1–1,000 hours, are inclusive, and must convert exactly to
whole seconds. The default duration kind is `normal`. Duration values come from
IGDB `game_time_to_beats`: `hastily`, `normally`, and `completely` map to fast,
normal, and completionist. Cards expose `normally` as
`normalDurationSeconds`; a missing record remains `null`. Unknown duration
sorts last and is excluded only when a duration bound is active. Unknown rating
is likewise excluded only by an active minimum-rating filter.

`totalItems` is exact for the active criteria and counts eligible games only.
Joins happen before the requested 24-item page is selected and preserve the
chosen order.

An empty provider page is a successful response with an empty `items` list.
Provider failures retain their classified error responses. Until M4.3,
metadata remains `servedFrom="provider"` and `dataMayBeStale=false`;
`excludedUnknownDuration` is true exactly when duration bounds are active.
Section 8 defines the Milestone 4 freshness metadata.

### `GET /api/v1/games/autocomplete`

Query parameters:

| Parameter  | Type            | Meaning                                       |
| ---------- | --------------- | --------------------------------------------- |
| `q`        | string          | Required, trimmed, 2–100 characters           |
| `platform` | repeated string | Optional context; narrows results with AND/OR |

Response shape:

```json
{
  "items": [
    {
      "id": 1942,
      "slug": "the-witcher-3-wild-hunt",
      "title": "The Witcher 3: Wild Hunt",
      "releaseYear": 2015,
      "cover": {
        "url": "https://...",
        "width": 264,
        "height": 374
      }
    }
  ],
  "meta": {
    "requestId": "...",
    "servedFrom": "provider",
    "dataMayBeStale": false,
    "excludedUnknownDuration": false
  }
}
```

Results use the provider's relevance ordering rather than a sort field. When
platform identifiers are given, values within the category use OR and narrow
the candidate set with AND against the query text. The response never exceeds
eight items, applies the same base-game/remake/remaster eligibility allow-list
as browse and detail, and leaves missing release year or cover values as `null`.

Independent public rate limiting and Redis caching are planned for Milestone 4,
not active yet; suggestions will be cached for one hour with no stale
fallback. A failed suggestion request does not block normal name-filter
submission: the web application keeps the search field usable without
autocomplete until that page is reloaded.

### `GET /api/v1/games/popular`

Returns up to 500 popularity-ordered, eligible game identities for sitemap
generation. It accepts no parameters and is deliberately narrower than browse:
each item has only the canonical ID and slug needed to construct a game URL.

```json
{
  "items": [{ "id": 1942, "slug": "the-witcher-3-wild-hunt" }],
  "meta": {
    "requestId": "...",
    "servedFrom": "provider",
    "dataMayBeStale": false,
    "excludedUnknownDuration": false
  }
}
```

The selection pages IGDB's Visits primitive in descending popularity order and
joins every index page against the same base-game, remake, and remaster
eligibility allow-list used by browse, autocomplete, and detail. It stops when
it has 500 eligible games or the index ends. The response is publicly cacheable
for 24 hours with `Cache-Control: public, max-age=86400, s-maxage=86400`.

### `GET /api/v1/games/{gameId}`

Returns normalized detail data for one IGDB game ID. The slug is handled by the
web route and does not form part of resource identity. `gameId` must be a
positive integer; a non-numeric or non-positive value fails HTTP validation
before reaching the catalog.

Response shape:

```json
{
  "id": 1942,
  "slug": "the-witcher-3-wild-hunt",
  "title": "The Witcher 3: Wild Hunt",
  "alternativeNames": ["TW3"],
  "summary": "A story-driven, next-generation open world role-playing game.",
  "summaryLanguage": "en",
  "cover": { "url": "https://...", "width": 264, "height": 374 },
  "screenshots": [{ "url": "https://...", "width": 889, "height": 500 }],
  "releases": [
    { "platform": { "id": "pc", "label": "PC" }, "releaseDate": "2015-05-19" }
  ],
  "genres": [{ "id": "role-playing-rpg", "label": "Role-playing (RPG)" }],
  "themes": [{ "id": 1, "name": "Action" }],
  "platforms": [{ "id": "pc", "label": "PC" }],
  "gameModes": [{ "id": "single-player", "label": "Single player" }],
  "multiplayer": {
    "onlineCoop": true,
    "offlineCoop": false,
    "splitScreen": true,
    "maxPlayers": 4
  },
  "userRating": { "value": 88.5, "count": 5321, "source": "IGDB user" },
  "criticRating": { "value": 92.1, "count": 45, "source": "IGDB critic" },
  "combinedRating": {
    "value": 92.25,
    "count": 2745,
    "source": "IGDB combined"
  },
  "durations": {
    "fast": { "seconds": 18000, "submissionCount": 1834 },
    "normal": { "seconds": 39600, "submissionCount": 1834 },
    "completionist": { "seconds": 108000, "submissionCount": 1834 }
  },
  "ageRatings": [{ "organization": "ESRB", "rating": "Mature" }],
  "externalLinks": [
    { "label": "Official Website", "url": "https://thewitcher.com/en/witcher3" }
  ],
  "meta": {
    "requestId": "...",
    "servedFrom": "provider",
    "dataMayBeStale": false,
    "excludedUnknownDuration": false
  }
}
```

Names, summary, alternative names, theme names, age ratings, and external-link
labels preserve the provider's own text rather than an application-owned
identity; genres, platforms, and game modes reuse the same stable identifiers
as `/filters` and `/games`. Multiplayer support is aggregated with OR logic and
`maxPlayers` takes the highest reported player count across every platform
record. Duration values share one provider submission count across the three
measures; a duration measure is `null` when IGDB has no value for it. Age
ratings and external links are provider text and allow-listed categories
respectively; an unrecognized external-link category is omitted rather than
guessed.

The MVP scope is released base games and their separately cataloged remakes
and remasters. Since M4.3, eligibility requires both an allowed content type
and a `first_release_date` no later than the end of the current UTC day, in
detail and every discovery path
([architecture §8a](architecture.md#8a-released-game-eligibility)).
A game ID that does not exist, or that resolves to an excluded
content type such as DLC, an expansion, a bundle, or a mod, returns
`GAME_NOT_FOUND` — the same code for both cases, so a request cannot probe
which excluded games exist. An unreleased or undated game answers the same
way. Upstream failures keep their own distinct codes.

### `GET /api/v1/health`

Liveness. Returns `{"status": "ok"}` without I/O: no IGDB request and no Redis
command. Platform health checks use only this endpoint.

### `GET /api/v1/health/ready` (Milestone 4.7 target)

Readiness for monitoring. It sends at most one Redis `PING`, reads the
in-memory circuit state, and never calls IGDB.

```json
{
  "status": "degraded",
  "cache": "down",
  "provider": "closed"
}
```

- `cache`: `up`, `down`, or `disabled` when no Redis is configured;
- `provider`: `closed`, `half-open`, `open`, or `not-configured`;
- `status`: `ready` when the cache is up and the circuit closed; `unavailable`
  when the provider is not configured; `degraded` otherwise.

`ready` and `degraded` return `200`; `unavailable` returns `503`. The response
never includes hosts, ports, error text, or credentials, and the endpoint is
exempt from rate limiting.

## 3. Search semantics

The endpoint implements FR-005 through FR-018 from the
[product requirements](product-requirements.md). In particular, popularity is a
sort order rather than a match score, and the API must not silently relax a
validated query.

## 4. Validation

- page: integer 1–100;
- page size: fixed at 24;
- rating: 0–100;
- duration bounds: 1–1,000 hours and minimum not greater than maximum;
- autocomplete bounds: 2–100 characters;
- submitted name filter: trimmed, non-empty when present, and at most 100
  characters;
- release lower bound not greater than upper bound;
- enumerations drawn from the filter-metadata endpoint;
- duplicate repeated values normalized away;
- unknown parameters rejected.

## 5. Errors

Every error uses this envelope:

```json
{
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",
    "message": "Game data is temporarily unavailable.",
    "requestId": "01...",
    "retryAfterSeconds": 30
  }
}
```

`requestId` matches the response's `X-Request-ID` header. The optional
`retryAfterSeconds` field is omitted when no retry time is known; when present,
it also appears in the HTTP `Retry-After` header.

Initial stable codes:

| HTTP | Code                        | Meaning                                              |
| ---: | --------------------------- | ---------------------------------------------------- |
|  400 | `INVALID_QUERY`             | Query combination is invalid                         |
|  404 | `NOT_FOUND`                 | Requested public route or resource does not exist    |
|  404 | `GAME_NOT_FOUND`            | Game ID is absent or excluded from MVP content types |
|  405 | `METHOD_NOT_ALLOWED`        | Resource does not support the requested HTTP method  |
|  422 | `VALIDATION_ERROR`          | One or more parameter values are invalid             |
|  429 | `RATE_LIMITED`              | Client must wait before another request              |
|  500 | `INTERNAL_ERROR`            | Unexpected failure hidden behind a safe fallback     |
|  502 | `UPSTREAM_INVALID_RESPONSE` | Provider response could not be normalized safely     |
|  503 | `UPSTREAM_UNAVAILABLE`      | Provider unavailable and no usable cache exists      |
|  504 | `UPSTREAM_TIMEOUT`          | Provider exceeded the bounded deadline               |

Error messages are localized by the web application using the stable code. The
API message is a safe English fallback and never includes provider payloads or
stack traces.

## 6. Rate limiting (Milestone 4.5 target)

Today an HTTP 429 can only come from the provider; it is classified as
`RATE_LIMITED` with `Retry-After` and `retryAfterSeconds` when available.
Decided in M4.1, with every number configurable:

- each client may make 60 catalog requests per minute, of which at most 20 may
  be cache misses that reach the provider; cache hits do not count toward the
  second budget;
- exceeding either budget returns `429 RATE_LIMITED` with `Retry-After` and
  `retryAfterSeconds` set to the wait until a request would be allowed;
- when the process-wide provider limit (IGDB's four requests per second and
  eight in flight) cannot be met within the operation deadline, the response
  is stale data or `503 UPSTREAM_UNAVAILABLE` with a short retry delay, not
  `429`, because the caller did not cause it;
- successful responses carry no `RateLimit-*` headers; health endpoints are
  not limited.

The client is the visitor, not the web server. The web server identifies the
visitor with two request headers that are part of the trust boundary rather
than the public interface, so they are not published in the OpenAPI schema:

| Header                  | Value                                              |
| ----------------------- | -------------------------------------------------- |
| `X-WTPN-Client-Address` | the visitor's IP address as seen by the web server |
| `X-WTPN-Edge-Token`     | the shared secret configured on both server sides  |

Without a valid token the forwarded address is ignored and the caller's own
address is used, so a direct caller cannot choose its identity. Addresses are
used only as keyed digests with a TTL equal to the rate-limit window.

## 7. Versioning rules

Additive nullable fields do not require a new base version. Removing or
renaming fields, changing filter semantics, or changing null behavior requires
a new API version or an explicitly managed migration.

## 8. Freshness metadata (M4.3 implemented; stale fallback in M4.4)

Every catalog response's `meta` keeps its existing fields and gains one
additive, nullable field:

| Field            | Values                       | Meaning                                                                  |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------ |
| `servedFrom`     | `provider`, `cache`          | Whether this request called the provider or read a stored response       |
| `dataMayBeStale` | boolean                      | `true` only when an expired entry was served because the provider failed |
| `dataAsOf`       | ISO 8601 date-time or `null` | When the provider produced the data; `null` only without the cache layer |

A stale response is `servedFrom="cache"` with `dataMayBeStale=true`; the web
application shows a localized notice with `dataAsOf` and never presents it as
current. `cache` is a new enumeration value: the web application treats
`servedFrom` as informational, so the addition is compatible under the rules
above. Error responses are unchanged; a stale fallback is a successful
response, and without one the existing classified error is returned.

Callers that shared another request's in-flight provider call also receive
`servedFrom="provider"`: the data was fetched for them, just not by them.
Filter metadata has no `meta` object and is cached without these fields.
