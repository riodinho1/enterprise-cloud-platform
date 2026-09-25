# Progress

Resume file for new sessions. Read this, then [PROJECT_SPEC.md](PROJECT_SPEC.md) Section 0 and the current phase's section, before doing anything.

## Current state

- **Current phase**: 2 complete, waiting for "continue" to start Phase 3.
- **Actual money spent**: $0.
- **Anything running**: nothing persistent. `npm run dev:api` starts the API on port 3000 for development.
- **Anything deployed**: nothing. Terraform is written from Phase 8 and only ever validated.

## Phase status

| # | Phase | Status | Session date |
|---|---|---|---|
| 1 | Environment inspection, requirements, architecture docs + diagrams | done | 2026-09-25 |
| 2 | Monorepo scaffold, lint/format/type-check, CI skeleton | done | 2026-09-25 |
| 3 | DB schema, migrations, auth, RBAC | not started | |
| 4 | Document management + object storage + ownership enforcement | not started | |
| 5 | Docker Compose environment with network segmentation | not started | |
| 6 | Frontend: auth, dashboard, documents, upload, admin | not started | |
| 7 | Audit logging + malware-scan background job | not started | |
| 8 | Terraform modules and environments (validate only) | not started | |
| 9 | Security hardening + assessment + scans | not started | |
| 10 | Full CI + designed deploy workflow | not started | |
| 11 | Monitoring, dashboards, alerts | not started | |
| 12 | Backup/restore, DR runbooks, failure simulations | not started | |
| 13 | Load testing, scalability, cost docs | not started | |
| 14 | Final docs, portfolio docs, senior-engineer review | not started | |

## Component status (Section 0.4 labels)

| Component | Label now | Evidence |
|---|---|---|
| Monorepo tooling (lint, format, type-check, build) | TESTED | all pass on the dev machine, 2026-09-25 |
| `packages/shared` Zod auth schemas | TESTED | 4 Vitest tests pass |
| `apps/api` `/health` and env validation | TESTED | 3 Vitest + Supertest tests pass; built server answered `curl /health` with 200 |
| `apps/web` placeholder shell | RUNS LOCALLY (dev server only) | `vite build` succeeds; no screens yet |
| CI workflow | DESIGNED / NOT DEPLOYED | written; runs only once the repo is pushed to GitHub |
| Everything else | NOT IMPLEMENTED | see phase table |

## Toolchain versions pinned on 2026-09-25

TypeScript 6.0, ESLint 10 (flat config via typescript-eslint 8), Prettier 3.9, Vitest 5, Vite 8, React 19.3, Tailwind 4.3, Express 5.2, Zod 4.6, Node 22 (`.nvmrc`). `npm audit` reported 0 vulnerabilities at install.

## Decisions approved by the owner

All recorded with reasons in [architecture.md](architecture.md) Section 11.

- 2026-09-25: SeaweedFS for object storage, Garage as fallback.
- 2026-09-25: downloads streamed through the API after an ownership check.
- 2026-09-25: Postgres job table as the queue, no Redis.
- 2026-09-25: ClamAV as an opt-in Compose profile.
- 2026-09-25: checkov in GitHub Actions only, never locally; Trivy + tflint locally.
- 2026-09-25: git identity set per-repo to `Raymond Okoche Adrian <166107642+riodinho1@users.noreply.github.com>`.

## Phase 2 engineering notes

- `packages/shared` is consumed as built output (`dist/`), so root `typecheck` and `test` build it first. Reason: the API runs as native ESM in Node, which cannot import `.ts` files from another package at runtime, and TypeScript project references would add complexity for one package.
- The API is native ESM (`"type": "module"`, `module: NodeNext`), so relative imports carry a `.js` extension. Reason: several libraries planned for later phases (`file-type` for magic bytes, for example) are ESM-only.
- Markdown is excluded from Prettier to avoid table-padding churn on every docs edit. Code is formatted.
- The Vite dev server proxies `/api/*` to the API and strips the prefix. nginx does the same in Docker (Phase 5) and the ALB path rule does the same in AWS, so the browser always sees one origin.
- CI skips runs for docs-only changes (`paths-ignore`). Trade-off: a docs-only PR shows no check, which is acceptable for this project.

## Files that exist

| Path | Purpose |
|---|---|
| package.json | workspace root, scripts, dev tooling |
| tsconfig.base.json | strict compiler options shared by every workspace |
| eslint.config.js, .prettierrc, .prettierignore | lint and format rules |
| .editorconfig, .gitattributes, .nvmrc | editor defaults, LF line endings, Node version |
| .gitignore, .env.example | ignore list, documented environment contract |
| LICENSE, SECURITY.md, CONTRIBUTING.md | MIT, reporting policy, commit conventions |
| .github/workflows/ci.yml | install, lint, format check, type-check, test, build |
| .github/dependabot.yml | weekly npm and Actions updates; docker and terraform blocks ready to enable |
| packages/shared/src/auth.ts | register and login Zod schemas, password bounds, roles |
| packages/shared/src/api.ts | `ApiError` and `HealthResponse` types |
| apps/api/src/config.ts | Zod-validated environment loader |
| apps/api/src/app.ts | `createApp()` factory so tests build the app without a port |
| apps/api/src/routes/health.ts | `GET /health` liveness |
| apps/api/src/server.ts | listener and SIGTERM handling |
| apps/web/src/App.tsx | placeholder shell that calls `/api/health` through the proxy |
| README.md | overview, status table, stack, setup |
| PROJECT_PROMPT.md, CLAUDE.md, docs/* | brief, rules, Phase 1 docs |

## Next session: Phase 3 plan

1. Prisma with PostgreSQL: `users`, `roles`, `refresh_tokens`, `audit_events` (documents/folders/tags in Phase 4). Migration checked in.
2. Postgres for tests: needs Docker (Phase 5 install) **or** a CI service container. Decide at session start; if Docker is not yet installed, Phase 3 can use `pg-mem` or be reordered after Phase 5. Recommendation: install Docker Desktop before Phase 3 so tests run against real Postgres locally.
3. Register, login, refresh (rotation with reuse detection), logout. argon2id hashing. Access JWT 15 min, refresh cookie 7 days, httpOnly, Secure, SameSite=Strict.
4. Middleware: request ID, pino, helmet, CORS (single origin), rate limiter on auth routes, Zod validation, consistent error handler.
5. RBAC middleware (`requireRole('admin')`), deactivated-user rejection, `/ready` checking the DB.
6. Tests for every endpoint and every boundary in requirements B2, B3, B4, plus deactivated users.
7. Add the Postgres service container to CI.

## Open questions

- Whether to install Docker Desktop before Phase 3 (recommended) so auth tests run against real Postgres. See Phase 3 plan item 2.
