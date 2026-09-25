# Contributing

This is a personal portfolio project, so contributions are mostly future me. The rules below keep the history readable and the status labels honest.

## Setup

```bash
npm ci
npm run lint
npm run typecheck
npm test
```

Node 22 or newer (see `.nvmrc`). No Python anywhere in the project.

## Commits

Conventional commits, one logical change per commit:

```
type(scope): short summary in the imperative

Optional body explaining why, not what.
```

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `build`, `infra`. Scopes: `api`, `web`, `shared`, `compose`, `terraform`, `ci`, `docs`, or a phase such as `phase-3`.

## Rules that never bend

- Nothing that costs money or needs a cloud account. Terraform is validated, never planned or applied.
- No secrets in git. `.env` is ignored; `.env.example` documents every variable.
- Every claim in the docs carries one of the status labels from `CLAUDE.md`: RUNS LOCALLY, TESTED, SIMULATED, DESIGNED / NOT DEPLOYED, NOT IMPLEMENTED.
- Lint, type-check and tests pass before a commit lands on `master`.

## Pull requests

CI must be green. Describe what changed and which status labels moved.
