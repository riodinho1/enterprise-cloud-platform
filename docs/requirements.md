# Requirements

Derived from [PROJECT_SPEC.md](PROJECT_SPEC.md) Sections 3, 5, 6 and 14. This is the checklist the code and the tests are held against. Status labels follow Section 0.4 of the spec.

## The problem

Companies handle files that must not leak: contracts, HR records, invoices. A document management platform has to store those files safely, let each person see only their own, let administrators manage accounts without quietly reading private files, and leave an audit trail that proves who did what. Building one properly touches every part of a cloud system: identity, network segmentation, storage, background processing, monitoring, backups and cost.

## Functional requirements

### Users

| ID | Requirement |
|---|---|
| U1 | Register with email and password. Passwords are hashed with argon2id. |
| U2 | Log in and receive a short-lived JWT access token plus a rotating refresh token in an httpOnly, Secure, SameSite cookie. |
| U3 | Log out, which revokes the refresh token. |
| U4 | Upload a document with size limit, magic-byte type check, sanitised filename and random storage key. |
| U5 | View document metadata (name, size, type, checksum, scan status, timestamps, folder, tags). |
| U6 | Download a document. The API streams it after an ownership check. |
| U7 | Delete a document (soft delete first). |
| U8 | Organise documents with folders and tags. |
| U9 | Search and filter their own documents. |
| U10 | Manage only their own documents. See boundary B1. |

### Admins

| ID | Requirement |
|---|---|
| A1 | List users. |
| A2 | Change a user's role. |
| A3 | Deactivate a user. Deactivated users are rejected on every request. |
| A4 | View the audit log. |
| A5 | Admins do not silently read private files. Any admin access to a document is a deliberate, separate action that is audited and documented. |

### Security boundaries

| ID | Boundary |
|---|---|
| B1 | User A can never list, view, download, rename or delete User B's documents, including by guessing IDs. |
| B2 | Non-admins are blocked from all admin routes. |
| B3 | Missing, invalid, expired or tampered tokens are rejected. |
| B4 | Reuse of a rotated refresh token is detected and the whole token family is revoked. |
| B5 | Uploads that are oversized, of a disallowed type, or disguised (extension does not match content) are rejected. |

### Background processing

| ID | Requirement |
|---|---|
| J1 | Every upload is queued for a malware scan and stays PENDING_SCAN until clean. |
| J2 | Infected files are quarantined, never downloadable, and the event is audited. |
| J3 | The queue is a Postgres job table claimed with `FOR UPDATE SKIP LOCKED`. No Redis. |

### Audit logging

| ID | Requirement |
|---|---|
| L1 | Record login success and failure, logout, registration, refresh failures, upload, download, delete, role changes, deactivation, and every admin action. |
| L2 | Each event stores actor, action, target, time, IP, user agent and result. |
| L3 | Never log passwords, tokens or file contents. |
| L4 | The audit table is append-only: no UPDATE or DELETE grants for the application role. |

## Non-functional requirements

| Area | Requirement |
|---|---|
| Budget | Actual spend is $0. Nothing billable is created. AWS exists only as validated Terraform. |
| Observability | Structured JSON logs with request IDs. `/health`, `/ready` (checks DB and storage), `/metrics` for Prometheus. Grafana dashboard provisioned from code. |
| Security | Helmet headers, CORS locked to the frontend origin, rate limiting on auth routes, Zod validation on every input, consistent error format. |
| Segmentation | The database is never reachable from the frontend container, locally or in the cloud design. |
| Reliability | Backup and restore scripts for Postgres and object storage, tested locally. Runbooks for DB, storage, deletion and leaked-credential incidents. |
| Reproducibility | One command starts the local stack. A seed script creates local-only demo users. |
| Testing | Unit, API, security-boundary and a few Playwright end-to-end tests. Real pass/fail counts are reported. |
| Documentation | Every major component answers: what, why, how, why chosen, what happens without it, how a real company uses it. |

## Environments

| Environment | Where | Status |
|---|---|---|
| Local | Docker Compose on the developer machine | RUNS LOCALLY (from Phase 5) |
| Dev / staging | Terraform, small sizes, single AZ allowed | DESIGNED / NOT DEPLOYED |
| Production | Terraform, two AZs, backups, deletion protection | DESIGNED / NOT DEPLOYED |

## Out of scope

- Real deployment to any cloud provider.
- Multi-tenant organisations or document sharing between users.
- Document previews, versioning of document contents, or full-text search inside files.
- Mobile apps.
