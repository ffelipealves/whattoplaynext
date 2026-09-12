# Milestone 1 Review

Status: closeout accepted, including a successful live IGDB smoke-test run

Reviewed: 2026-09-12

Audited baseline: `2d6ddc0` (M1.9); this review and the M1.10 composition it
describes land together in the closeout commit

This review closes the provider-adapter and normalized-API portion of
Milestone 1. The owner registered a Twitch application and ran the live
smoke test during this closeout; the IGDB commercial partnership tracked in
[External prerequisites](external-prerequisites.md) remains a separate,
unrelated public-beta gate, consistent with how
[Milestone 0 review](milestone-0-review.md) treated that category of
external dependency.

## Executive summary

Milestone 1 delivered a provider-neutral catalog interface through four
public FastAPI routes, with every Twitch/IGDB-specific concern — token
acquisition, APICalypse construction, response projection, and provider error
classification — confined to one IGDB adapter. The milestone contains 10
planned increments, all completed through pragmatic TDD against deterministic
fakes and sanitized fixtures. At closeout, the API test suite contains 155
tests across 13 files with 93% overall statement/branch coverage, and
`pnpm quality` passes without network access or credentials. The owner then
ran `pnpm smoke:api` against real IGDB data, which observed all four catalog
capabilities successfully and caught two real field-name defects that no
amount of fixture-based testing could have surfaced — exactly the outcome
this milestone's fixtures-then-live-verification structure was designed to
produce. Both are fixed; see "Live smoke-test findings" below.

## Increment history

| Increment | Commit    | Delivered outcome                                                                                                                                               |
| --------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1.1      | `f72a116` | Normalized error types, a stable public error envelope, and request-ID creation/propagation at the FastAPI edge.                                                |
| M1.2      | `b33d149` | Twitch client-credentials token acquisition with in-memory reuse, expiry-safe refresh, and single-flight concurrency control.                                   |
| M1.3      | `08d989e` | Authenticated IGDB transport with bounded timeouts, one retry for transient failures, jitter, and capped `Retry-After` handling.                                |
| M1.4      | `3f30359` | `GET /api/v1/filters` with allow-listed platform, genre, and game-mode identities plus static duration/sort/validation bounds.                                  |
| M1.5      | `d23e408` | Unfiltered `GET /api/v1/games` with 24-item pages, popularity ordering, and IGDB Visits-based totals.                                                           |
| M1.6      | `6ab2867` | Strict AND/OR search criteria, provider query translation, and bounded pagination for name/platform/genre/rating/mode/sort/direction/page.                      |
| M1.7      | `041370d` | Platform-specific release-date evaluation, fast/normal/completionist duration mapping, and `excludedUnknownDuration` response metadata.                         |
| M1.8      | `8119186` | `GET /api/v1/games/autocomplete` with a relevance-ranked IGDB `search` query, platform-narrowed results, and a fixed eight-item limit.                          |
| M1.9      | `2d6ddc0` | `GET /api/v1/games/{gameId}` with complete normalized detail and eligibility enforcement that collapses absent and excluded games into one `GAME_NOT_FOUND`.    |
| M1.10     | (this)    | Production composition, an opt-in live smoke command, a successful live run against real IGDB data, two live-caught field-name fixes, and this closeout report. |

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
  separately tracked gap rather than an M1.10 deliverable.

## Live smoke-test findings

The owner registered a Twitch application and configured local credentials.
The first `pnpm smoke:api` run observed real data through
`get_filter_metadata` (6 platforms, 23 genres, 6 game modes), `browse_games`
(72,038 total items), and `autocomplete` (8 suggestions for "witcher") — but
`get_game_detail` failed with `GAME_NOT_FOUND` for a known-valid game ID.
Direct inspection of the live response showed why: IGDB's actual field is
`game_type`, not `category`. The chosen enum values (0 = main game, 8 =
remake, 9 = remaster) were already correct — only the field name was wrong,
so every real game was being misclassified as ineligible. The same
inspection found `websites.category` had the identical problem: the live
field is `websites.type`, resolved against a `website_types` reference
endpoint whose IDs matched the `WEBSITE_LABELS` values already chosen. The
`age_ratings.organization.name` / `age_ratings.rating_category.rating` shape
was confirmed correct as written, needing no change. Both field-name defects
are fixed in `adapters/igdb/catalog.py` and the `game_detail_*` fixtures; a
second `pnpm smoke:api` run then observed all four capabilities
successfully, including a complete `get_game_detail` result for "The
Witcher 3: Wild Hunt".

Verifying this also surfaced a second, unrelated defect: three tests
(`test_settings.py`, `test_composition.py`) constructed `Settings()` without
controlling Twitch credentials, implicitly depending on `apps/api/.env`
never existing on the developer's machine. Once the owner created that file
for the smoke test, those tests silently started reading real credentials —
in one case, a test asserting `UnavailableCatalog` behavior over HTTP would
have begun composing a real `IgdbCatalog` instead, violating the project's
rule that automated tests never contact Twitch or IGDB. All three are fixed
to isolate explicitly rather than depend on ambient machine state.

## Acceptance result

| Criterion                                                                               | Result | Evidence                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Automated tests never require the live IGDB service                                     | Pass   | All 155 API tests use in-memory fakes or sanitized JSON fixtures under `tests/fixtures/igdb/`; `pnpm quality` runs without network access.                                                                                                       |
| A manual smoke test can query real data using local credentials                         | Pass   | `pnpm smoke:api` observed real data through all four catalog capabilities on 2026-09-12; see "Live smoke-test findings" above for the run and the defects it caught.                                                                             |
| Missing values remain null and upstream failures are distinguishable from empty results | Pass   | Sparse fixtures across every route (`games_sparse.json`, `game_detail_sparse.json`, empty autocomplete/browse pages) assert `null`/`[]` output; `FailingCatalog`/`FailingTransport` tests assert classified errors never become empty successes. |
| Strict AND/OR and platform-date semantics are covered by tests                          | Pass   | `test_translates_strict_and_or_criteria_to_the_games_endpoint`, `test_filters_platform_releases_and_durations_before_paging`, and related M1.6/M1.7 tests in `tests/adapters/igdb/test_catalog.py`.                                              |

All four exit criteria are met with recorded evidence.

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

- **IGDB partnership response and attribution:** unchanged from Milestone 0;
  required before public beta, not before further engineering.
- **Browse-side content eligibility:** `GET /api/v1/games` does not yet
  exclude DLC/expansions/mods the way `GET /api/v1/games/{gameId}` does;
  tracked as a follow-up fix, not a Milestone 1 blocker.

Neither deferral blocks Milestone 2 frontend work, which consumes the same
live-verified contract regardless of the IGDB partnership's status.

## M2 handoff

Milestone 2 can begin against the generated TypeScript client and the
documented [API contract](api-contract.md). The search experience should
treat autocomplete and upstream failures as expected, recoverable states
rather than exceptions, matching the distinct error codes this milestone
established.
