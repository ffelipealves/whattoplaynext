# Milestone 0 Review

Status: technical foundation accepted  
Reviewed: 2026-09-10  
Baseline commit: `88c8c24`

This review closes the repository-foundation portion of Milestone 0. It does
not claim that the owner actions or provider decisions tracked in
[External prerequisites](external-prerequisites.md) are complete.

## Acceptance result

| Criterion                                              | Result | Evidence                                                                                                                                                                                                             |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clean local setup from documented steps                | Pass   | A fresh local clone completed `pnpm setup` using only committed files.                                                                                                                                               |
| Applications build and test through the canonical gate | Pass   | The same fresh clone completed `pnpm quality`, including contract reproducibility, formatting, lint, static typing, coverage-enforced tests, and production builds.                                                  |
| CI quality gate exists and has executed successfully   | Pass   | `.github/workflows/ci.yml` runs the canonical `pnpm quality` command for pull requests, pushes to `main`, and manual dispatches; the M0.8 pipeline run was observed green.                                           |
| Secrets are absent from version control                | Pass   | The tracked-file inventory contains only `.env.example` files, populated environment paths are ignored, and a tracked-source scan found no known private-key, provider-secret, GitHub-token, or OpenAI-key patterns. |
| IGDB commercial uncertainty is visible                 | Pass   | The partnership request, attribution proposal, evidence checklist, and public-beta blocker are recorded in the external-prerequisites register.                                                                      |

The clean-clone validation ran without Twitch credentials, live IGDB access,
or Redis. This is intentional: automated foundation checks must be deterministic
and independent of external services.

## Quality evidence

The clean-clone `pnpm quality` run produced these results:

- generated OpenAPI and TypeScript contract artifacts were current;
- Prettier and Ruff formatting checks passed;
- ESLint, Ruff lint, TypeScript, and strict mypy checks passed;
- contracts: 1 test passed with 100% reported coverage;
- web: 1 test passed with 100% reported statement, function, and line coverage;
- API: 10 tests passed with 100% statement and branch coverage;
- the contracts package, Next.js application, and Python source/wheel packages
  built successfully;
- the quality command left the clean clone unchanged.

Coverage percentages describe the current small foundation surface. They are a
regression floor, not evidence that future product behavior is already tested.

## Deferred external actions

The following items are intentionally outside the technical closeout:

- **Product name and domain:** deferred until public-beta launch planning. The
  working name may continue in code and documentation in the meantime.
- **Twitch application:** required before the first manual M1 smoke test against
  live IGDB data. Credentials must remain server-side and outside Git.
- **IGDB partnership response:** required before public beta or monetized use;
  the prepared inquiry has not been sent.
- **Final IGDB attribution:** implemented only after the provider confirms the
  proposed wording and placement, and no later than public beta.

These deferrals do not block provider-independent M1 development with fixtures
and fakes. They do block the specific live or public activities stated above.

## M1 handoff

Milestone 1 can begin at the provider boundary defined by the hexagonal
architecture. The first vertical slice should implement Twitch token management
behind an outbound port with a fake adapter and deterministic tests before
introducing the live IGDB client.
