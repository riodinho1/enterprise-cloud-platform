# Enterprise Cloud Infrastructure & Security Platform

A document management platform built to show how a serious company designs, secures, runs, monitors and maintains cloud infrastructure. Everything that runs, runs locally in Docker. The AWS architecture is written in Terraform, validated, and **not deployed**. Total spend so far: **$0**.

> Phase 3 of 14. Authentication, role-based access control and the database schema run locally against PostgreSQL in Docker, with 44 passing tests. There are no document features or frontend screens yet. See [docs/progress.md](docs/progress.md).

## Status

Labels are defined in [CLAUDE.md](CLAUDE.md) and used everywhere in this repository.

| Area | Status |
|---|---|
| Monorepo, lint, type-check, unit tests, CI skeleton | TESTED (44 tests pass on the dev machine) |
| PostgreSQL in Docker Compose, Prisma migrations, append-only audit table | RUNS LOCALLY |
| REST API: register, login, refresh rotation with reuse detection, logout, RBAC, admin user management, `/ready` | RUNS LOCALLY + TESTED (40 API tests against real PostgreSQL, dev machine) |
| REST API: documents, folders, tags, search | NOT IMPLEMENTED (Phase 4) |
| Frontend screens | NOT IMPLEMENTED (Phase 6) |
| Docker Compose stack with network segmentation | NOT IMPLEMENTED (Phase 5; only PostgreSQL is in Compose today) |
| Object storage (SeaweedFS, S3 API) | NOT IMPLEMENTED (Phase 4–5), will be SIMULATED |
| Malware scanning (ClamAV) | NOT IMPLEMENTED (Phase 7) |
| Terraform for AWS (VPC, ALB, Fargate, RDS, S3, IAM, CloudWatch) | NOT IMPLEMENTED (Phase 8), will be DESIGNED / NOT DEPLOYED |
| Monitoring (Prometheus, Grafana) | NOT IMPLEMENTED (Phase 11) |
| Backups, DR runbooks, failure simulations | NOT IMPLEMENTED (Phase 12) |
| Load tests, scalability and cost analysis | NOT IMPLEMENTED (Phase 13) |

## The problem

Companies handle files that must not leak. A document platform has to store them safely, let each person see only their own, let administrators manage accounts without quietly reading private files, and keep an audit trail that proves who did what. Building that properly touches identity, network segmentation, storage, background processing, monitoring, backups and cost. Full requirements: [docs/requirements.md](docs/requirements.md).

## Architecture

Two diagrams, the local-to-AWS mapping table, request flows, security boundaries and failure scenarios live in [docs/architecture.md](docs/architecture.md). In one paragraph: a three-tier design where an edge tier serves the static frontend and proxies the API, an application tier runs stateless API containers plus a background scan worker, and a data tier holds PostgreSQL for metadata and S3-compatible object storage for file bytes. Traffic flows only edge to app to data. Locally the tiers are separate Docker networks; in AWS they are public, private and isolated subnets with security groups.

## Stack and why

| Choice | Reason |
|---|---|
| TypeScript end to end, npm workspaces | one language, shared Zod schemas between API and UI, no Python anywhere |
| Express 5 on Node 22 | minimal, well understood, every security check lives server-side |
| React 19 + Vite 8 + Tailwind 4 | fast builds, static output that a CDN can serve |
| PostgreSQL 17 + Prisma 7 | relational integrity for ownership, versioned migrations, driver adapter instead of a bundled engine |
| argon2id, JWT (jose), rotating refresh cookies | see [docs/auth.md](docs/auth.md) for what each one defends against |
| SeaweedFS (S3 API) | maintained, Apache 2.0, the same SDK calls work against real S3 ([why not MinIO](docs/environment.md)) |
| Postgres job table as the queue | transactional with the data it protects, one fewer container |
| pino, prom-client, Prometheus, Grafana | structured logs and real metrics, concepts transfer to CloudWatch |
| Vitest, Supertest, Playwright, k6 | unit, API, end-to-end and load testing |
| Terraform (AWS provider) | reviewable infrastructure, validated only |

## Local setup

Requires Node 22 or newer and Docker Desktop (free for personal use, no account needed). Every example in this repository is one command per line so it works in Windows PowerShell 5.1 (which has no `&&`), Bash and cmd alike.

```powershell
npm ci
Copy-Item .env.example .env   # then set POSTGRES_PASSWORD, DATABASE_URL, TEST_DATABASE_URL, JWT_ACCESS_SECRET, SEED_ADMIN_PASSWORD
npm run db:up                 # PostgreSQL in Docker, bound to 127.0.0.1:5432 only
npm run db:migrate            # apply the Prisma migrations
npm run db:seed               # one local admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
npm run typecheck
npm test                      # API tests run against the separate ecp_test database
npm run dev:api               # http://localhost:3000/health and /ready
npm run dev:web               # in a second terminal: http://localhost:5173 (proxies /api to the API)
```

`npm run db:down` stops PostgreSQL; the data volume survives until you remove it. Every variable in `.env.example` is documented there and validated at startup.

## Repository layout

```
apps/api           Express API (TypeScript, ESM): auth, RBAC, admin, health; Prisma schema and migrations
apps/web           React + Vite + Tailwind frontend
packages/shared    Zod schemas and types used by both
docker/            init scripts for the local containers
compose.yaml       local services (PostgreSQL today; the full stack in Phase 5)
docs/              architecture, requirements, auth, glossary, progress, phase docs
.github/           CI workflow (with a PostgreSQL service container) and Dependabot
```

## Documentation

- [docs/architecture.md](docs/architecture.md): diagrams, components, flows, boundaries, failures, decisions
- [docs/requirements.md](docs/requirements.md): functional and non-functional requirements with IDs
- [docs/auth.md](docs/auth.md): password hashing, tokens, refresh rotation, RBAC, audit trail, rate limiting, endpoints
- [docs/glossary.md](docs/glossary.md): every term used, with networking mappings
- [docs/environment.md](docs/environment.md): development machine, tool versions, install commands
- [docs/design-direction.md](docs/design-direction.md): the visual rules every screen is checked against
- [docs/progress.md](docs/progress.md): phase status and how to resume
- [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE)

Sections on networking, monitoring, disaster recovery, load testing and cost are added in their phases and linked here.

## Lessons learned

_Left for the author to write at the end of the project._

## Future improvements

Tracked in [docs/progress.md](docs/progress.md) and filled in during the final review (Phase 14).
