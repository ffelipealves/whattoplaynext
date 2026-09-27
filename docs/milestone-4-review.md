# Milestone 4 Review

Status: closeout recorded; one verification open (the WebKit browser matrix)

Reviewed: 2026-09-27

Audited baseline: `d336041`, the last implementation commit; this review
follows in a documentation-only commit.

This review records the delivered cache, resilience, security, operations, and
analytics work, the evidence behind each [roadmap](roadmap.md) exit criterion,
and what is handed to closed beta. Deliberate compromises stay in the
[technical debt register](technical-debt.md); trust boundaries and accepted
security risks are in the [security review](security-review.md).

## Executive summary

Milestone 4 completed all nine planned increments.

- **Cache**: the API answers repeated requests from a Redis-backed cache with
  in-flight coalescing, and serves an expired entry, clearly marked, when IGDB
  fails.
- **Protection**: it limits each visitor, keeps IGDB under its own
  four-requests-per-second ceiling, and stops calling IGDB during an outage
  until a single probe succeeds.
- **Operations**: every request produces one redacted JSON log line that
  carries the same request ID the web application sent.
- **Security**: both surfaces send security headers, and the reviewed
  controls and residual risks are recorded.
- **Analytics**: the web application sends only allow-listed, bucketed,
  anonymous analytics events.
- **Catalog**: unreleased and undated games are excluded everywhere, as the
  product requirements always intended.

Warm responses measured about 1 ms p95 through the real Redis, against the
500 ms target. Cold responses are unchanged: two search shapes still take 10 s
and 68 s against IGDB, which is the known provider-side debt.

Verification was run on the development machine:

- the fixture-backed `pnpm quality` gate passes: 387 API tests, 293 web tests,
  and 37 Chromium journeys;
- Firefox and mobile Chromium pass their journeys;
- WebKit could not run there without system libraries that need
  administrator rights, so the five-engine matrix is the one open
  verification.

## Increment history

| Increment | Commits                                    | Delivered outcome                                                                                                    |
| --------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| M4.1      | `43b9234`                                  | Cache, rate-limit, circuit, readiness, analytics, and released-game decisions, with two owner choices recorded.      |
| M4.2      | `d366de0`, `86637bd`                       | `CacheStore` port, bounded Redis adapter, typed versioned entries, and a 30-second bypass after failures.            |
| M4.3      | `78f2789`, `89b22e1`, `52729b1`, `fcf39ab` | The released-game rule, then the catalog cache with coalescing, origin metadata, and live measurements.              |
| M4.4      | `8044c0f`, `805723d`                       | Stale-if-error for provider failures, a localized stale notice, and a load-robust web unit suite.                    |
| M4.5      | `753eb2e`, `5ec28e4`, `74e9b94`            | Per-visitor budgets from a token-authenticated forwarded address, a provider-reaching budget, and the IGDB throttle. |
| M4.6      | `c4f5b9a`, `5a0286f`                       | Twitch failures classified, and a circuit breaker with a single half-open probe and exponential reopening.           |
| M4.7      | `d4f2c54`                                  | Allow-listed JSON logs, per-request telemetry, web-to-API request IDs, readiness, and `pnpm measure:api`.            |
| M4.8      | `4c33c74`, `9123845`                       | Security headers on both surfaces, production-only switches, input caps, and the security review.                    |
| M4.9      | `d336041` + closeout                       | Umami behind one allow-listed boundary, recorded-payload journeys, and this review.                                  |

## Roadmap exit criteria

| Criterion                                                    | Result  | Evidence                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cache hit, miss, stale, and unavailable paths are tested     | Pass    | `test_cache.py`, `test_caching_catalog.py`, and `test_circuit.py` cover hits, misses, coalesced misses, every lifetime, the negative marker, stale fallback for each provider failure, the end of the stale window, an unavailable Redis, and cache behavior while the circuit is open. The Redis store also passed against a real Redis 8.2.                            |
| Repeated upstream failures do not create a request storm     | Pass    | Five consecutive failures open the circuit, and no provider call follows until one probe (`test_circuit.py`). Identical misses share one call. The throttle holds IGDB to four starts per second and eight in flight, retries included. Callers get stale data or a `503` with the remaining open time.                                                                  |
| Analytics inspection confirms prohibited values are absent   | Pass    | `analytics.spec.ts` records real payloads through a stub script that resolves page views against the actual title and URL. Across search, game page, external link, failure, and stale journeys it finds only allow-listed events and keys, and no query string, title, slug, ID, or link URL. Unit tests prove the run-time allow-list drops what the types would miss. |
| Logs contain no secret or full IP address                    | Pass    | `test_observability.py` sends a search phrase, a forwarded address, a forged `X-Forwarded-For`, and the edge token, and finds none in the log output. A live run of the served app showed only JSON lines and no access log. Redis keys hold only digests.                                                                                                               |
| Performance targets pass under a representative test profile | Partial | Cached p95 is 1.18–1.45 ms through the real Redis, against 500 ms (NFR-001). Uncached, the unfiltered shape takes 1.74 s against 2.5 s, but the two known debt shapes take 10.8 s and 67.7 s (NFR-002; technical debt 2 and 2b). Stale and open-circuit answers make no provider call. Mobile search INP remains over target (technical debt 15; see below).             |

