# What To Play Next — API

The public HTTP application uses FastAPI and Python 3.14. It is the only
credential-bearing part of the product and will expose provider-neutral game
data under `/api/v1`.

## Architecture

The API follows a selective hexagonal architecture:

- `http` contains inbound FastAPI adapters;
- `core` contains application composition and typed configuration;
- future domain modules define their own interfaces at real seams;
- IGDB, Redis, and test fakes will be adapters behind those interfaces;
- domain modules must not import FastAPI, HTTPX, Redis, or IGDB types.

The health endpoint has no outbound dependency or variable implementation, so
it does not introduce an artificial port.

## Install

```bash
pnpm run setup
```

## Run

```bash
pnpm dev:api
```

The health endpoint is available at <http://localhost:8000/api/v1/health>.

## Checks

```bash
pnpm format:api:check
pnpm lint:api
pnpm typecheck:api
pnpm test:api
pnpm build:api
```

Run these commands from the repository root. `pnpm check` runs the complete
web and API quality gate. No Twitch, IGDB, or Redis configuration is required
for these checks.
