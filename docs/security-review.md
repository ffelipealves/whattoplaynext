# Security Review

Status: completed for Milestone 4.8 on 2026-09-27
Scope: the web application, the API, their generated contract, and their
dependencies, before closed-beta traffic

This review records what was checked, what was changed, and which risks are
accepted and why. It is an engineering review, not a penetration test or a
legal assessment. The binding requirements are NFR-015 through NFR-023 in the
[product requirements](product-requirements.md).

## 1. Trust boundaries

```text
Visitor's browser ──HTTPS──► hosting proxy ──► Next.js server ──► FastAPI ──► IGDB / Twitch
                                                   │                 │
                                                   └── never ────────┘  Redis (cache, counters)
```

- The browser never calls the API. Every API call comes from the Next.js
  server, so the browser receives no API origin, token, or credential.
- The Next.js server forwards a visitor's address only with the edge token,
  and the API trusts the address only when the token matches
  ([architecture §8.1](architecture.md#81-rate-limiting)).
- Only the API holds Twitch credentials. Redis stores digests, response
  payloads, and counters, never an address or a secret.

## 2. Controls verified

| Control                                    | Evidence                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API security headers on every response     | `test_security.py`: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `nosniff`, `no-referrer`, `DENY`, `Cross-Origin-Resource-Policy: same-origin`, and a default `Cache-Control: no-store` on 200, 404, 422, and 500 responses. HSTS is sent only in production.                                       |
| No CORS allowance                          | A cross-origin preflight gets `405` and a cross-origin read gets no `Access-Control-*` header at all.                                                                                                                                                                                                                         |
| Only `GET`                                 | `POST`, `PUT`, `PATCH`, and `DELETE` get `405 METHOD_NOT_ALLOWED`.                                                                                                                                                                                                                                                            |
| Bounded input                              | Every parameter is typed, allow-listed, or length-bounded, and unknown parameters are rejected. M4.8 added a cap of 50 on each repeated filter. Routes read no request body, and Uvicorn bounds the request line and headers.                                                                                                 |
| No tracebacks                              | Settings refuse `debug` in production, because Starlette's debug mode answers an unexpected error with its traceback. Unexpected errors return the stable envelope and are logged by type and stack only.                                                                                                                     |
| No interactive documentation in production | `/docs`, `/redoc`, and `/openapi.json` answer `404` in production. The contract is exported without HTTP.                                                                                                                                                                                                                     |
| Secrets masked in configuration            | The Twitch secret, edge token, and HMAC key are `SecretStr`; `repr`, `str`, and JSON dumps of settings never contain them.                                                                                                                                                                                                    |
| Secrets and values absent from logs        | `test_observability.py`, plus a live run of the served app (see the [Milestone 4 plan](milestone-4-plan.md#m47--correlation-logs-health-and-metrics)).                                                                                                                                                                        |
| Web security headers                       | `security-headers.test.ts` and the `security.spec.ts` Playwright journey against the production build: CSP, `nosniff`, `DENY`, `strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy`, `Permissions-Policy`, and no `X-Powered-By`. HSTS and `upgrade-insecure-requests` are added only for an HTTPS site origin.    |
| CSP breaks nothing, and the check can fail | The journey visits five pages and fails on any CSP console violation. Removing `'unsafe-inline'` from `script-src` made five of its six tests fail, which confirms that it detects breakage.                                                                                                                                  |
| Edge token absent from browser bundles     | A production build with `WTPN_API_EDGE_TOKEN=SENTINEL-edge-9c1f7a` contained the sentinel nowhere in `.next`, and not even the variable's name in `.next/static`.                                                                                                                                                             |
| Generated contract                         | `openapi.json` and `schema.ts` mention no secret, token, Twitch, or IGDB field name. Their only “IGDB” mentions are two endpoint descriptions.                                                                                                                                                                                |
| Dependencies                               | `pnpm audit` found one high advisory, GHSA-2883-xcg3-v3hh in `js-yaml` 4.3.1, reached only by the development tool `openapi-typescript`, which parses this repository's own contract. It was fixed with a workspace override to ≥ 4.3.2, after which the audit was clean. `pip-audit` over the API environment found nothing. |

## 3. Defects found and fixed during Milestone 4

- A Twitch token failure escaped the transport unclassified and became
  `500 INTERNAL_ERROR`, bypassing the stale fallback (M4.6).
- Unexpected errors were not logged at all (M4.7).
- Uvicorn's access log printed client addresses and full query strings (M4.7).
- `500` responses skipped the security-header middleware, because Starlette's
  server-error handling sits outside every middleware; the handler now sets
  the headers itself (M4.8).

## 4. Accepted residual risks

1. **`script-src 'unsafe-inline'` and `style-src 'unsafe-inline'`.** The App
   Router streams inline bootstrap scripts. A nonce would force every page,
   including the prerendered information pages, to render per request. The
   exposure is limited: React escapes all rendered text, no page uses
   `dangerouslySetInnerHTML`, there are no third-party scripts, and
   `object-src`, `base-uri`, `form-action`, and `frame-ancestors` stay closed.
   Revisit if user-generated content or a third-party script is ever added.
   M4.9's Umami script will need its origin added to `script-src` and
   `connect-src`.
2. **One static edge token.** Rotating it means redeploying the web server and
   the API together, and it is a bearer secret rather than mutual TLS. A
   leaked token lets a direct caller choose its rate-limit identity. It still
   gives no data access and does not raise any budget.
3. **The API is publicly reachable** on the planned Render hosting. Direct
   callers are limited by their own address and cannot read more than the web
   application shows. Private networking would remove this, and it is part of
   the open deployment decision.
4. **Visitor address from the first `X-Forwarded-For` entry.** This is only as
   trustworthy as the proxy in front of the web server. Vercel and Caddy
   overwrite the header; Nginx must be configured to
   ([architecture §8.1](architecture.md#81-rate-limiting)).
5. **Shared budgets behind carrier-grade NAT** ([technical debt 4](technical-debt.md#4-the-api-has-no-rate-limiter-of-its-own--resolved-in-m45)).
6. **Process-local resilience state** ([technical debt 17](technical-debt.md#17-resilience-state-is-process-local)).
7. **No HSTS preload.** Preloading commits the final domain, which is not
   chosen yet.
8. **Dependency audits are manual.** Neither audit runs in CI yet. Adding
   `pnpm audit --prod` and `pip-audit` to the workflow is an engineering
   follow-up before public beta
   ([technical debt 20](technical-debt.md#20-dependency-audits-are-manual)).

## 5. Release-gate items for deployment

- Production Redis must require authentication and TLS (`rediss://`); the
  local Compose Redis binds only to loopback.
- The edge token and HMAC key must be generated per environment and differ
  between preview and production.
- `WTPN_ENVIRONMENT=production` must be set on the production API, because
  HSTS, the documentation switch-off, and the debug refusal depend on it.
- `WTPN_SITE_ORIGIN` must be the final `https://` origin, so the web
  application sends HSTS and `upgrade-insecure-requests`.
