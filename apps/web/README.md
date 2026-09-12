# What To Play Next — Web

The public web application uses Next.js App Router, strict TypeScript, and
Tailwind CSS. English is the default locale and Brazilian Portuguese is the
secondary locale.

## Development

```bash
pnpm dev:web
```

Open <http://localhost:3000/en>. The root route redirects to the English page;
the Portuguese foundation is available at <http://localhost:3000/pt-br>.

Copy `.env.example` to `.env.local` when overriding local configuration. Every
`NEXT_PUBLIC_` value is visible to browsers and must not contain a credential.
`NEXT_PUBLIC_API_BASE_URL` is the API origin; generated endpoint paths already
contain the `/api/v1` prefix.

## API client and design system

`src/lib/api-client.ts` is the only place that constructs a client from the
generated `@whattoplaynext/contracts` package; feature code calls
`getApiClient()` rather than importing `openapi-fetch` or hand-writing
request/response types. `src/components/ui/` holds shadcn/ui primitives
(button, input, select, checkbox, slider, sheet, badge, skeleton) themed
through the CSS variables in `globals.css`, which reuse this project's own
brand palette rather than shadcn's generic defaults.

The home page proves this wiring end to end: it fetches filter metadata on
the server and renders "Live catalog: N platforms · N genres · N modes" next
to the primary action. Stop the local API and reload to see the documented
failure state instead — "Catalog temporarily unavailable" — rather than a
crashed page; `getCatalogStatus()` treats both a classified API error and a
rejected fetch (API process unreachable) as the same graceful "unreachable"
state.

## Checks

```bash
pnpm lint:web
pnpm typecheck:web
pnpm test:web
pnpm build:web
```

Run these commands from the repository root. `pnpm quality` runs the complete
web, API, and contracts quality gate; `pnpm check` is an alias.
