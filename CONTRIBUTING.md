# Contributing

What To Play Next is currently in its foundation phase. The repository will
contain a Next.js web application, a FastAPI application, and a generated
TypeScript client.

## Prerequisites

- Git 2.55 or newer;
- Node.js 22.23.2;
- pnpm 11.19.0;
- Python 3.14.7;
- Poetry 2.4.3.

The pinned runtime versions reflect the initial development environment. Update
the version files and this document together when upgrading a runtime.

## Repository structure

```text
apps/
├── web/                  # Next.js application
└── api/                  # FastAPI application
packages/
└── contracts/            # generated TypeScript client
docs/                     # product and engineering documentation
```

## Install

```bash
pnpm run setup
```

Poetry must be available on `PATH`. The setup command installs both the pnpm
workspace and the API Poetry environment.

## Environment

Copy `apps/api/.env.example` to `apps/api/.env` and
`apps/web/.env.example` to `apps/web/.env.local`. The example files define the
supported names and safe local defaults; the populated files remain ignored by
Git.

Variables prefixed with `NEXT_PUBLIC_` are included in the browser bundle and
must never contain credentials. Twitch credentials are backend-only and must be
configured as a pair. They may remain blank until work requiring live IGDB
access begins.

Start the local Redis service before developing cache-dependent behavior:

```bash
pnpm infra:up
pnpm infra:status
```

Use `pnpm infra:logs` to follow Redis logs and `pnpm infra:down` to stop the
container. The named volume is retained across normal stops. Redis binds only
to the loopback interface and is not exposed to the local network.

## Root commands

Run both development servers from the repository root:

```bash
pnpm dev
```

The web application is available at <http://localhost:3000> and the API at
<http://localhost:8000>. Run either application independently with
`pnpm dev:web` or `pnpm dev:api`.

The repository exposes the same quality commands locally and in CI:

```bash
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

`pnpm format` rewrites files. `pnpm check` does not rewrite source files and
runs formatting verification, linting, static typing, tests, and production
builds for both applications.

## Web application

```bash
pnpm --filter web dev
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```

The development server exposes the English route at <http://localhost:3000/en>
and the Brazilian Portuguese route at <http://localhost:3000/pt-br>. No Twitch
or IGDB credential is required for the web foundation.

## API application

From `apps/api`, run:

```bash
poetry install
poetry run fastapi dev src/whattoplaynext_api/main.py
poetry run ruff format --check .
poetry run ruff check .
poetry run mypy
poetry run pytest
```

## Development workflow

Use pragmatic TDD for domain rules, use cases, API behavior, and bug fixes:

1. Agree on the public seam and the observable behavior for the slice.
2. Add one behavioral test and confirm that it fails for the expected reason.
3. Implement the smallest vertical slice that makes the test pass.
4. Repeat for the next behavior, then refactor while keeping the suite green.

Test public interfaces rather than private methods or interactions between
internal collaborators. Use mocks or fakes only at system boundaries such as
IGDB, Redis, time, and network failures. Bug fixes should begin with a
regression test whenever the failure is reproducible in automation.

A failing test is not required first for documentation-only, generated-code,
purely visual, or configuration changes. These changes must still receive the
relevant automated checks or documented manual verification.

Work in vertical slices that deliver one observable behavior through the
necessary domain, application, adapter, and UI boundaries. Avoid building an
entire horizontal layer in anticipation of future behavior.

## Definition of done

A delivery increment is done when:

- its acceptance criteria are satisfied by an observable vertical slice;
- relevant behavior is covered by automated tests through public seams;
- `pnpm check` passes from the repository root;
- generated artifacts are current and reproducible;
- credentials and populated environment files are absent from the change;
- affected behavioral, operational, or architectural documentation is current;
- any required manual verification is recorded in the delivery summary.

## Commit convention

- Create one commit for each completed `M0.X` increment.
- Use Conventional Commits in the form `type(scope): imperative summary`.
- Prefer `feat`, `fix`, `docs`, `test`, `refactor`, `build`, `ci`, and `chore`.
- Keep the subject concise, imperative, and free of a trailing period.
- Write the commit body as bullet points describing the delivered outcomes.
- Add `Milestone: M0.X` as the final trailer for milestone commits.
- Do not add AI, tool, or assistant co-authors to commits.
- Run the relevant checks before committing.
- Push directly to `main` during the initial foundation phase.

## Ground rules

- Never commit credentials or populated environment files.
- Keep provider-specific concepts inside the IGDB adapter.
- Treat FastAPI OpenAPI as the public-contract source of truth.
- Add automated tests without requiring the live IGDB service.
- Keep changes focused and update the relevant documentation with behavioral
  or architectural decisions.
