# MVP Roadmap

Status: approved planning baseline
Target shape: individual development over approximately 6–8 weeks

The schedule is an estimate, not a commitment. Each milestone finishes with a
demonstrable vertical slice and its acceptance checks.

## Milestone 0 — External prerequisites and foundation

Status: technical foundation accepted on 2026-09-10; external launch actions
remain explicitly deferred.

Deliverable status:

- [x] check product name, domain, and obvious mark conflicts;
- [x] create Twitch application credentials for server-side IGDB access;
- [ ] contact IGDB regarding intended public/commercial use and attribution
      (deferred, but required before public beta);
- [x] initialize Git and the monorepo directories;
- [x] configure pnpm, Poetry, formatting, linting, typing, and CI;
- [x] record environment-variable names without committing values;
- [x] create local development commands and contributor instructions.

Exit criteria:

- [x] clean local setup from documented steps;
- [x] both applications build and test in CI;
- [x] secrets are absent from version control;
- [x] unresolved IGDB commercial permission is visible as a public-beta
      blocker.

The current evidence, prepared actions, and unresolved owner/provider gates are
tracked in [External prerequisites](external-prerequisites.md).

The technical closeout and clean-clone evidence are recorded in
[Milestone 0 review](milestone-0-review.md). Product name and domain selection
are deferred until public-beta planning. Twitch credentials were created ahead
of the M1.10 live smoke test; written IGDB usage confirmation remains a
public-beta blocker.

## Milestone 1 — Provider adapter and normalized API

Status: complete, including a successful live smoke-test run against real
IGDB data. See [Milestone 1 review](milestone-1-review.md).

Deliverables:

- Twitch token management;
- IGDB HTTP client with timeouts and bounded retry;
- normalized platform, genre, game-mode, rating, release, image, and duration
  models;
- `/filters`, `/games`, `/games/autocomplete`, `/games/{id}`, and `/health`;
- stable error envelope;
- fixtures and provider-mapping tests;
- generated TypeScript API client.

Exit criteria:

- [x] automated tests never require the live IGDB service;
- [x] a manual smoke test can query real data using local credentials —
      `pnpm smoke:api` observed all four catalog capabilities against real
      IGDB data and caught two field-name defects that fixtures alone could
      not (see [Milestone 1 review](milestone-1-review.md));
- [x] missing values remain null and upstream failures are distinguishable
      from empty results;
- [x] strict AND/OR and platform-date semantics are covered by tests.

The ordered vertical slices, module seams, test expectations, and scope
guardrails are defined in [Milestone 1 plan](milestone-1-plan.md). Full
closeout evidence is recorded in [Milestone 1 review](milestone-1-review.md).

## Milestone 2 — Search experience

Status: active; M2.1 completed and M2.2 is next.

Deliverables:

- localized home and search form;
- desktop sidebar and mobile filter drawer;
- autocomplete with graceful failure;
- URL serialization and restoration;
- result cards, active chips, sorting, pagination, and zero-result state;
- loading, validation, rate-limit, and upstream-failure states.

Exit criteria:

- every agreed filter works alone and in representative combinations;
- a copied URL restores the same submitted criteria and page;
- back and forward navigation behave correctly;
- no filter is applied before explicit submission;
- 24-item pagination is stable and bounded.

The ordered vertical slices, module seams, test expectations, and scope
guardrails are defined in [Milestone 2 plan](milestone-2-plan.md).

## Milestone 3 — Game pages, localization, and SEO

Deliverables:

- English and Brazilian Portuguese route trees;
- localized first-party UI and errors;
- stable ID-plus-slug game route and canonical redirect;
- complete game-detail presentation with nullable states;
- responsive images and first-party placeholders;
- external links and IGDB attribution;
- canonical, Open Graph, robots, and sitemap behavior;
- About/Data Sources, Privacy, and Terms drafts.

Exit criteria:

- source content is never automatically translated;
- invalid slugs redirect without losing locale;
- search pages are `noindex` and game pages expose correct canonical metadata;
- the sitemap contains static pages and the cached popular-game selection;
- keyboard and screen-reader smoke tests pass for the core journey.

## Milestone 4 — Cache, resilience, security, and operations

Deliverables:

- Redis cache, canonical keys, TTLs, stale-if-error, and request coalescing;
- public and upstream-aware rate limiting;
- circuit breaker and provider-degradation states;
- correlation IDs and structured logging;
- error monitoring, health monitoring, and core metrics;
- security headers, CORS, validation, and secret review;
- Umami events with an explicit property allow-list.

Exit criteria:

- cache hit, miss, stale, and unavailable paths are tested;
- repeated upstream failures do not create a request storm;
- analytics inspection confirms prohibited values are absent;
- logs contain no secret or full IP address;
- performance targets pass under a representative test profile.

## Milestone 5 — Closed beta

Deliverables:

- preview deployment for 10–20 invited testers;
- structured test script covering discovery, filtering, comprehension, and
  usefulness feedback;
- issue triage by severity and frequency;
- accessibility and responsive-device review;
- revised copy for confusing data limitations.

Exit criteria:

- no open blocker or critical defect;
- main tasks can be completed without facilitator help;
- zero-result and missing-data behavior is understood by testers;
- measurement events and primary metric are functioning;
- all public-beta gates have owners and evidence.

## Milestone 6 — Public beta

Prerequisites:

- written IGDB usage confirmation and correct attribution;
- name/domain verification;
- reviewed Privacy and Terms;
- privacy contact;
- paid always-on production hosting where required;
- production alerts and spending controls;
- critical test suite green;
- closed-beta blocking findings resolved.

Launch checks:

- production smoke test in both locales;
- cache and upstream degradation exercise;
- rate-limit verification;
- social-preview and canonical verification;
- analytics payload audit;
- rollback procedure verified.

## Completion and future scope

The authoritative MVP definition of done is the set of requirements and release
gates in the [product requirements](product-requirements.md). Each milestone
above supplies evidence toward that definition.

Post-MVP ideas are intentionally unscheduled. The authoritative exclusion list
is [Explicitly out of scope](product-requirements.md#5-explicitly-out-of-scope);
moving an item into delivery requires a new product decision and updated
requirements.
