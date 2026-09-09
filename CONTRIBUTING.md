# Contributing

What To Play Next is currently in its foundation phase. The repository will
contain a Next.js web application, a FastAPI application, and a generated
TypeScript client.

## Prerequisites

- Git 2.55 or newer;
- Node.js 22.23.2;
- pnpm 11.19.0;
- Python 3.14.7.

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

## Current setup

Application installation and execution commands will be added as the web and
API foundations are created in M0.2 and M0.3. No Twitch or IGDB credential is
required for the repository foundation.

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
