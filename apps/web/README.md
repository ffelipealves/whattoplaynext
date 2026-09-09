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

## Checks

```bash
pnpm lint:web
pnpm typecheck:web
pnpm test:web
pnpm build:web
```

Run these commands from the repository root. `pnpm check` runs the complete
web and API quality gate.
