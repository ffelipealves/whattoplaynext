# Data Sources

Status: researched recommendation
Research date: 2026-09-09

Provider terms, limits, schemas, and pricing can change. Recheck every linked
primary source before public launch.

## 1. Decision

Use IGDB/Twitch as the sole catalog provider for the MVP. Use a backend adapter
and cache so provider-specific schemas and credentials never reach the browser.

Official documentation: <https://api-docs.igdb.com/>

## 2. IGDB suitability

Relevant supported data includes:

- game and alternative names;
- genres and themes;
- platforms and platform-specific release dates;
- user, external, and combined ratings with counts;
- covers, artworks, and screenshots;
- game modes and structured multiplayer data;
- external IDs and URLs;
- fast, normal, and completionist time-to-beat values with submission count;
- text search and structured filtering.

Constraints:

- Twitch OAuth client credentials must remain server-side;
- the documented rate limit is four requests per second with up to eight
  concurrent requests and at most 500 results in one request;
- browser-direct use is not appropriate;
- duration coverage varies and every duration field is nullable;
- there is no reliable structured difficulty field;
- themes and keywords are not a dependable normalized mood taxonomy;
- external store identifiers do not establish current price, regional
  availability, or subscription entitlement;
- commercial/monetized use requires following IGDB's current partnership and
  attribution terms.

## 3. Capability assessment

The product scope is defined in the
[product requirements](product-requirements.md). This table records why the
provider supports or blocks each data-dependent decision.

| Capability | Decision | Provider evidence or limitation |
| --- | --- | --- |
| Core catalog filters | Use | IGDB has names, genres, platforms, releases, ratings, and modes. |
| Campaign duration | Use as nullable | Time-to-beat exposes fast, normal, and completionist values with uneven coverage. |
| Images | Use as nullable | Covers and screenshots are available but not guaranteed. |
| Themes | Detail only | Taxonomy exists but does not reliably represent subjective mood. |
| Difficulty | Exclude | No dependable normalized field. |
| Subscriptions | Exclude | External identifiers do not prove current catalog entitlement. |
| Prices and regional availability | Exclude | No suitable fresh cross-platform source in the selected provider. |
| Portuguese catalog text | Do not promise | Localized source coverage is not guaranteed. |
| Steam community tags | Exclude | Not a normalized cross-platform IGDB contract. |

## 4. Alternatives considered

### RAWG

Official resources:

- <https://rawg.io/apidocs>
- <https://api.rawg.io/docs/>
- <https://rawg.io/tos_api>

RAWG exposes useful catalog search, genres, platforms, dates, ratings, images,
tags, and store links. Its `playtime` value is not a campaign-duration measure.
At research time, its pricing page and API terms presented differing commercial
conditions. It should not be adopted commercially without written clarification.

### Steam

Official resources:

- <https://partner.steamgames.com/doc/webapi/IStoreService>
- <https://partner.steamgames.com/doc/webapi_overview>
- <https://steamcommunity.com/dev/apiterms>

Steam can help map Steam application IDs, but it is not a multi-platform
catalog. The publicly documented Web API does not provide the complete
cross-platform catalog search and detail contract required by this MVP. Common
undocumented Store endpoints must not become a production dependency.

### Giant Bomb

- <https://www.giantbomb.com/api/>
- <https://www.giantbomb.com/terms-of-service>

Its commercial permission requirements and smaller advantage over IGDB do not
justify an additional MVP provider.

## 5. Source-specific launch checks

The complete release gate is maintained in the
[product requirements](product-requirements.md#6-release-gates). Its
source-specific evidence must include written IGDB usage confirmation, the
implemented attribution, reviewed image/text terms, and a launch-date recheck
of limits, schema changes, deprecations, and terms.
