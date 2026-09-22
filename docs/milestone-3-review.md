# Milestone 3 Review

Status: closeout accepted

Reviewed: 2026-09-22

Audited baseline: `eae3480` (final quality gate and browser matrix); this
review's acceptance record follows in a documentation-only commit.

This review records the delivered game-page, localization, and SEO work, the
verification behind each [roadmap](roadmap.md) exit criterion, and the
compromises carried into Milestone 4. Those compromises remain in the
[technical debt register](technical-debt.md).

## Executive summary

Milestone 3 completed all ten planned increments. A visitor can open an
eligible catalog result on a localized game page, follow a stable ID-plus-slug
URL, return to the same search, and recover from provider failures without a
false 404. The game page presents nullable fields and responsive imagery with
reserved space; English and Brazilian Portuguese first-party copy, system
states, and metadata are in place. Search is excluded from indexing, while
canonical game pages and the bounded, daily popular-game sitemap are exposed.
About/Data Sources, Privacy, and Terms exist in both locales, with the latter
two explicitly marked as drafts. Planned text-only IGDB attribution is visible
but still awaits provider approval.

The fixture-backed quality gate passes without provider credentials. Its
Chromium journey suite has 27 scenarios; the five-project local browser matrix
passed all 135. The game page met the LCP, INP, and CLS lab targets on desktop
and throttled mobile. The previously recorded mobile search INP issue remains
open; the opt-in vitals suite is intentionally not part of `pnpm quality`.

## Increment history

| Increment | Commit                         | Delivered outcome                                                                                                                  |
| --------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| M3.1      | `b6de335`                      | One eligible-game-type rule for detail, browse, counts, and autocomplete.                                                          |
| M3.2      | `25ead15`                      | Localized, ID-based game routes and permanent canonical slug redirects.                                                            |
| M3.3      | `400af68`                      | Complete game-detail states, absent-field handling, provider-language indicator, and accessible presentation.                      |
| M3.4      | `dd6b199`                      | Responsive covers and screenshot gallery with reserved dimensions and first-party placeholders.                                    |
| M3.5      | `a183c9a`                      | Localized system and failure states with distinct recovery behavior.                                                               |
| M3.6      | `7fc1c2c`                      | Localized information drafts and persistent planned IGDB attribution.                                                              |
| M3.7      | `e04b286`                      | Localized canonical, alternate, Open Graph, robots, and sitemap metadata.                                                          |
| M3.8      | `1390935`                      | Eligible popular-game sitemap selection, bounded to 500 and cached for a day.                                                      |
| M3.9      | `1eef757`                      | Keyboard, accessible-name, axe, and screen-reader smoke coverage for the search-to-game journey.                                   |
| M3.10     | `53d2be5`–`eae3480` + closeout | Game-page Web Vitals, quality and browser-matrix verification, contract and debt review, plus CI accessibility-test stabilization. |

The small `6dd53d6` test-stability follow-up sits between M3.8 and M3.9.

## Roadmap exit criteria

| Criterion                                               | Result | Evidence                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source content is never automatically translated        | Pass   | `game-detail-page.test.tsx` keeps the provider's English summary intact on a Portuguese page and shows its source language. Only first-party labels come from locale messages.                                                                                                                                                                                                                         |
| Invalid slugs redirect without losing locale            | Pass   | `search.spec.ts` asserts a permanent 308 to the canonical ID-plus-slug URL in the same locale; ID-only routes and invalid/missing IDs are covered separately.                                                                                                                                                                                                                                          |
| Search is `noindex`; game canonical metadata is correct | Pass   | `metadata.spec.ts` checks every localized search URL and the game's canonical, localized title/description, alternates, and cover; `seo.test.ts` checks absolute URL construction. Provider-failure pages are also `noindex` in `search.spec.ts`.                                                                                                                                                      |
| Sitemap contains static pages and cached popular games  | Pass   | `sitemap.test.ts` checks static and canonical game entries plus a static-only fallback; `test_selects_at_most_500_eligible_popular_games_for_the_sitemap` checks the API selection. `sitemap.ts` sets one-day revalidation, the API popular response sets a one-day cache header, and `metadata.spec.ts` checks the production `/sitemap.xml`.                                                         |
| Keyboard and screen-reader smoke pass the core journey  | Pass   | `accessibility.spec.ts` drives autocomplete, search, result, game page, gallery, and return in both locales with keyboard and accessible-name assertions; serious/critical axe findings are absent. M3.9's Orca 46.1 + Firefox desktop and mobile smoke passed. Continuous reading of the game-summary paragraph was confirmed in the accessibility tree, not claimed as a recorded speech transcript. |

