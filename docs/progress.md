# Progress

Resume file for new sessions. Read this, then [PROJECT_SPEC.md](PROJECT_SPEC.md) Section 0 and the current phase's section, before doing anything.

## Current state

- **Current phase**: 3 complete, waiting for "continue" to start Phase 4.
- **Actual money spent**: $0.
- **Anything running**: one Docker container, `ecp-postgres` (PostgreSQL 17, port 127.0.0.1:5432, named volume `postgres-data`), started with `npm run db:up`. Nothing else. `npm run dev:api` starts the API on port 3000.
- **Anything deployed**: nothing. Terraform is written from Phase 8 and only ever validated.
- **Repository**: public at https://github.com/riodinho1/enterprise-cloud-platform, default branch `main`. Phase 3 pushed 2026-09-26.
- **Machine changes this session (2026-09-26)**: Docker Desktop installed by the owner (it must be started by hand; it does not auto-start). `C:\Users\HomePC\.wslconfig` created with `memory=4GB`, `processors=2`, `swap=1GB`; takes effect after `wsl --shutdown` and a Docker Desktop restart.
- **Dependabot**: the two Actions bumps were merged in Phase 2. The TypeScript 6.0.3 to 7.0.2 PR (#3) was parked on 2026-09-26 with `@dependabot ignore this minor version` because typescript-eslint 8.70.1 pins `typescript <6.1` and TypeScript 7.0 has no programmatic API; Dependabot will open a new PR at 7.1 (decision D15).

## Phase status

| # | Phase | Status | Session date |
|---|---|---|---|
| 1 | Environment inspection, requirements, architecture docs + diagrams | done | 2026-09-25 |
| 2 | Monorepo scaffold, lint/format/type-check, CI skeleton | done | 2026-09-25 |
| 3 | DB schema, migrations, auth, RBAC | done | 2026-09-26 |
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

Machine for every measurement: the laptop in [environment.md](environment.md) (i5-6300U, 7.9 GB RAM, Windows 11, Docker Desktop on WSL 2 capped at 4 GB).

| Component | Label now | Evidence |
|---|---|---|
| Monorepo tooling (lint, format, type-check, build) | TESTED | all pass, 2026-09-26 |
| `packages/shared` Zod schemas | TESTED | 4 Vitest tests pass |
| PostgreSQL 17 in Compose + Prisma 7 migrations (`users`, `refresh_tokens`, `audit_events`) | RUNS LOCALLY | `npm run db:up`, `npm run db:migrate`; two migrations applied to `ecp` and `ecp_test` |
| `audit_events` append-only trigger | TESTED | Vitest test plus a direct `psql` UPDATE/DELETE both rejected |
| Auth: register, login, refresh rotation + reuse detection, logout, `/auth/me` | RUNS LOCALLY + TESTED | 41 API tests pass in 25 s against real PostgreSQL (4 files: app, auth, admin, lib) |
| RBAC: `requireAuth`, `requireRole`, admin list/role/deactivate | TESTED | covered by the same suite: B2, B3, B4, A3 each have named tests |
| `/health`, `/ready` (database check with 2 s timeout) | TESTED | built server (`node dist/server.js`) answered 200 on both; 503 test with an unreachable database |
| Seed script (local admin) | RUNS LOCALLY | `npm run db:seed` created `admin@example.com` with role admin |
| CI workflow with PostgreSQL service container | TESTED | first run on GitHub-hosted Ubuntu passed all steps (run 36260934985, 2026-09-26, 53 s): lint, format, type-check, 45 tests against the service container, build |
| `apps/web` placeholder shell | RUNS LOCALLY (dev server only) | unchanged since Phase 2 |
| Everything else | NOT IMPLEMENTED | see phase table |

## Toolchain versions

Pinned 2026-09-25: TypeScript 6.0, ESLint 10 (typescript-eslint 8), Prettier 3.9, Vitest 5, Vite 8, React 19.3, Tailwind 4.3, Express 5.2, Zod 4.6, Node 22 (`.nvmrc`).

Added 2026-09-26: Prisma 7.10.0 (`prisma`, `@prisma/client`, `@prisma/adapter-pg`; pinned because the npm `latest` tag pointed at 8.0.0-rc.17), `@node-rs/argon2` 2.2, `jose` 6.2, `pino` 10.3 + `pino-http` 11, `helmet` 8.3, `cors` 2.8, `express-rate-limit` 8.7, `cookie-parser` 1.4, PostgreSQL image `postgres:17-alpine`. `npm audit`: 0 vulnerabilities.

## Decisions approved by the owner

All recorded with reasons in [architecture.md](architecture.md) Section 11.

- 2026-09-25: SeaweedFS for object storage, Garage as fallback (D1).
- 2026-09-25: downloads streamed through the API after an ownership check (D2).
- 2026-09-25: Postgres job table as the queue, no Redis (D3).
- 2026-09-25: ClamAV as an opt-in Compose profile (D4).
- 2026-09-25: checkov in GitHub Actions only, never locally; Trivy + tflint locally (D5).
- 2026-09-25: git identity set per-repo to `Raymond Okoche Adrian <166107642+riodinho1@users.noreply.github.com>`.
- 2026-09-26: stay on TypeScript 6 until typescript-eslint supports 7 (D15). Owner approved parking the Dependabot PR.
- 2026-09-26: D9 (role enum instead of a `roles` table), D10 (family revocation on reuse), D11 (re-read user on every request), D12 (409 on duplicate email), D13 (audit trigger), D14 (Prisma 7.10.0 pin). Made during Phase 3, approved by the owner the same day.

## Phase 3 engineering notes

- **Prisma 7 layout**: the connection URL lives in `apps/api/prisma.config.ts`, not in `schema.prisma`. The client is generated as TypeScript into `apps/api/src/generated/` (git-ignored) with `.js` import extensions so plain `tsc` compiles it into `dist/`. Every root script that needs it runs `npm run db:generate` first (`prepare:ts`).
- **One `.env` at the repository root**. `loadDotEnv()` in `config.ts` and the same logic in `prisma.config.ts` read it only when `DATABASE_URL` is not already set, so Docker and CI inject the environment and the file is ignored.
- **Tests use a second database** (`ecp_test`, created by `docker/postgres/init/01-test-database.sql` on the first start of the volume). `vitest` global setup runs `prisma migrate deploy` against `TEST_DATABASE_URL`, refuses any database name that does not end in `_test`, and tests truncate the tables between cases. Test files run serially (`fileParallelism: false`) because they share that database.
- **The refresh cookie path is `/api/auth`**, the browser-visible path through the Vite proxy and nginx, not the API's own `/auth`. Configurable with `REFRESH_COOKIE_PATH`.
- **Order of checks on refresh**: unknown token, deactivated user (403, no reuse alarm, because deactivation itself revoked the tokens), reused token (revoke family, 401), expired (401), then rotate. The test suite caught the original ordering, which raised a false reuse alarm after an admin deactivation.
- **`req.params` is `string | string[] | undefined` in Express 5 types**, so IDs are parsed as `unknown` through a Zod UUID schema and any failure is a 404.
- **`@node-rs/argon2` exports a const enum** that `verbatimModuleSyntax` forbids importing; argon2id is the library default so the option is simply omitted and a test asserts the `$argon2id$` prefix.
- **Rate limiter state is in-process memory.** Two API containers would each allow the full quota. Noted for Phase 5; the AWS design puts the WAF rate rule in front.
- **Commit hygiene**: `.env`, `apps/api/src/generated/` and `dist/` are ignored and were verified absent from the commit.

## Files added or changed in Phase 3

| Path | Purpose |
|---|---|
| compose.yaml | PostgreSQL 17 service, loopback-only port, healthcheck, 512 MB limit, init scripts |
| docker/postgres/init/01-test-database.sql | creates `ecp_test` on first start |
| .env.example | database, JWT, cookie, rate-limit and seed variables with generation commands |
| apps/api/prisma.config.ts | Prisma 7 config: schema path, migrations path, seed command, datasource URL |
| apps/api/prisma/schema.prisma | `User`, `RefreshToken`, `AuditEvent`, `Role` and `AuditResult` enums |
| apps/api/prisma/migrations/20260926000518_init | tables, indexes, foreign keys |
| apps/api/prisma/migrations/20260926000600_audit_append_only | trigger rejecting UPDATE/DELETE on `audit_events` |
| apps/api/prisma/seed.ts | local admin upsert from `SEED_ADMIN_*`; refuses in production |
| apps/api/src/config.ts | extended env schema; `loadDotEnv()` |
| apps/api/src/db.ts | `createDb()` with the pg driver adapter; `isUniqueViolation()` |
| apps/api/src/version.ts | `APP_VERSION` (moved out of app.ts to avoid a circular import) |
| apps/api/src/lib/errors.ts | `HttpError` |
| apps/api/src/lib/password.ts | argon2id hash/verify, dummy hash for constant-time unknown-user checks |
| apps/api/src/lib/tokens.ts | `AccessTokens` (HS256 JWT sign/verify), refresh token generation and hashing |
| apps/api/src/lib/audit.ts | `recordAudit()` with IP and user agent; action names |
| apps/api/src/middleware/logging.ts | pino logger with redaction; pino-http with request IDs |
| apps/api/src/middleware/validate.ts | `validateBody(schema)` |
| apps/api/src/middleware/auth.ts | `requireAuth`, `requireRole`, `currentUser`, public user projection |
| apps/api/src/middleware/error-handler.ts | 404 handler and the single error formatter |
| apps/api/src/middleware/rate-limit.ts | auth rate limiter (429 in the shared error shape) |
| apps/api/src/routes/health.ts | `/health` and `/ready` |
| apps/api/src/routes/auth.ts | register, login, refresh, logout, me |
| apps/api/src/routes/admin.ts | list users, change role, deactivate |
| apps/api/src/app.ts, server.ts | middleware stack; startup with dotenv, logger, database, graceful shutdown |
| apps/api/src/test/global-setup.ts, helpers.ts | migrate the test database; app/session helpers |
| apps/api/src/*.test.ts (4 files) | 41 tests |
| apps/api/tsconfig.typecheck.json | type-checks tests, seed and config files too |
| .github/workflows/ci.yml | PostgreSQL service container, per-run JWT secret |
| docs/auth.md | the Phase 3 explainer |
| docs/architecture.md, docs/glossary.md, docs/environment.md, README.md | decisions D9–D15, five new terms, machine changes, status |

## Next session: Phase 4 plan

1. Prisma models and migration: `documents` (owner, storage key, original name, size, MIME, checksum, scan status, timestamps, soft delete), `folders`, `tags`, `document_tags`.
2. Add SeaweedFS to `compose.yaml` (S3 API, SIMULATED for Amazon S3), a bucket init step, and `S3_*` variables in `.env.example`. Confirm the image and licence again at session start (checked 2026-09-25).
3. Upload: streaming multipart with a size limit, magic-byte type allow-list (`file-type`), sanitised original name, random storage key, SHA-256 checksum, status `PENDING_SCAN`. Requirement B5 tests: oversized, disallowed, disguised.
4. Download streamed through the API after the ownership check (D2); 404 for another user's document (D8). Requirement B1 tests including guessed IDs.
5. Metadata, list with search and filters, folders, tags, soft delete. Audit `UPLOAD`, `DOWNLOAD`, `DELETE`.
6. `/ready` gains a storage check; test both dependencies down.
7. Keep the API and its tests running against the same Compose services; CI gets a SeaweedFS service container or a skip for storage tests (decide at session start).

## Open questions

- Whether CI should run storage tests against a SeaweedFS service container in Phase 4 or defer them to Phase 5.
