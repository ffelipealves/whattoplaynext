# What To Play Next

What To Play Next is a structured game-discovery search engine. Users combine
objective filters such as platform, genre, release date, rating, game mode, and
estimated duration to find games that fit their current constraints.

The MVP is deliberately not a personalized recommendation system. It has no
accounts, saved libraries, favorites, user reviews, natural-language search, or
approximate matching.

## Documentation

- [Product requirements](docs/product-requirements.md) — source of truth for
  product behavior, scope, and quality targets.
- [Architecture](docs/architecture.md) — implementation structure and technical
  decisions.
- [API contract](docs/api-contract.md) — public HTTP interface and validation.
- [Data sources](docs/data-sources.md) — provider evidence, constraints, and
  alternatives.
- [MVP roadmap](docs/roadmap.md) — delivery sequence and milestone exit checks.

## Planned stack

- Next.js and TypeScript frontend
- FastAPI and Pydantic backend
- IGDB as the sole game-data provider for the MVP
- Redis-compatible distributed cache
- OpenAPI-generated TypeScript client
- English as the default UI language and Brazilian Portuguese as secondary

## Project status

The approved planning baseline is complete and implementation has started with
Milestone 0. The repository foundation is organized as a monorepo with empty
application directories ready for the web, API, and generated contract.

## Development

The initial development environment uses Node.js 22.23.2, pnpm 11.19.0, and
Python 3.14.7. See [CONTRIBUTING.md](CONTRIBUTING.md) for the repository layout,
setup status, and contribution rules.
