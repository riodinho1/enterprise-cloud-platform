# Progress

Resume file for new sessions. Read this, then [PROJECT_SPEC.md](PROJECT_SPEC.md) Section 0 and the current phase's section, before doing anything.

## Current state

- **Current phase**: 4 complete, waiting for "continue" to start Phase 5.
- **Actual money spent**: $0.
- **Anything running**: two Docker containers from `compose.yaml`, started with `npm run db:up`: `ecp-postgres` (PostgreSQL 17, 127.0.0.1:5432, volume `postgres-data`) and `ecp-seaweedfs` (SeaweedFS 4.47 `mini`, S3 API on 127.0.0.1:8333, volume `seaweedfs-data`). `npm run dev:api` starts the API on port 3000.
- **Anything deployed**: nothing. Terraform is written from Phase 8 and only ever validated.
- **Repository**: public at https://github.com/riodinho1/enterprise-cloud-platform, default branch `main`. Phase 4 pushed 2026-09-26.
- **Machine**: Docker Desktop installed 2026-09-26 (must be started by hand). `C:\Users\HomePC\.wslconfig` caps WSL at 4 GB, 2 processors, 1 GB swap. With both containers running Docker reports 4.1 GB total for the VM.
- **Dependabot**: the TypeScript 7.0 PR is parked (`ignore this minor version`); a 7.1 PR will appear when typescript-eslint supports it (D15). The `docker` block in `.github/dependabot.yml` can now be enabled to track the `postgres` and `chrislusf/seaweedfs` tags.

## Phase status

| # | Phase | Status | Session date |
|---|---|---|---|
| 1 | Environment inspection, requirements, architecture docs + diagrams | done | 2026-09-25 |
| 2 | Monorepo scaffold, lint/format/type-check, CI skeleton | done | 2026-09-25 |
| 3 | DB schema, migrations, auth, RBAC | done | 2026-09-26 |
| 4 | Document management + object storage + ownership enforcement | done | 2026-09-26 |
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
| PostgreSQL 17 in Compose + Prisma 7 migrations (users, refresh tokens, audit, documents, folders, tags) | RUNS LOCALLY | three migrations applied to `ecp` and `ecp_test` |
| `audit_events` append-only trigger | TESTED | Vitest test plus a direct `psql` UPDATE/DELETE both rejected |
| Auth, RBAC, admin routes (Phase 3) | RUNS LOCALLY + TESTED | see auth.md; covered in the 69-test API suite |
| SeaweedFS 4.47 behind the S3 API | SIMULATED, RUNS LOCALLY | stand-in for Amazon S3; SDK round trip verified, wrong credentials rejected with `InvalidAccessKeyId` |
| Upload: streamed, size-limited, magic-byte checked, sanitised name, random key, SHA-256 | RUNS LOCALLY + TESTED | B5 tests: `.exe` rejected, PNG-as-PDF rejected with the detected type, binary-as-text rejected, oversized 413 with nothing left behind |
| Ownership enforcement | TESTED | B1 test: user B gets 404 on get, download, rename and delete of user A's document for the real ID, a random ID and a malformed ID; A's row is untouched |
| Download streamed after the ownership check | RUNS LOCALLY + TESTED | bytes identical, `Content-Disposition` with UTF-8 filename, audit row; also verified with curl against the compiled server |
| Folders, tags, search, paging, soft delete | RUNS LOCALLY + TESTED | folders.test.ts and documents.test.ts |
| `/ready` (database and storage, 2 s timeout each) | TESTED | 200 with both up; 503 naming the failed dependency for each one down |
| API test suite | TESTED | 69 tests in 7 files pass against real PostgreSQL and SeaweedFS in about 40 s (API workspace alone) |
| CI with both services from `compose.yaml` | TESTED | first run on GitHub-hosted Ubuntu passed every step (run 36265286881, 2026-09-26, 82 s): compose up, lint, format, type-check, 73 tests, build |
| `apps/web` placeholder shell | RUNS LOCALLY (dev server only) | unchanged since Phase 2 |
| Malware scanning | NOT IMPLEMENTED | `MALWARE_SCAN=off` marks uploads CLEAN (D16); Phase 7 |
| Everything else | NOT IMPLEMENTED | see phase table |

## Toolchain versions

Pinned 2026-09-25: TypeScript 6.0, ESLint 10 (typescript-eslint 8), Prettier 3.9, Vitest 5, Vite 8, React 19.3, Tailwind 4.3, Express 5.2, Zod 4.6, Node 22 (`.nvmrc`).

Added 2026-09-26 (Phase 3): Prisma 7.10.0, `@node-rs/argon2` 2.2, `jose` 6.2, `pino` 10.3 + `pino-http` 11, `helmet` 8.3, `cors` 2.8, `express-rate-limit` 8.7, `cookie-parser` 1.4, `postgres:17-alpine`.

Added 2026-09-26 (Phase 4): `@aws-sdk/client-s3` and `@aws-sdk/lib-storage` 3.1141, `file-type` 22.1, `busboy` 1.6, `chrislusf/seaweedfs:4.47` (Apache 2.0, image dated 2026-09-14). `npm audit`: 0 vulnerabilities.

## Decisions approved by the owner

All recorded with reasons in [architecture.md](architecture.md) Section 11.

