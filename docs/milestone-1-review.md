# Milestone 1 Review

Status: engineering closeout accepted; live IGDB verification remains an
owner-gated action

Reviewed: 2026-09-12

Audited baseline: `2d6ddc0` (M1.9); this review and the M1.10 composition it
describes land together in the closeout commit

This review closes the provider-adapter and normalized-API portion of
Milestone 1. It does not claim that the Twitch application, the IGDB
commercial partnership, or the first live smoke-test run tracked in
[External prerequisites](external-prerequisites.md) are complete — those
remain explicit owner actions, consistent with how
[Milestone 0 review](milestone-0-review.md) treated the same category of
external dependency.

## Executive summary

Milestone 1 delivered a provider-neutral catalog interface through four
public FastAPI routes, with every Twitch/IGDB-specific concern — token
acquisition, APICalypse construction, response projection, and provider error
classification — confined to one IGDB adapter. The milestone contains 10
planned increments, all completed through pragmatic TDD against deterministic
fakes and sanitized fixtures. At closeout, the API test suite contains 155
tests across 13 files with 93% overall statement/branch coverage, and
`pnpm quality` passes without network access or credentials.

## Increment history

| Increment | Commit    | Delivered outcome                                                                                                                                            |
| --------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1.1      | `f72a116` | Normalized error types, a stable public error envelope, and request-ID creation/propagation at the FastAPI edge.                                             |
| M1.2      | `b33d149` | Twitch client-credentials token acquisition with in-memory reuse, expiry-safe refresh, and single-flight concurrency control.                                |
| M1.3      | `08d989e` | Authenticated IGDB transport with bounded timeouts, one retry for transient failures, jitter, and capped `Retry-After` handling.                             |
| M1.4      | `3f30359` | `GET /api/v1/filters` with allow-listed platform, genre, and game-mode identities plus static duration/sort/validation bounds.                               |
| M1.5      | `d23e408` | Unfiltered `GET /api/v1/games` with 24-item pages, popularity ordering, and IGDB Visits-based totals.                                                        |
| M1.6      | `6ab2867` | Strict AND/OR search criteria, provider query translation, and bounded pagination for name/platform/genre/rating/mode/sort/direction/page.                   |
| M1.7      | `041370d` | Platform-specific release-date evaluation, fast/normal/completionist duration mapping, and `excludedUnknownDuration` response metadata.                      |
| M1.8      | `8119186` | `GET /api/v1/games/autocomplete` with a relevance-ranked IGDB `search` query, platform-narrowed results, and a fixed eight-item limit.                       |
| M1.9      | `2d6ddc0` | `GET /api/v1/games/{gameId}` with complete normalized detail and eligibility enforcement that collapses absent and excluded games into one `GAME_NOT_FOUND`. |
| M1.10     | (this)    | Production composition of the token manager, transport, and catalog behind `create_app()`, an opt-in live smoke command, and this closeout report.           |

Supporting commits `0e45d48` and `789bbd1` divided the milestone into
increments and prepared the M1.5 handoff; they carried no product behavior.

## Capabilities available now

- A `Catalog` protocol exposing `get_filter_metadata`, `browse_games`,
  `autocomplete`, and `get_game_detail`, satisfied by both `IgdbCatalog` and
  deterministic test fakes.
- `GET /api/v1/filters`, `GET /api/v1/games`, `GET /api/v1/games/autocomplete`,
  and `GET /api/v1/games/{gameId}`, each with a documented shape in
  [API contract](api-contract.md).
- A stable public error envelope with request-ID correlation, covering
  validation, not-found, upstream-unavailable, upstream-timeout, and
  upstream-invalid-response failures.
- `main.build_catalog()`, the single composition seam that wires real Twitch
  and IGDB credentials into the application when configured, and otherwise
  reports the catalog unavailable — never a hardcoded default.
- `pnpm smoke:api`, an opt-in manual command that exercises all four catalog
  capabilities against live IGDB data without printing credentials.
- A generated TypeScript client (`packages/contracts`) exposing every M1
  operation, kept in sync with the FastAPI OpenAPI schema by
  `pnpm contract:check`.

