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
  quality evidence, and the live smoke-test findings.
- [Milestone 2 plan](docs/milestone-2-plan.md) — search-experience increments,
  acceptance checks, and scope guardrails.
- [Milestone 2 review](docs/milestone-2-review.md) — search-experience closeout,
  cross-browser and Core Web Vitals evidence, and the Milestone 3 handoff.
- [Milestone 3 plan](docs/milestone-3-plan.md) — game-page, localization, and
  SEO increments and their accepted outcomes.
- [Milestone 3 review](docs/milestone-3-review.md) — exit-criterion evidence,
  browser matrix, Web Vitals spot checks, and the Milestone 4 handoff.
- [Technical debt](docs/technical-debt.md) — deliberate compromises, what each
  costs, and the release gates that depend on them.
- [MVP roadmap](docs/roadmap.md) — delivery sequence and milestone exit checks.

## Stack

- Next.js and TypeScript frontend
- FastAPI and Pydantic backend
- IGDB as the sole game-data provider for the MVP
- Redis-compatible distributed cache planned for Milestone 4; only the local
  Compose service and configuration exist so far
- OpenAPI-generated TypeScript client
- English as the default UI language and Brazilian Portuguese as secondary

## Project status

The Milestone 0 technical foundation and Milestone 1 provider adapter and
normalized API are both accepted. `GET /api/v1/filters`, `GET /api/v1/games`,
`GET /api/v1/games/autocomplete`, and `GET /api/v1/games/{gameId}` are
implemented behind a provider-neutral catalog interface, backed by a
production Twitch/IGDB adapter that the application composes automatically
when local credentials are configured and otherwise reports itself
unavailable. The owner-run live smoke test confirmed the adapter against real
IGDB data and caught two field-name defects that fixtures alone could not;
see the [Milestone 1 review](docs/milestone-1-review.md) for the complete
increment history, that finding, and the quality evidence.
Name/domain selection and the IGDB commercial partnership remain owner-gated
actions tracked separately in
[External prerequisites](docs/external-prerequisites.md); they do not block
the next engineering milestone.

Milestone 2 (search experience) is complete. `GET /[locale]/games` is a
working faceted search: name search with debounced autocomplete, structured
filters in a desktop sidebar and a mobile drawer, removable active-filter
chips, sorting, pagination, and distinct states for validation, rate limits,
and upstream failures — all driven by the URL rather than client-side state,
so a copied link restores the same search. An axe pass and a keyboard pass
cover both layouts, a Playwright suite drives the critical journeys against a
fixture-backed API on every push, and the closeout ran those journeys across
Chromium, Firefox, and WebKit at desktop and mobile sizes. The
[Milestone 2 review](docs/milestone-2-review.md) records the evidence.

Driving the new UI against live IGDB also surfaced defects that fixtures
alone could not: a rating filter that could never be served, and several
query shapes that read the whole catalog to page it. Those paths were fixed;
[Milestone 2 plan](docs/milestone-2-plan.md) has the full increment breakdown,
and [Technical debt](docs/technical-debt.md) records what was deliberately
left behind.

Milestone 3 (game pages, localization, and SEO) is complete. Eligible results
open localized ID-plus-slug game pages with canonical redirects, nullable
detail states, responsive imagery, and planned IGDB attribution. Localized
metadata, `noindex` search pages, information-page drafts, and a daily sitemap
selection are implemented. The [Milestone 3 review](docs/milestone-3-review.md)
records the 135/135 browser-matrix pass and the one open Web Vitals finding:
mobile search INP exceeds its lab target. Milestone 4 is next for Redis
caching, rate limiting, resilience, operations, and security hardening; the
[technical debt register](docs/technical-debt.md) tracks the known compromises.

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
`package.json`. Docker is optional for current development, tests, and builds;
the local Redis service is available for Milestone 4 cache work.

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

The defaults connect the web app to `http://localhost:8000` and configure an
unused local Redis URL for the future cache. `WTPN_SITE_ORIGIN` supplies the
absolute origin for canonical and sitemap URLs. Twitch credentials may remain
blank until live IGDB work begins. When used, `WTPN_TWITCH_CLIENT_ID` and
`WTPN_TWITCH_CLIENT_SECRET` must both be set in `apps/api/.env`; never place
credentials in a `NEXT_PUBLIC_` variable or commit populated environment files.

### Start the applications

Run both development servers. Start Redis first only if working on the
Milestone 4 cache or its infrastructure:

```bash
pnpm dev
```

For Redis work, run `pnpm infra:up` and `pnpm infra:status` before `pnpm dev`.
With Twitch credentials left blank, health and API documentation work, but
catalog requests report the provider as unavailable until credentials are
configured; the automated suite uses a fixture catalog instead.

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
coverage thresholds, tests, the end-to-end suite, and production builds. It
does not require Redis, Twitch credentials, or live IGDB access: the browser
journeys run against the application's own composition root with a fixture
catalog in place of the provider. Useful focused commands are:

```bash
pnpm test
pnpm coverage
pnpm e2e
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm e2e` drives a real browser and needs it installed once — `pnpm setup`
does that, and `pnpm e2e:install` does it on its own. Two further runs are
on demand rather than part of the gate: `pnpm e2e:browsers` repeats the suite
in Chromium, Firefox, and WebKit at desktop and mobile viewports (install those
engines with `pnpm e2e:install:browsers`), and `pnpm e2e:vitals` takes Core Web
Vitals spot measurements of search and game pages. The latter is an opt-in lab
check, not a release gate: mobile search INP is currently above the target.
The CI browser matrix runs on a manual workflow dispatch or a push whose commit
message contains `[browser-matrix]`.

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
