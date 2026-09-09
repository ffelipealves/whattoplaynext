# Product Requirements

Status: approved product baseline
Last updated: 2026-09-09

## 1. Product definition

What To Play Next helps people discover games by combining objective criteria.
Despite the product name, the MVP is a faceted search product rather than a
personalized recommendation engine.

### 1.1 Initial audience

The initial audience is people who play on PC and current consoles, with an
initial focus on Brazilian users who have limited time and want to narrow a
large catalog quickly.

### 1.2 Value proposition

The product accepts several constraints at once, makes the applied criteria
visible, and returns transparent, comparable results. It is intended to be more
useful than issuing several disconnected searches across stores and catalog
sites.

### 1.3 Product goal

Validate, through a real public-facing MVP, whether structured multi-criteria
search helps users discover a game worth investigating.

### 1.4 Primary success metric

Percentage of completed searches that lead to at least one game-detail page.

Secondary metrics:

- external-link click-through rate;
- percentage of searches refined and submitted again;
- searches with zero results;
- result count distribution;
- time from search submission to the first game-detail view;
- anonymous response to the optional usefulness prompt.

These metrics indicate engagement with search results. They must not be labeled
as proof that the system made a correct recommendation.

## 2. Personas and primary journey

### 2.1 Primary persona

A player who knows some constraints, such as platform, genre, release period,
rating, or available play time, but has not selected a specific title.

### 2.2 Primary journey

1. The visitor opens the site without signing in.
2. The visitor selects zero or more structured filters.
3. The visitor explicitly applies the filters.
4. The application updates the URL and displays paginated results.
5. The visitor changes sorting, removes active filters, or opens a game.
6. The visitor reviews game details and may follow an external official link.
7. The visitor may answer the optional `Did you find something interesting?`
   prompt with `Yes` or `Not yet`.

## 3. Functional requirements

### 3.1 Search and filters

| ID | Requirement |
| --- | --- |
| FR-001 | The visitor can search without creating an account. |
| FR-002 | The visitor can submit a search with no filters to browse the catalog. |
| FR-003 | The search supports game-name text, genre, platform, release-date range, minimum rating, game mode, and estimated-duration range. |
| FR-004 | Game-name search is partial, case-insensitive, accent-tolerant where supported, and can be combined with every other filter. |
| FR-005 | Selecting multiple values within one filter category applies OR logic. |
| FR-006 | Selecting values across different categories applies AND logic. |
| FR-007 | Filters are strict. The MVP does not return approximate matches. |
| FR-008 | The visitor applies filter changes using an explicit `Apply filters` action. |
| FR-009 | The visitor can remove an active filter individually or clear all filters. |
| FR-010 | Submitted filters, sorting, language, and page are represented in the URL and restored on reload or shared access. |
| FR-011 | Unknown query parameters and invalid values produce a controlled validation response rather than being silently interpreted. |
| FR-012 | A game with a missing value is excluded only when the corresponding active filter requires that value. |
| FR-013 | When duration filtering excludes games with unknown duration, the UI explains that omission. |
| FR-014 | The normal-play duration is the default duration measure. The advanced UI can select fast, normal, or completionist duration. |
| FR-015 | When a platform and release-date range are selected, the relevant release date is the date for that platform. |
| FR-016 | With multiple platforms, a game satisfies the release filter if at least one selected platform has a release inside the interval. |
| FR-017 | Without a platform filter, release filtering uses the game's first official release. |
| FR-018 | The minimum-rating filter uses IGDB's combined rating on a 0–100 scale. Games without that rating do not satisfy an active minimum-rating filter. |

### 3.2 Filter values and initial platform scope

The initial platform scope is:

- Windows PC;
- PlayStation 4 and PlayStation 5;
- Xbox One and Xbox Series;
- Nintendo Switch.

The UI may group related platform values for convenience, while API requests
must resolve groups to explicit IGDB platform identifiers.

The MVP includes released base games. Remakes and remasters are separate games.
It excludes DLC, expansions, special editions, mods, and entries without a
confirmed release date.

### 3.3 Name autocomplete