- 2026-09-25: D1 SeaweedFS, D2 streamed downloads, D3 Postgres job queue, D4 ClamAV opt-in, D5 checkov in CI only, per-repo git identity.
- 2026-09-26: D9–D14 (Phase 3 design choices) and D15 (stay on TypeScript 6) approved by the owner.
- 2026-09-26, made by Claude during Phase 4 and **awaiting owner review**: D16 (`MALWARE_SCAN=off` marks uploads CLEAN until Phase 7), D17 (flat folders, delete un-files), D18 (SeaweedFS `mini` 4.47, env-var admin identity, CI uses the same Compose file), D19 (stored MIME is the proven type; text is validated heuristically), D20 (streaming upload with a 64 KB peek).

## Phase 4 engineering notes

- **Streaming upload pipeline**: busboy parses the multipart body; the first 64 KB are peeked for magic-byte detection (Office files need more than the usual 4 KB); the bytes then flow through a SHA-256 transform into the SDK's multipart uploader. Size is enforced by a `Content-Length` precheck and busboy's hard limit, and a truncated upload deletes its object.
- **busboy decodes filenames as Latin-1 by default.** The download test with `Résumé.pdf` caught it; `defParamCharset: 'utf8'` fixes it. Worth remembering for any future multipart endpoint.
- **SeaweedFS `mini` flags**: `-s3.createBuckets` does not exist in `mini` mode (it printed usage and exited 2). Buckets are created by the API's `ensureBucket()` at startup and by the test global setup. The S3 gateway answers `GET /healthz` with 200, which is the Compose healthcheck.
- **AWS SDK checksums**: the SDK now sends CRC32 trailers by default; `requestChecksumCalculation: 'WHEN_REQUIRED'` keeps self-hosted S3 servers happy.
- **Ownership lives in `lib/documents.ts`**, never in route handlers, per architecture.md section 7. Malformed IDs are parsed as `unknown` and answer 404.
- **`.env` now has nine more lines** (S3, upload, scan). `db:up` starts both services; the test setup refuses a bucket name that does not end in `-test` and empties it before each run.
- **CI**: GitHub service containers cannot take a `command`, so the job runs `docker compose up -d --wait` with the same `compose.yaml` as the laptop. Throwaway credentials are derived from the run ID; the JWT secret is generated per run.
- **Commit hygiene**: `.env`, `apps/api/src/generated/` and `dist/` are ignored and verified absent from the commit.

## Files added or changed in Phase 4

| Path | Purpose |
|---|---|
| compose.yaml | SeaweedFS `mini` service (S3 on 127.0.0.1:8333, healthcheck, 512 MB limit); `db:up` starts both services |
| .env.example | `S3_*`, `TEST_S3_BUCKET`, `UPLOAD_MAX_BYTES`, `MALWARE_SCAN` |
| apps/api/prisma/schema.prisma, migrations/20260926185007_documents | `Document`, `Folder`, `Tag`, `DocumentTag`, `ScanStatus` |
| packages/shared/src/documents.ts | upload allow-list, folder/document/list schemas, response types |
| apps/api/src/config.ts | storage, upload and scan settings |
| apps/api/src/lib/storage.ts | `Storage` interface over the S3 SDK: streamed put, get, delete, ensureBucket, ping, emptyBucket |
| apps/api/src/lib/uploads.ts | `sanitizeFilename`, `checkFileType`, `peekStream`, `digestStream` |
| apps/api/src/lib/documents.ts | owner-scoped data access: find, list/search/page, tags, soft delete |
| apps/api/src/routes/documents.ts | upload, list, get, patch, delete, download |
| apps/api/src/routes/folders.ts | folders and tags routers |
| apps/api/src/routes/health.ts, app.ts, server.ts | storage in readiness, router wiring, bucket check at startup |
| apps/api/src/test/helpers.ts, global-setup.ts | test storage, fixtures (PDF, PNG, text bytes), upload helper, bucket reset |
| apps/api/src/routes/documents.test.ts, folders.test.ts, lib/uploads.test.ts | 28 new tests |
| .github/workflows/ci.yml | services from compose.yaml, logs on failure |
| docs/documents.md | the Phase 4 explainer |
| docs/architecture.md, docs/glossary.md, docs/environment.md, README.md | D16–D20, three new terms, SeaweedFS confirmed, status |

## Next session: Phase 5 plan

1. Dockerfiles: `apps/api` (multi-stage, non-root, `node dist/server.js`, `prisma migrate deploy` on start or as a one-shot service) and `apps/web` (Vite build into `nginx:alpine` with `/api/*` proxied to the API, per D7).
2. `compose.yaml`: `web` (published 8080), `api` (not published), `postgres` and `seaweedfs` (no published ports in the default profile; a `dev` profile keeps the loopback ports for `npm run dev:api` and tests). Networks: `edge` (web, api), `data` (api, postgres, seaweedfs). Prove that `web` cannot reach `postgres`.
3. The API's `TRUST_PROXY=1` behind nginx; `REFRESH_COOKIE_PATH` stays `/api/auth`; `S3_ENDPOINT=http://seaweedfs:8333`; `CORS_ORIGIN` for the dev server only.
4. One command starts the stack; a seed step; `docs/networking.md` first draft with the segmentation diagram and a table of what can talk to what, tested with `docker compose exec`.
5. Decide whether the API tests keep using loopback ports (dev profile) or run inside the network. Recommendation: keep loopback for developer speed.
6. Measure container memory with both stacks running and record it in environment.md against the 4 GB WSL cap.

## Open questions

- Owner review of decisions D16–D20 (made during Phase 4, listed above).
- Whether to enable Dependabot's `docker` block now that two images are pinned.