## Verification

- `pnpm quality` passed on the audited baseline without provider credentials:
  the contract check, formatting, lint, type checks, API coverage (387 tests,
  one opt-in Redis test skipped), web coverage (293 tests), contracts, 37
  Chromium journeys, and the production build.
- Opt-in and live checks during the milestone:
  - the Redis store tests against Compose `redis:8.2.9-alpine`;
  - `pnpm smoke:api` against IGDB, with the eligible total falling from
    316,258 to 233,997 under the released rule;
  - `pnpm measure:api --redis`;
  - live rate-limit and logging runs of the production composition.
- Dependency audits: `pnpm audit` was clean after the `js-yaml` override, and
  `pip-audit` was clean.

### Browser matrix

On the development machine (WSL2, Ubuntu 26.04), `pnpm e2e:browsers` passed
120 of 185:

- all 62 WebKit failures were launch failures: WebKit needs 118 system
  packages whose installation requires administrator rights;
- the other three failures (two Firefox, one mobile Chromium) did not
  reproduce when rerun. The debounce journey passed three times in a row on
  Firefox alone. They come from wall-clock gaps under five-project parallel
  load, now recorded as
  [technical debt 19](technical-debt.md#19-the-debounce-journey-depends-on-wall-clock-gaps).

**Open verification:** run the WebKit projects, either after
`sudo npx playwright install-deps webkit` on this machine or through the CI
browser matrix with a `[browser-matrix]` push. Milestone 3 last passed WebKit
at 135/135, and no Milestone 4 change is engine-specific. Still, the M4.9
acceptance names the matrix, so it is recorded as open rather than assumed.

### Core Web Vitals spot check

The chromium vitals projects measured:

| Page   | Layout                  | LCP          | INP          | CLS |
| ------ | ----------------------- | ------------ | ------------ | --- |
| Search | desktop                 | 1,220 ms     | 48 ms        | 0   |
| Game   | desktop                 | 860 ms       | 184 ms       | 0   |
| Search | mobile, 4× CPU throttle | 1.8–2.6 s    | 950–1,300 ms | 0   |
| Game   | mobile, 4× CPU throttle | 750–1,110 ms | 230–320 ms   | 0   |

The mobile numbers are worse than those recorded at the Milestone 3 closeout,
so the cause was isolated on the same machine the same day:

- a build of the current code without analytics measured the same, 1,008 to
  1,280 ms search INP;
- the Milestone 3 closeout commit `eae3480`, rebuilt in a temporary worktree
  and measured alternately with the current build, measured 1,040 to
  2,576 ms.

The difference is the measurement environment, not a Milestone 4 regression.
The mobile search INP finding (technical debt 15) stands, and the game page's
mobile INP now also exceeds 200 ms in this environment. These are lab numbers
on one loaded machine, not field p75 data.

## Decisions and deviations

- **Owner decisions** (M4.1): the released-game rule is a past or same-day
  global `first_release_date`, and visitor identity is a forwarded address
  authenticated by an edge token.
- **Refinements made during delivery**, each recorded where it happened:
  - a caller over the provider-reaching budget gets stale data before `429`;
  - known retry delays reach the caller for every provider failure;
  - analytics entry values are `search-result` and `direct` only, because
    selecting an autocomplete suggestion fills the field rather than opening
    a game.
- **Defects found and fixed**:
  - Twitch token failures surfaced as `500`;
  - unexpected errors were not logged;
  - Uvicorn's access log printed addresses and query strings;
  - `500` responses skipped the security headers;
  - a cache hit's `dataAsOf` came from the wrong clock.
- **Not built**: the FR-047 usefulness prompt. Its analytics event is defined
  in the architecture but not implemented, because the prompt itself is not
  in scope.

## Handoff to closed beta

Engineering is ready for a preview deployment once the deployment target is
decided; it was postponed on 2026-09-27. These release-gate items remain open:

1. **Deployment decision**: hosting for the web, API, Redis, logs, and
   monitoring, including the 14-day log retention of NFR-023.
2. **Per-environment secrets**: the edge token and HMAC key, with a
   production `WTPN_ENVIRONMENT` and an HTTPS `WTPN_SITE_ORIGIN` (see the
   [security review](security-review.md#5-release-gate-items-for-deployment)).
3. **Umami**: create the website and set `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, then
   confirm the script and collection origins against the CSP on the first
   deployment.
4. **Privacy**: the Privacy draft must name Umami and its six-month
   retention, and describe the digest-only handling of addresses.
5. **Existing gates**: branded-browser testing (technical debt 14), IGDB
   written confirmation, and name and domain.
6. **The open WebKit matrix run.**