| ID | Requirement |
| --- | --- |
| FR-019 | Name autocomplete begins after at least two characters and 300 ms without additional input. |
| FR-020 | Autocomplete displays at most eight suggestions with title, year, and a small cover where available. |
| FR-021 | Selecting a suggestion fills the name criterion but does not run the complete search. |
| FR-022 | The name field and complete search continue to work if autocomplete is unavailable. |

### 3.4 Results

| ID | Requirement |
| --- | --- |
| FR-023 | Results are paginated with 24 games per page and numbered navigation. |
| FR-024 | At most 100 pages are accessible for one query. |
| FR-025 | Default sorting is popularity. |
| FR-026 | The visitor can sort by rating, release date, duration, and title. |
| FR-027 | Each result card shows cover, title, release year, platforms, primary genres, combined rating and vote count, normal duration when available, and relevant game modes. |
| FR-028 | Missing card data is represented explicitly and never replaced with invented values. |
| FR-029 | Active filters appear as individually removable chips. |
| FR-030 | An exact zero-result state preserves the query and proposes specific filters the visitor can relax. |
| FR-031 | A zero-result state does not show approximate results automatically. |

Desktop displays filters in a sidebar beside the results. Mobile displays them
in a drawer opened by a button containing the active-filter count. Apply and
clear actions remain easy to reach in either layout.

### 3.5 Game details

| ID | Requirement |
| --- | --- |
| FR-032 | Each game has a stable detail route containing the IGDB ID and a readable slug. |
| FR-033 | The IGDB ID, not the slug, identifies the resource. An incorrect or old slug redirects to the canonical URL. |
| FR-034 | The detail page shows title, available summary, cover, release dates per platform, genres, themes, platforms, game modes, multiplayer details, ratings with source and vote count, available durations, screenshots, and supported external links. |
| FR-035 | Duration is shown as fast, normal, and completionist where each measure exists. |
| FR-036 | User and external-critic ratings are shown separately when both exist. |
| FR-037 | Age ratings may be displayed where available but are not an MVP filter. |
| FR-038 | External links are labeled as external and do not imply current price or guaranteed availability. |
| FR-039 | A missing cover or screenshot uses a first-party placeholder and reserved dimensions. |

Canonical route examples:

```text
/en/games/1942-hollow-knight
/pt-br/games/1942-hollow-knight
```

### 3.6 Languages

| ID | Requirement |
| --- | --- |
| FR-040 | English is the default UI language and Brazilian Portuguese is secondary. |
| FR-041 | Routes use explicit `/en/` and `/pt-br/` prefixes. |
| FR-042 | The first visit may detect a preferred language, but the visitor can always change it manually. |
| FR-043 | The selected language is remembered locally without an account or unique identifier. |
| FR-044 | All first-party UI, errors, metadata, and legal content are localized. |
| FR-045 | Official titles and source text from IGDB are not translated automatically. |
| FR-046 | When source text is unavailable in the UI language, the interface indicates the language provided. |

### 3.7 Informational and system pages

The MVP includes:

- home;
- search results;
- game detail;
- About/Data Sources;
- Privacy;
- Terms;
- not-found, validation-error, rate-limit, and upstream-unavailable states.

The MVP does not include a blog, editorial collections, or an administration
panel.

### 3.8 Feedback and analytics

| ID | Requirement |
| --- | --- |
| FR-047 | The result page can show the optional `Did you find something interesting?` prompt with `Yes` and `Not yet`. |
| FR-048 | Feedback is aggregated and is not associated with an account or persistent visitor identity. |
| FR-049 | Analytics records search submission, categories of filters used, result count, sort changes, detail views, external clicks, language, error category, and response time. |
| FR-050 | Analytics must not contain search text, game titles, full query strings, full IP addresses, or credentials. |

## 4. Non-functional requirements

### 4.1 Performance

| ID | Requirement |
| --- | --- |
| NFR-001 | Cached backend responses target p95 below 500 ms under expected MVP load. |
| NFR-002 | Uncached backend responses target p95 below 2.5 seconds, excluding controlled upstream outages. |
| NFR-003 | At the 75th percentile on mobile and desktop, pages target LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1. |
| NFR-004 | Images are responsive, reserve their layout dimensions, and load lazily when outside the initial viewport. |