## Verification

`pnpm quality` passed locally on the audited baseline, without IGDB/Twitch
credentials. It confirmed generated OpenAPI and TypeScript artifacts are
current, formatting and lint checks pass, TypeScript and strict mypy pass,
and all production builds complete. The gate ran 1 contract test, 237 web
tests across 34 files, 174 API tests, and 27 Chromium Playwright scenarios.
Web coverage was 95.32% statements, 94.52% branches, 95.95% functions, and
95.46% lines; API total was 92.96%, above its 90% floor. Browser tests use a
fixture catalog, not external provider calls. The final `pnpm contract:check`
also found no drift.

`pnpm e2e:browsers` passed locally against a production build: 27 scenarios
each in desktop Chromium, desktop Firefox, desktop WebKit, mobile Chromium,
and mobile WebKit — 135 of 135, with three workers. The final hosted
[CI run 35778827555](https://github.com/ffelipealves/whattoplaynext/actions/runs/35778827555)
also passed 135 of 135, with no flaky tests; its quality job passed on the
same baseline. This is engine/layout coverage, not a pass on the two latest
branded Chrome, Edge, Firefox, and Safari releases required at the closed-beta
gate; see debt entry 14.

The first hosted attempts exposed CI-only timing in the M3.9 accessibility
tests: Firefox did not always place initial keyboard focus in the document,
and WebKit could receive input before the search form's selective hydration.
The tests now establish document focus and wait for the autocomplete field's
hydrated handler before exercising its failure path. The final local
`CI=true` matrix and hosted matrix passed all 135 scenarios without retry.

### Core Web Vitals spot check

`e2e/vitals.spec.ts` measured the fixture-backed search and game pages in
desktop Chromium and a Pixel 7 viewport with 4× CPU throttling. Game images
were served with a controlled delay to exercise reserved layout space, and
the gallery was opened, advanced, and closed for interaction timing. These
single-run lab readings are not the field 75th percentile of NFR-003.

| Page   | Layout                  | LCP        | INP      | CLS   |
| ------ | ----------------------- | ---------- | -------- | ----- |
| Search | Desktop                 | 724 ms     | 40 ms    | 0     |
| Search | Mobile, 4× CPU throttle | 1,248 ms   | 448 ms   | 0     |
| Game   | Desktop                 | 248 ms     | 104 ms   | 0     |
| Game   | Mobile, 4× CPU throttle | 332 ms     | 144 ms   | 0     |
| Target |                         | ≤ 2,500 ms | ≤ 200 ms | ≤ 0.1 |

The game page met all three lab targets. Search met LCP and CLS but the first
mobile filter-drawer opening took 448 ms and a subsequent opening 272 ms,
both above the 200 ms INP target. This reproduces the known hydration/form
mount cost in [debt entry 15](technical-debt.md#15-opening-the-mobile-filter-drawer-is-slow-to-respond),
not a newly introduced M3 defect. Cold live-provider search LCP and field
performance still need remeasurement after M4 caching.

## M3.10 acceptance

| Criterion                                          | Result | Evidence                                                                                                                                                            |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm quality` passes without provider credentials | Pass   | Local gate results above; Chromium browser suite and all builds completed.                                                                                          |
| Every roadmap exit criterion has recorded evidence | Pass   | Exit-criteria table above.                                                                                                                                          |
| Browser matrix passes in CI                        | Pass   | [Run 35778827555](https://github.com/ffelipealves/whattoplaynext/actions/runs/35778827555): 135/135 across five projects, no flaky tests; quality gate also passed. |

## Deferred work and M4 handoff

Milestone 4 owns Redis caching, rate limiting, circuit breaking, observability,
security hardening, and analytics. The technical debt register keeps the cold
duration/release-range costs, mobile search INP, coverage boundary, and retail
browser gate visible. Public-beta owner actions remain separate: choose and
clear the product name/domain, obtain written IGDB partnership and attribution
approval, and review legal drafts and privacy contact. Their status is in
[External prerequisites](external-prerequisites.md).
