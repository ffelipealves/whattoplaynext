# Closed-Beta Deployment Runbook

Status: prepared on 2026-10-05; nothing has been deployed yet.

This runbook brings up the closed-beta environment decided in
[architecture §12](architecture.md#12-deployment): the web application on
Vercel Hobby, the API on Render Free, the cache and rate-limit counters on
Upstash Redis Free, and analytics on Umami Cloud. The API's service definition
is [`render.yaml`](../render.yaml); the Vercel settings are recorded below,
because Vercel keeps them in the project rather than in the repository.
Secrets live only in the provider dashboards, never in Git.

## 1. Before starting

- Sign in to Vercel, Render, Upstash, and Umami Cloud with the GitHub account
  that owns the repository.
- Reuse the Twitch client ID and secret from `apps/api/.env`. Generating a new
  secret in the Twitch console invalidates the one used locally.
- Generate the edge token the web server and the API share, and keep it only
  until both dashboards have it:

  ```bash
  openssl rand -base64 32
  ```

The order matters: Render needs the Redis URL, Vercel needs the API's URL at
build time, and Umami needs the site's domain.

## 2. Provisioning

### 2.1 Upstash Redis

1. Create a Redis database in `us-east-1` on the Free plan, with TLS on.
2. In its settings, turn **Eviction** on, so that writes evict old entries at
   the 256 MB limit instead of failing
   ([technical debt 21](technical-debt.md#21-redis-production-policy-still-needs-verification)).
3. Copy the Redis protocol URL, `rediss://default:…@…:6379`, not the REST URL.

### 2.2 Render API

1. **New → Blueprint**, select the repository. Render reads `render.yaml`.
2. Fill in the prompted values: `WTPN_EDGE_TOKEN` (the generated token),
   `WTPN_REDIS_URL` (the Upstash URL), and `WTPN_TWITCH_CLIENT_ID` and
   `WTPN_TWITCH_CLIENT_SECRET`. Render generates `WTPN_IDENTITY_HMAC_KEY`.
3. Wait for the first deploy and note the service URL, for example
   `https://whattoplaynext-api.onrender.com`.

Later commits to `main` that touch `apps/api` deploy after CI passes. The API
refuses to start in production without the edge token, the HMAC key, and the
proxy-hop count, so a missing value fails the deploy instead of running with
one shared rate-limit budget.

The start command runs Uvicorn directly. `fastapi run` and `fastapi dev`
import the application before Uvicorn configures its logging, which turns the
access log, with addresses and query strings, back on.

### 2.3 Vercel web application

1. **Add New → Project**, import the repository, and name the project; its
   domain is `https://<project>.vercel.app`.
2. Set **Root Directory** to `apps/web` and keep the detected Next.js preset
   and the default build and install commands. `pnpm install` runs at the
   workspace root and builds `packages/contracts` through its `prepare`
   script; the web's `build` script is `next build`.
3. Set the **Node.js version** to 22.x, matching `.node-version`.
4. Before the first build, add the environment variables:

| Variable                       | Environments        | Value                                                                                 |
| ------------------------------ | ------------------- | ------------------------------------------------------------------------------------- |
| `ENABLE_EXPERIMENTAL_COREPACK` | Production, Preview | `1`. Vercel itself provides pnpm only up to 10; Corepack installs the pinned pnpm 11. |
| `NEXT_PUBLIC_API_BASE_URL`     | Production, Preview | The Render service URL. Inlined at build time, so a change needs a redeploy.          |
| `WTPN_SITE_ORIGIN`             | Production, Preview | `https://<project>.vercel.app`. The build fails without it.                           |
| `WTPN_API_EDGE_TOKEN`          | Production          | The generated token, identical to the API's `WTPN_EDGE_TOKEN`.                        |
| `NEXT_PUBLIC_UMAMI_WEBSITE_ID` | Production          | Added in 2.4.                                                                         |

Previews get no edge token, so their visitors share one rate-limit budget;
that keeps the production secret out of branch builds. Vercel deploys every
push without waiting for CI, unlike Render.

5. After the deploy, confirm under **Settings → Functions** that the region
   is `iad1`, next to the API and Redis.

### 2.4 Umami Cloud

1. Add a website for `<project>.vercel.app` and copy its website ID into
   `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, then redeploy, since the value is inlined
   at build time.
2. Confirm that the plan keeps data for the six months the Privacy page
   states.

## 3. First-deploy verification

Run these once the three services are up, and record the results with the
date in the Milestone 5 review.

1. **Health.** `GET /api/v1/health` answers `{"status":"ok"}`, and
   `GET /api/v1/health/ready` answers `ready` with the cache `up` and the
   provider `closed`.
2. **Logs.** In Render's log view, every line is a JSON object. No line looks
   like `INFO: <address> - "GET …`.
3. **Rate-limit identity.** From your own machine, send 61 requests within a
   minute, each claiming a different address:

   ```bash
   API=https://<service>.onrender.com
   for i in $(seq 1 61); do
     curl -s -o /dev/null -w "%{http_code}\n" \
       -H "X-Forwarded-For: 203.0.113.$i" "$API/api/v1/filters"
   done | sort | uniq -c
   ```

   Expect 60 `200` and one `429`: the API counted your real address. If all
   61 succeed, the forged header chose the identity; set
   `WTPN_TRUSTED_PROXY_HOPS` to `0` and repeat. The test spends your own
   budget for a minute.

4. **Redis.** The Upstash console shows Eviction on. After some browsing,
   readiness still reports the cache `up`, and the logs have no
   `cache.unavailable` warning.
5. **Cold queries** ([technical debt 2](technical-debt.md#2-a-duration-filter-still-costs-seconds-while-its-shared-index-is-cold--partly-paid-on-2026-09-28)
   and [2b](technical-debt.md#2b-a-broad-platform-release-range-still-has-to-read-its-whole-index--partly-paid-on-2026-09-28)).
   Wake the API first so the wake-up is not counted, then time each shape
   twice, before anything else has cached it:

   ```bash
   curl -s -o /dev/null "$API/api/v1/health"
   for q in \
     "platform=nintendo-switch&genre=indie&minimumDurationHours=2&maximumDurationHours=10" \
     "platform=pc&releaseFrom=2020-01-01&releaseTo=2020-12-31"; do
     for run in cold warm; do
       curl -s -o /dev/null -w "$run %{http_code} %{time_total}s\n" \
         "$API/api/v1/games?$q"
     done
   done
   ```

   If the logs show `cache.unavailable` around the duration search, reading
   the 458,912 B index took longer than the 200 ms Redis timeout. Set
   `WTPN_CACHE_OPERATION_TIMEOUT_SECONDS=1` on Render and measure again.
   Record the numbers in technical debt 2 and 2b.

6. **Web.** Both locales load, a search runs, and a game page opens. The
   response carries the security headers:

   ```bash
   curl -sI https://<project>.vercel.app/en \
     | grep -i -E "content-security-policy|strict-transport-security"
   ```

   The browser console shows no CSP violation. If Umami's collector is on a
   different origin than its script, set `NEXT_PUBLIC_UMAMI_HOST_URL` to it
   and redeploy.

7. **Analytics.** A page view and a `search-submitted` event reach the Umami
   dashboard, and the request payloads in the browser's network panel carry
   only allow-listed properties.
8. **Wake-up.** After at least 15 minutes without traffic, time the first
   page load.
9. **Images.** The browser's network panel shows game images coming from
   `images.igdb.com` and no request to `/_next/image`, and Vercel's **Usage**
   shows no image transformations
   ([architecture §12](architecture.md#12-deployment)).

## 4. Still open before inviting testers

- The branded-browser pass against this deployment
  ([technical debt 14](technical-debt.md#14-no-retail-browser-has-been-checked--blocking-for-closed-beta)
  and the [browser release checklist](browser-release-checklist.md)).
- Telling testers that the first load after a quiet period can take up to a
  minute, and that a report about an error should include the “Reference” the
  page shows. Render keeps the API's logs for 7 days and Vercel keeps the
  web's runtime output for 1 hour
  ([architecture §11](architecture.md#11-observability)).

## 5. Rollback

- **API:** in Render, open **Events**, choose the last good deploy, and roll
  back to it.
- **Web:** in Vercel, open **Deployments**, choose the last good production
  deployment, and use **Instant Rollback**.
- **Redis** holds only disposable cache entries and counters. Emptying the
  database is safe, but every query is cold afterwards.

A rollback that changes the API contract needs both sides rolled back
together.

## 6. Secrets

| Secret                      | Where                                                  | Rotation                                                                                      |
| --------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Edge token                  | Render `WTPN_EDGE_TOKEN`, Vercel `WTPN_API_EDGE_TOKEN` | Generate a new one, set both, and redeploy both; until both match, visitors share one budget. |
| HMAC key                    | Render `WTPN_IDENTITY_HMAC_KEY`                        | Regenerate in Render. Only the current rate-limit counters are lost.                          |
| Redis URL                   | Render `WTPN_REDIS_URL`                                | Reset the password in Upstash and update Render.                                              |
| Twitch client ID and secret | Render `WTPN_TWITCH_CLIENT_*`                          | A new secret in the Twitch console invalidates the local one too.                             |