## Intentionally not delivered in Milestone 1

- Redis response caching, public rate limiting, and a circuit breaker
  (Milestone 4);
- the search frontend, autocomplete UI, and game-detail pages (Milestones 2
  and 3);
- content-type eligibility filtering for `GET /api/v1/games` browse results —
  M1.9 enforces the MVP's base-game-only scope for game _detail_, but browse
  does not yet exclude DLC/expansions/mods the same way; this is a known,
  separately tracked gap rather than an M1.10 deliverable;
- live-verified IGDB category codes for external-link types and the exact
  `age_ratings` field shape used by the detail adapter — implemented from
  documentation and training knowledge, not yet confirmed against real
  responses (see Deferred external actions below).

## Acceptance result

| Criterion                                                                               | Result             | Evidence                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automated tests never require the live IGDB service                                     | Pass               | All 155 API tests use in-memory fakes or sanitized JSON fixtures under `tests/fixtures/igdb/`; `pnpm quality` runs without network access.                                                                                                                                         |
| A manual smoke test can query real data using local credentials                         | Ready, not yet run | `pnpm smoke:api` (`apps/api/scripts/smoke_igdb.py`) is implemented and verified to fail safely without credentials; no Twitch application has been created yet (owner action, tracked in [External prerequisites](external-prerequisites.md)), so live data has not been observed. |
| Missing values remain null and upstream failures are distinguishable from empty results | Pass               | Sparse fixtures across every route (`games_sparse.json`, `game_detail_sparse.json`, empty autocomplete/browse pages) assert `null`/`[]` output; `FailingCatalog`/`FailingTransport` tests assert classified errors never become empty successes.                                   |
| Strict AND/OR and platform-date semantics are covered by tests                          | Pass               | `test_translates_strict_and_or_criteria_to_the_games_endpoint`, `test_filters_platform_releases_and_durations_before_paging`, and related M1.6/M1.7 tests in `tests/adapters/igdb/test_catalog.py`.                                                                                |

Three of four exit criteria are fully met by automated evidence. The fourth
requires an owner action (creating a Twitch application) that is explicitly
out of engineering's control, matching how Milestone 0 treated the same
Twitch/IGDB dependency.

## Quality evidence

The `pnpm quality` run behind this review produced:

- generated OpenAPI and TypeScript contract artifacts were current;
- Prettier and Ruff formatting checks passed;
- ESLint, Ruff lint, and strict mypy (Python 3.14, `strict = true`) checks
  passed;
- contracts: 1 test passed with 100% reported coverage;
- web: 1 test passed with 100% reported statement/function/line coverage;
- API: 155 tests passed across 13 files with 93% overall statement and
  branch coverage (90% required floor);
- the contracts package, Next.js application, and Python source/wheel
  packages built successfully.

## Deferred external actions

- **Twitch application and first live smoke-test run:** required before
  `pnpm smoke:api` can observe real data. Credentials must remain in
  `apps/api/.env`, outside Git, once created.
- **IGDB partnership response and attribution:** unchanged from Milestone 0;
  required before public beta, not before further engineering.
- **Live verification of `WEBSITE_LABELS` and the `age_ratings` field shape:**
  once real credentials exist, run `pnpm smoke:api` and inspect a real
  `get_game_detail` result; correct `adapters/igdb/catalog.py` if the
  provider's actual category codes or nested field names differ from the
  best-effort values chosen in M1.9.
- **Browse-side content eligibility:** `GET /api/v1/games` does not yet
  exclude DLC/expansions/mods the way `GET /api/v1/games/{gameId}` does;
  tracked as a follow-up fix, not a Milestone 1 blocker.

These deferrals do not block Milestone 2 frontend work, which consumes the
same fixture-verified contract regardless of live-data confirmation.

## M2 handoff

Milestone 2 can begin against the generated TypeScript client and the
documented [API contract](api-contract.md). The search experience should
treat autocomplete and upstream failures as expected, recoverable states
rather than exceptions, matching the distinct error codes this milestone
established.
