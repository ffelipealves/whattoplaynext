# Architecture

Status: accepted MVP architecture baseline
Last updated: 2026-09-10

## 1. Context

This document describes how the approved [product requirements](product-requirements.md)
are implemented. Product behavior, quality targets, and scope are defined only
in that document.

## 2. System view

```text
Browser
  │
  ├── pages, metadata, localized UI
  ▼
Next.js web application (Vercel)
  │  generated REST client
  ▼
FastAPI service (Render)
  │
  ├── validation and query normalization
  ├── rate limiting and resilience
  ├── Redis-compatible cache (Upstash)
  └── IGDB adapter ───────────────► Twitch OAuth / IGDB API

Anonymous analytics ──────────────► Umami Cloud
Errors and health ────────────────► monitoring providers
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
- asynchronous Redis-compatible client;
- structured JSON logging;
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
- enforce a process-wide and distributed upstream request budget;
- construct the minimum IGDB field projection;
- join duration or related endpoint data when required;
- normalize nullable fields and image URLs;
- distinguish a valid empty result from an upstream failure;
- expose source and freshness metadata internally;
- tolerate schema evolution without leaking it to the frontend.

## 7. Caching

Redis is a disposable optimization, not a source of truth.

Initial configurable TTLs:

| Resource                                      |           Fresh TTL |
| --------------------------------------------- | ------------------: |
| Search response                               |              1 hour |
| Game detail                                   |            24 hours |
| Genres, platforms, modes, and filter metadata |              7 days |
| Empty/negative lookup                         | short, configurable |
| Popular-game sitemap selection                |            24 hours |

Cache keys are generated from a canonical serialization of validated criteria,
API version, locale-sensitive presentation needs, and response schema version.
Identical in-flight cache misses share one upstream request.

Expired cache entries may be retained for a bounded stale-if-error window. A
cache outage falls back to rate-limited IGDB access.

## 8. Resilience

The FastAPI provider adapter implements NFR-005 through NFR-009 with bounded
timeouts, one retry for eligible transient failures, jitter, `Retry-After`
support, a circuit breaker, and stale-if-error cache reads. Presentation of the
resulting states belongs to the web application.

## 9. Security and privacy

The browser is untrusted, the FastAPI service is the only credential-bearing
component, and IGDB and analytics are third-party trust boundaries. Validation
and rate limiting run before provider access. Logs and analytics pass through
explicit allow-lists/redaction, and public errors expose only stable codes and a
correlation ID. The binding requirements are NFR-015 through NFR-023.

Supported environment-variable names are committed only in `.env.example`
files. Populated `.env` files remain untracked. Browser-visible configuration
uses the `NEXT_PUBLIC_` prefix and never contains credentials; backend settings
use `WTPN_`. Twitch credentials are validated as an all-or-nothing pair and the
secret uses a redacting type in application configuration.

## 10. Rendering and SEO

Next.js renders indexable routes and their metadata on the server. Search state
is encoded in query parameters but result routes emit `noindex`. Game identity
comes from the numeric ID; the slug is corrected with a locale-preserving
canonical redirect. A daily cached job supplies the bounded popular-game set to
the sitemap. See NFR-029 through NFR-032 for expected behavior.

## 11. Observability

Next.js forwards or creates a correlation ID. FastAPI accepts a bounded safe
identifier or generates a UUID, returns it in `X-Request-ID`, and includes it in
the stable error envelope. Future cache and provider operations propagate the
same value. Structured telemetry records the route template, response class,
duration, cache outcome, provider outcome, circuit state, and a non-sensitive
error code. Dashboards and retention follow NFR-023 and NFR-025 through NFR-027.

## 12. Deployment

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

A small critical Playwright suite will join this gate when those user journeys
exist. Production deploys only from the main branch after required checks pass,
and deployment secrets are scoped separately by environment.

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
- Playwright for search, URL restoration, pagination, locale switch, game
  detail, upstream error, and zero-result behavior;
- automated accessibility checks plus manual keyboard and screen-reader smoke
  testing on critical flows.
