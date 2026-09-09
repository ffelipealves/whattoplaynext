# What To Play Next — Web

The public web application uses Next.js App Router, strict TypeScript, and
Tailwind CSS. English is the default locale and Brazilian Portuguese is the
secondary locale.

## Development

```bash
pnpm --filter web dev
```

Open <http://localhost:3000/en>. The root route redirects to the English page;
the Portuguese foundation is available at <http://localhost:3000/pt-br>.

## Checks

```bash
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter web test
pnpm --filter web build
```
