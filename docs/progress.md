# Progress

Resume file for new sessions. Read this, then [PROJECT_SPEC.md](PROJECT_SPEC.md) Section 0 and the current phase's section, before doing anything.

## Current state

- **Current phase**: 1 complete, waiting for "continue" to start Phase 2.
- **Actual money spent**: $0.
- **Anything running**: nothing. No Docker yet (install from Phase 5).
- **Anything deployed**: nothing. Terraform is written from Phase 8 and only ever validated.

## Phase status

| # | Phase | Status | Session date |
|---|---|---|---|
| 1 | Environment inspection, requirements, architecture docs + diagrams | done | 2026-09-25 |
| 2 | Monorepo scaffold, lint/format/type-check, CI skeleton | not started | |
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

| Component | Label now |
|---|---|
| Everything | DESIGNED / NOT DEPLOYED (docs only; no code exists yet) |

This table is rewritten at the end of each phase.

## Decisions approved by the owner

All recorded with reasons in [architecture.md](architecture.md) Section 11.

- 2026-09-25: SeaweedFS for object storage, Garage as fallback.
- 2026-09-25: downloads streamed through the API after an ownership check.
- 2026-09-25: Postgres job table as the queue, no Redis.
- 2026-09-25: ClamAV as an opt-in Compose profile.
- 2026-09-25: checkov in GitHub Actions only, never locally; Trivy + tflint locally.
- 2026-09-25: git identity set per-repo to `Raymond Okoche Adrian <166107642+riodinho1@users.noreply.github.com>`.

## Files that exist

| Path | Purpose |
|---|---|
| PROJECT_PROMPT.md | the original brief as pasted by the owner |
| CLAUDE.md | Section 0 rules, loaded by Claude Code every session |
| docs/PROJECT_SPEC.md | copy of the brief that the docs link to |
| docs/environment.md | machine, tool versions, install commands, storage image check |
| docs/requirements.md | functional, security-boundary and non-functional requirements with IDs |
| docs/architecture.md | both Mermaid diagrams, mapping table, components, flows, boundaries, failures, decisions |
| docs/glossary.md | every term used, with networking mappings |
| docs/progress.md | this file |
| .gitignore | minimal; expanded in Phase 2 |

## Next session: Phase 2 plan

1. `npm init -y` at the root with `workspaces: ["apps/*", "packages/*"]`.
2. `apps/api` (Express + TypeScript, tsx for dev, tsc for build), `apps/web` (Vite React TS + Tailwind), `packages/shared` (Zod schemas, types).
3. ESLint (flat config, typescript-eslint), Prettier, `tsc --noEmit` per workspace, root scripts `lint`, `typecheck`, `test`, `build`.
4. Repo hygiene: full `.gitignore`, `.editorconfig`, `.env.example`, MIT LICENSE, SECURITY.md, CONTRIBUTING.md, `.github/dependabot.yml`.
5. CI skeleton: `.github/workflows/ci.yml` running install, lint, typecheck, test, build with npm cache and concurrency. No secrets, no deploy.
6. README skeleton with the status table.
7. Tools needed: none beyond Node and npm.

## Open questions

- None. The Phase 1 questions (git identity, checkov) were answered on 2026-09-25.
