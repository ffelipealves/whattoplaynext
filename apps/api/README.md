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
poetry install
```

## Run

```bash
poetry run fastapi dev src/whattoplaynext_api/main.py
```

The health endpoint is available at <http://localhost:8000/api/v1/health>.

## Checks

```bash
poetry run ruff format --check .
poetry run ruff check .
poetry run mypy
poetry run pytest
```

No Twitch, IGDB, or Redis configuration is required for these checks.