### 4.2 Availability and resilience

| ID | Requirement |
| --- | --- |
| NFR-005 | The internal monthly availability target is 99.5%; the MVP offers no contractual SLA. |
| NFR-006 | When IGDB is unavailable, expired cached data may be served with a visible freshness warning. |
| NFR-007 | Without usable cache, the UI presents a recoverable error and retry action. |
| NFR-008 | An upstream failure must not be represented as an empty successful result set. |
| NFR-009 | IGDB calls use bounded timeouts, at most one retry for transient failures, jitter, `Retry-After` handling, and a circuit breaker. |

### 4.3 Accessibility and compatibility

| ID | Requirement |
| --- | --- |
| NFR-010 | MVP routes and responsive variants target WCAG 2.2 AA. |
| NFR-011 | The complete search flow works with a keyboard and visible focus. |
| NFR-012 | Inputs have programmatic labels, validation is announced, and result/status changes are exposed to assistive technology. |
| NFR-013 | The UI supports the two latest stable releases of Chrome, Edge, Firefox, and Safari at release time. |
| NFR-014 | The design is mobile-first and remains efficient on desktop. |

### 4.4 Security and privacy

| ID | Requirement |
| --- | --- |
| NFR-015 | Twitch and IGDB credentials exist only in the backend environment. |
| NFR-016 | Production traffic uses HTTPS and a restrictive CORS policy. |
| NFR-017 | All query values are typed, validated, bounded, and normalized before reaching the provider adapter. |
| NFR-018 | Public APIs are rate-limited, initially targeting 60 requests per minute per IP with stricter upstream-triggering limits. |
| NFR-019 | Rate-limit responses use HTTP 429 and communicate when another attempt is allowed. |
| NFR-020 | Logs and error reports contain no secrets or full IP addresses. |
| NFR-021 | No advertising, remarketing, session recording, heatmaps, or cross-site tracking exists in the MVP. |
| NFR-022 | Local storage is limited to language and theme preferences and contains no unique visitor identifier. |
| NFR-023 | Operational logs are retained for 14 days and anonymous analytics for six months unless a later legal review requires less. |

### 4.5 Operability and scale

| ID | Requirement |
| --- | --- |
| NFR-024 | The initial architecture supports approximately 1,000 users per day without manual intervention. |
| NFR-025 | Logs are structured and include a correlation ID spanning frontend request, backend, cache, and provider access. |
| NFR-026 | Operators can observe request latency, error rate, cache hit/miss, rate limiting, and IGDB quota pressure. |
| NFR-027 | A health endpoint supports automated availability checks. |
| NFR-028 | Cache failure degrades to bounded direct provider access rather than taking down the product. |

### 4.6 SEO

| ID | Requirement |
| --- | --- |
| NFR-029 | Home, informational pages, and valid game-detail pages are indexable and localized. |
| NFR-030 | Arbitrary search-result pages use `noindex` but remain shareable and restorable. |
| NFR-031 | Game pages expose canonical URLs, localized metadata, and social preview metadata. |
| NFR-032 | The sitemap includes static routes and a cached daily selection of up to 500 popular games. |

## 5. Explicitly out of scope

- natural-language or AI-powered search;
- approximate, weighted, or personalized recommendation;
- accounts and authentication;
- owned-game libraries, favorites, and history;
- first-party ratings, reviews, or comments;
- price comparison and regional availability;
- subscription catalogs such as Game Pass and PS Plus;
- difficulty and mood filters;
- automatic catalog translation;
- relational database and catalog replication;
- administration panel;
- mobile application;
- monetization;
- blog and editorial content.

## 6. Release gates

Public beta cannot begin until:

- IGDB commercial usage or partnership is confirmed in writing;
- required attribution is visible;
- the product name and domain have been checked;
- Privacy and Terms pages have been reviewed;
- providers, retention, international transfers, and applicable analytics/cookie
  obligations have been documented;
- a privacy contact is available;
- critical tests, accessibility checks, and performance checks pass;
- the closed beta with 10–20 people is complete and blocking issues are fixed.

This document is a product and engineering specification, not legal advice.
