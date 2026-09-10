# Milestone 0 Review

Status: technical foundation accepted

Reviewed: 2026-09-10

Audited baseline: `88c8c24`

Technical closeout: `a510630`

This review closes the repository-foundation portion of Milestone 0. It does
not claim that the owner actions or provider decisions tracked in
[External prerequisites](external-prerequisites.md) are complete.

## Executive summary

Milestone 0 transformed the approved product plan into an executable,
reproducible monorepo foundation. It delivered a localized web shell, a typed
API shell, a generated API-client boundary, local infrastructure, one shared
quality command, CI automation, contributor onboarding, and a documented
hexagonal architecture with pragmatic TDD.

The milestone contains 11 planned increments. Two implementation corrections
and one engineering-policy commit were also made alongside those increments.
At closeout, the repository contained 67 tracked files and every automated
foundation check passed without requiring live provider credentials.

## Increment history

| Increment | Commit    | Delivered outcome                                                                                                                                                                                    |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0.1      | `20e9fd6` | Initialized Git and the monorepo layout, preserved the approved product and architecture documents, pinned Node and Python, and established repository hygiene.                                      |
| M0.2      | `4c285f7` | Created the Next.js App Router foundation with English and Brazilian Portuguese routes, responsive landing-page styling, strict TypeScript, Tailwind, ESLint, and Vitest.                            |
| M0.3      | `c18885d` | Created the FastAPI foundation with typed settings, an explicit composition root, dependency-free health endpoint, Poetry, Ruff, strict mypy, pytest, and selective hexagonal-architecture guidance. |
| M0.4      | `d168dc7` | Consolidated setup, development, formatting, lint, typing, testing, and build commands at the repository root; documented vertical slices and the definition of done.                                |
| M0.5      | `17b25e9` | Added safe environment examples, typed Redis and Twitch configuration, secret validation, and a health-checked Redis Compose service bound to localhost.                                             |
| M0.6      | `54094d9` | Made FastAPI OpenAPI the contract source of truth, generated a typed TypeScript client package, and added deterministic drift and package-build checks.                                              |
| M0.7      | `88aeebc` | Established the canonical `pnpm quality` gate with repository linting, per-package coverage thresholds, contract verification, typing, tests, and production builds.                                 |
| M0.8      | `5400458` | Added GitHub Actions for pull requests and `main`, with pinned runtime actions, read-only permissions, reproducible installs, and the shared quality gate.                                           |
| M0.9      | `6fb847b` | Documented the complete fresh-clone workflow, environment setup, service commands, contract generation, package workflows, and Windows troubleshooting.                                              |
| M0.10     | `88c8c24` | Recorded name/domain diligence, Twitch registration requirements, IGDB commercial and attribution questions, a prepared provider inquiry, and explicit launch blockers.                              |
| M0.11     | `a510630` | Audited a clean clone, accepted the technical foundation, documented external deferrals, and defined the handoff into Milestone 1.                                                                   |

Supporting commits:

- `a32bfd4` formalized pragmatic TDD and its justified exceptions;
- `0c8cec5` made Next.js route-type generation reproducible in clean CI;
- `064453f` normalized the closeout document for whitespace checks.

## Foundation available now

- A pnpm workspace containing `apps/web`, `apps/api`, and
  `packages/contracts`.
- Localized static routes at `/en` and `/pt-br` with a responsive landing-page
  foundation.
- A FastAPI application with typed configuration and
  `GET /api/v1/health`.
- Server-only Twitch credential names and validation without committed values.
- A local Redis service with persistence, health checking, and loopback-only
  exposure.
- Deterministic OpenAPI export and a generated TypeScript client that detects
  contract drift.
- One root workflow for setup, development, infrastructure, tests, coverage,
  builds, and quality validation.
- CI parity with the local quality command.
- Contributor guidance covering architecture, TDD, vertical slices, commits,
  generated contracts, security boundaries, and troubleshooting.

## Intentionally not delivered in Milestone 0

Milestone 0 supplies the development platform, not the game-discovery product
itself. The following remain in later milestones:

- live Twitch token acquisition and the IGDB HTTP adapter;
- normalized game/filter models and the catalog endpoints;
- search filters, results, pagination, detail pages, and production UI states;
- application-level Redis caching, retries, circuit breaking, and rate limits;
- production deployment, monitoring, analytics, legal pages, and launch work.

Keeping these items out of the foundation prevented speculative layers and
preserved the vertical-slice plan for Milestone 1 onward.

## Acceptance result

| Criterion                                              | Result | Evidence                                                                                                                                                                                                             |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean local setup from documented steps                | Pass   | A fresh local clone completed `pnpm setup` using only committed files.                                                                                                                                               |
| Applications build and test through the canonical gate | Pass   | The same fresh clone completed `pnpm quality`, including contract reproducibility, formatting, lint, static typing, coverage-enforced tests, and production builds.                                                  |
| CI quality gate exists and has executed successfully   | Pass   | `.github/workflows/ci.yml` runs the canonical `pnpm quality` command for pull requests, pushes to `main`, and manual dispatches; the M0.8 pipeline run was observed green.                                           |
| Secrets are absent from version control                | Pass   | The tracked-file inventory contains only `.env.example` files, populated environment paths are ignored, and a tracked-source scan found no known private-key, provider-secret, GitHub-token, or OpenAI-key patterns. |
| IGDB commercial uncertainty is visible                 | Pass   | The partnership request, attribution proposal, evidence checklist, and public-beta blocker are recorded in the external-prerequisites register.                                                                      |

The clean-clone validation ran without Twitch credentials, live IGDB access,
or Redis. This is intentional: automated foundation checks must be deterministic
and independent of external services.

## Quality evidence

The clean-clone `pnpm quality` run produced these results:

- generated OpenAPI and TypeScript contract artifacts were current;
- Prettier and Ruff formatting checks passed;
- ESLint, Ruff lint, TypeScript, and strict mypy checks passed;
- contracts: 1 test passed with 100% reported coverage;
- web: 1 test passed with 100% reported statement, function, and line coverage;
- API: 10 tests passed with 100% statement and branch coverage;
- the contracts package, Next.js application, and Python source/wheel packages
  built successfully;
- the quality command left the clean clone unchanged.

Coverage percentages describe the current small foundation surface. They are a
regression floor, not evidence that future product behavior is already tested.

## Deferred external actions

The following items are intentionally outside the technical closeout:

- **Product name and domain:** deferred until public-beta launch planning. The
  working name may continue in code and documentation in the meantime.
- **Twitch application:** required before the first manual M1 smoke test against
  live IGDB data. Credentials must remain server-side and outside Git.
- **IGDB partnership response:** required before public beta or monetized use;
  the prepared inquiry has not been sent.
- **Final IGDB attribution:** implemented only after the provider confirms the
  proposed wording and placement, and no later than public beta.

These deferrals do not block provider-independent M1 development with fixtures
and fakes. They do block the specific live or public activities stated above.

## M1 handoff

Milestone 1 can begin at the provider boundary defined by the hexagonal
architecture. The first vertical slice should implement Twitch token management
behind an outbound port with a fake adapter and deterministic tests before
introducing the live IGDB client.
