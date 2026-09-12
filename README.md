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
- [External prerequisites](docs/external-prerequisites.md) — name/domain
  diligence and Twitch/IGDB launch blockers.
- [Milestone 0 review](docs/milestone-0-review.md) — foundation acceptance,
  clean-clone evidence, and explicit deferrals.
- [Milestone 1 plan](docs/milestone-1-plan.md) — provider/API increments,
  acceptance checks, and scope guardrails.
- [Milestone 1 review](docs/milestone-1-review.md) — provider/API closeout,
  quality evidence, and the deferred live-verification action.
- [MVP roadmap](docs/roadmap.md) — delivery sequence and milestone exit checks.

## Planned stack

- Next.js and TypeScript frontend
- FastAPI and Pydantic backend
- IGDB as the sole game-data provider for the MVP
- Redis-compatible distributed cache
- OpenAPI-generated TypeScript client
- English as the default UI language and Brazilian Portuguese as secondary

## Project status

The Milestone 0 technical foundation and Milestone 1 provider adapter and
normalized API are both accepted. `GET /api/v1/filters`, `GET /api/v1/games`,
`GET /api/v1/games/autocomplete`, and `GET /api/v1/games/{gameId}` are
implemented behind a provider-neutral catalog interface, backed by a
production Twitch/IGDB adapter that the application composes automatically
when local credentials are configured and otherwise reports itself
unavailable. See the [Milestone 1 review](docs/milestone-1-review.md) for the
complete increment history and quality evidence.
Name/domain selection, the IGDB commercial partnership, and the first live
smoke-test run against real IGDB data remain owner-gated actions tracked
separately in [External prerequisites](docs/external-prerequisites.md); they
do not block Milestone 2 frontend work.

## Local development

This section is the complete path from a fresh clone to both applications
running. [CONTRIBUTING.md](CONTRIBUTING.md) contains the architecture rules,
quality policy, and commit convention used after setup.

### Prerequisites

Install these tools before cloning the repository:

| Tool                                                                   | Version                   | Purpose                      |
| ---------------------------------------------------------------------- | ------------------------- | ---------------------------- |
| [Git](https://git-scm.com/downloads)                                   | 2.55 or newer             | Source control               |
| [Node.js](https://nodejs.org/en/download)                              | 22.23.2                   | Web and repository tooling   |
| [pnpm](https://pnpm.io/installation)                                   | 11.19.0                   | JavaScript workspace         |
| [Python](https://www.python.org/downloads/)                            | 3.14.7                    | API runtime                  |
| [Poetry](https://python-poetry.org/docs/#installation)                 | 2.4.3                     | Python dependency management |
| [Docker with Compose](https://docs.docker.com/get-started/get-docker/) | Current supported release | Local Redis                  |

The exact Node and Python versions are also recorded in `.node-version` and
`.python-version`; pnpm is pinned by the `packageManager` field in
`package.json`. Docker is optional for tests and builds, but required for
cache-dependent local behavior.

Verify the command-line tools:

```bash
git --version
node --version
pnpm --version
python --version
poetry --version
docker compose version
```

### Clone and install

```bash
git clone git@github.com:ffelipealves/whattoplaynext.git
cd whattoplaynext
pnpm setup
```

`pnpm setup` installs the pnpm workspace and the Poetry environment. It does not
start Docker or either application.

### Configure the environment

Create local environment files from the committed examples.

macOS, Linux, or Git Bash:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

The defaults connect the web app to `http://localhost:8000` and the API to the
local Redis service. Twitch credentials may remain blank until live IGDB work
begins. When used, `WTPN_TWITCH_CLIENT_ID` and `WTPN_TWITCH_CLIENT_SECRET` must
both be set in `apps/api/.env`; never place credentials in a `NEXT_PUBLIC_`
variable or commit populated environment files.

### Start the applications

Start Redis, confirm it is healthy, and run both development servers:

```bash
pnpm infra:up
pnpm infra:status
pnpm dev
```

The services are available at:

| Service                    | URL                                   |
| -------------------------- | ------------------------------------- |
| Web — English              | <http://localhost:3000/en>            |
| Web — Brazilian Portuguese | <http://localhost:3000/pt-br>         |
| API health                 | <http://localhost:8000/api/v1/health> |
| API documentation          | <http://localhost:8000/docs>          |

Use `pnpm dev:web` or `pnpm dev:api` to run only one application. Use
`pnpm infra:logs` to inspect Redis and `pnpm infra:down` to stop it. A normal
stop preserves the local Redis volume.

### Run checks and tests

Run the same complete gate used by GitHub Actions:

```bash
pnpm quality
```

The gate verifies generated contracts, formatting, linting, static types,
coverage thresholds, tests, and production builds. It does not require Redis,
Twitch credentials, or live IGDB access. Useful focused commands are:

```bash
pnpm test
pnpm coverage
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm check` remains an alias for `pnpm quality`. See
[CONTRIBUTING.md](CONTRIBUTING.md#root-commands) for every package-specific
command.

### Update the API contract

FastAPI is the contract source of truth. After changing a public route or its
models, regenerate and verify the committed OpenAPI artifacts:

```bash
pnpm contract:generate
pnpm contract:check
```

Commit both `packages/contracts/openapi.json` and
`packages/contracts/src/schema.ts`. Do not edit either generated artifact by
hand.

### Live IGDB smoke test

`pnpm quality` never contacts Twitch or IGDB. To confirm the production
adapter against real data, create a Twitch application, set
`WTPN_TWITCH_CLIENT_ID` and `WTPN_TWITCH_CLIENT_SECRET` in `apps/api/.env`,
then run:

```bash
pnpm smoke:api
```

This queries live filter, browse, autocomplete, and detail data through the
same `Catalog` interface used by the HTTP routes and prints only counts and
titles — never credentials or raw provider payloads. It requires network
access, so it is excluded from `pnpm quality` and CI.

### Windows troubleshooting

- **`poetry` is not recognized:** restart the terminal after installing Poetry
  and ensure its scripts directory is on `PATH`. The default user location is
  commonly `%APPDATA%\Python\Scripts`; confirm discovery with
  `where.exe poetry`.
- **Poetry selected another Python:** list installations with `py -0p`, then run
  `poetry -C apps/api env use 3.14` and repeat `pnpm setup`.
- **PowerShell blocks `pnpm.ps1`:** use `pnpm.cmd` in that shell or configure an
  appropriate execution policy for your development account.
- **Docker cannot connect to its engine:** start Docker Desktop and wait until
  `docker info` succeeds before running `pnpm infra:up`.
- **Port 3000, 8000, or 6379 is already in use:** stop the process or container
  currently owning that port before starting the stack. On PowerShell, inspect
  it with `Get-NetTCPConnection -LocalPort <port>`.
- **Installs or builds fail inside a synchronized folder:** pause the sync tool
  or clone the repository into a short, non-synchronized path such as
  `C:\src\whattoplaynext`, then run `pnpm setup` again.

If the problem remains, capture the failing command and its complete output when
opening an issue; never include `.env` contents or credentials.
