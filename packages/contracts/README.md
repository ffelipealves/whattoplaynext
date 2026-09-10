# What To Play Next — Contracts

This workspace package is the typed seam between the FastAPI application and
TypeScript consumers. FastAPI remains the source of truth; do not edit
`openapi.json` or `src/schema.ts` by hand.

## Generate and verify

From the repository root:

```bash
pnpm contract:generate
pnpm contract:check
```

Generation imports the FastAPI application directly and does not start a server
or require Redis, Twitch, or IGDB. The check regenerates in memory and fails
when either committed artifact is stale.

## Use

```ts
import { createApiClient } from "@whattoplaynext/contracts";

const api = createApiClient("http://localhost:8000");
const { data, error } = await api.GET("/api/v1/health");
```

Endpoint paths include the `/api/v1` prefix, so the client base URL is the API
origin. The package also exports generated `paths`, `operations`, and
`components` types for consumers that need them.
