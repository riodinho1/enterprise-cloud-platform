# Enterprise Cloud Infrastructure & Security Platform — Claude Code Brief

You are acting as a senior cloud architect, DevOps engineer, cloud security engineer, and technical lead. I am Raymond Okoche Adrian, a Computer Science student and aspiring Cybersecurity & Software Engineer. I hold an Aptech certified networking certificate and have completed an Introduction to Cloud Computing certificate; I am now building toward cloud engineering and cloud security. My interests are cybersecurity, software engineering, Web3, blockchain, smart contract security, and AI. I have built and shipped Incentifi.fun (a Web3 token launch project) and FortyGuard AI (a geospatial intelligence platform analysing urban heat and environmental risk). I work in TypeScript/JavaScript and do not use Python. I want this project to show I can apply security thinking to cloud infrastructure. Do not use Python for application code, tooling, or scripts.

This will be the flagship cloud project on my GitHub and LinkedIn. The goal is not "a website hosted in the cloud." The goal is to show I understand how a serious company designs, secures, deploys, monitors, and maintains cloud infrastructure, and that I can explain every part of it.

Optimise for real understanding, real engineering, security, reproducibility, and honest documentation. Do not optimise for looking impressive. Every technology must have a reason to exist.

## 0. NON-NEGOTIABLE RULES (these override everything else)

### 0.1 Budget: $0, no credit card
- Nothing may create, require, or enable a billable resource.
- The AWS architecture (VPC, subnets, NAT gateway, load balancer, RDS, CloudFront/WAF, IAM, CloudWatch) is written as Terraform and labelled DESIGNED / NOT DEPLOYED. It is a validated blueprint, not a running system.
- Everything that actually runs, runs locally via Docker Compose.
- Do not suggest paying for anything or free tiers that need a credit card.
- If any step needs an account, API key, credit card, paid tier, or external credentials: STOP, explain the cost/risk, and ask me.

### 0.2 Cloud and Terraform safety
- Allowed: terraform fmt, terraform init -backend=false, terraform validate, and credential-free scanners (tflint, checkov, trivy config).
- NEVER run terraform plan, apply, or destroy.
- NEVER run aws configure, aws sso login, or anything that authenticates to a cloud provider. Never read ~/.aws or similar.
- Never delete files you did not create without asking me.

### 0.3 Secrets
- Never hardcode passwords, keys, tokens, or credentials.
- Use a git-ignored .env locally and provide .env.example with placeholders.
- Never commit .env, private keys, node_modules, build output, DB dumps, or uploaded test files.

### 0.4 Honesty — use exactly these status labels everywhere
- RUNS LOCALLY: implemented and running in Docker on my machine
- TESTED: covered by automated tests or measured (real numbers + the machine used)
- SIMULATED: local stand-in for a cloud service
- DESIGNED / NOT DEPLOYED: exists only as Terraform/docs
- NOT IMPLEMENTED: future work only
Never fabricate deployments, uptime, users, performance, scan results, or scalability claims.

### 0.5 Working style — one phase at a time
- Save this brief to docs/PROJECT_SPEC.md and put Section 0 into CLAUDE.md.
- One phase per session (roadmap in Section 13).
- End of each phase: run lint, type-check, tests; fix failures; update docs. Then STOP and give me: (1) what you built, (2) what each new file does, one line each, (3) three concepts I should understand, explained simply, (4) commands to run myself, (5) anything incomplete or uncertain.
- Wait for me to say "continue".
- Keep docs/progress.md updated so a new session can resume.
- Small, readable code. Comments only where they explain why.

## 1. FIRST: INSPECT THE ENVIRONMENT
- Check OS and versions of Node.js, npm, Docker, Docker Compose, Git, Terraform, and whether any cloud CLIs exist (report only; do not configure or log in).
- Inspect the folder; understand any existing files before changing anything.
- Report what's missing, how to install it (free tools only), and continue with what's possible.
Then give me: findings, proposed architecture, stack confirmation, roadmap. Then begin Phase 1.

## 2. TECHNOLOGY STACK (fixed — ask before changing)
TypeScript end to end.
- Monorepo: npm workspaces (apps/web, apps/api, packages/)
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express + TypeScript
- Validation: Zod, shared front and back
- Database: PostgreSQL; ORM/migrations: Prisma
- Object storage: open-source S3-compatible server in Docker (check current licensing/image availability first, tell me which and why)
- Auth: short-lived JWT access token + rotating refresh token in httpOnly Secure SameSite cookie; argon2 (or bcrypt) password hashing
- Logging: pino structured JSON with request IDs
- Metrics: prom-client → Prometheus → Grafana
- Tests: Vitest + Supertest; Playwright for key UI flows
- Load testing: k6
- IaC: Terraform, AWS provider
- CI: GitHub Actions (public repo)
- Diagrams: Mermaid in Markdown
No Python anywhere. If a tool is Python-only, choose an alternative or ask me.

## 3. THE APPLICATION — Document Management Platform
### 3.1 Features
Users: register, log in, log out, upload, view metadata, download, delete, organise with folders/tags, search, manage only their own documents.
Admins: list users, change roles, deactivate users, view audit log. Admins must not silently read users' private files; any admin access to documents must be deliberate, audited, and documented.
Core boundary: User A must never list, view, download, rename, or delete User B's documents, including by guessing IDs.

### 3.2 Frontend
Responsive professional UI: login/register, dashboard, document list with search/filters, upload with progress/validation, metadata view, admin pages, loading/error/empty states.

### 3.3 Backend
REST API: auth, authorisation middleware, document CRUD, validation, consistent error format, rate limiting on auth, helmet headers, CORS locked to frontend origin, structured logs, /health, /ready (checks DB + storage), /metrics.
Files go to object storage; DB holds metadata only. Downloads via short-lived pre-signed URLs or streamed after ownership check — pick one and explain the trade-off.
Uploads: size limit, type allow-list checked by magic bytes, sanitised names, random storage keys.

### 3.4 Background processing
Scan uploads with ClamAV in Docker as a background job. Documents stay PENDING_SCAN until clean; infected files are quarantined and audited. Use the simplest queue that works (Postgres job table is fine; Redis only if justified). If too heavy for my machine, tell me and mark it NOT IMPLEMENTED.

### 3.5 Data model
users, roles, refresh_tokens, documents (owner, storage key, original name, size, MIME, checksum, scan status, timestamps, soft delete), folders/tags, audit_events.

### 3.6 Audit logging
Record login success/failure, logout, registration, refresh failures, upload, download, delete, role changes, deactivation, all admin actions. Store actor, action, target, time, IP, user agent, result. Never log passwords, tokens, or file contents. Append-only.

## 4. ARCHITECTURE
Design cloud-agnostically first, then map to AWS.
Target flow: Internet → CDN + WAF → Load Balancer (public subnets) → App containers (private subnets) → PostgreSQL (isolated subnets) + object storage (private, encrypted). Plus secrets manager, central logs, metrics/alerts, backups, CI/CD, IaC.
Two Mermaid diagrams: (1) local Docker architecture, (2) AWS target architecture. Plus a table: local component → AWS equivalent → status.
docs/architecture.md: every component, why it exists, communication, request flow, data flow, security boundaries, failure scenarios, scaling. Code must match the diagram.

## 5. ENVIRONMENTS
- Local: Docker Compose. RUNS LOCALLY.
- Dev/Staging: Terraform config, small settings. DESIGNED / NOT DEPLOYED.
- Production: Terraform config, multi-AZ, backups, deletion protection. DESIGNED / NOT DEPLOYED.

## 6. CONTAINERISATION
Multi-stage Dockerfiles, non-root, minimal images, .dockerignore, healthchecks. docker-compose.yml with web, api, postgres, object storage, ClamAV (if feasible), Prometheus, Grafana. Separate Docker networks so the DB isn't reachable from the frontend — explain how this mirrors cloud subnets. One command to start everything; seed script with local-only demo users. Document why containers, service communication, every env var, common commands.

## 7. NETWORKING (docs/networking.md)
Terraform: VPC, public/private/isolated subnets across 2 AZs, route tables, internet gateway, NAT (explain cost and the VPC endpoint alternative for S3), least-privilege security groups (LB → app → DB), no public DB. Connected to networking concepts I already know (subnetting, routing, VLANs, ACLs vs stateful firewalls) without over-explaining the basics. Map each AWS construct to its local Docker equivalent.

## 8. SECURITY (docs/security.md and /security/)
Least privilege, IAM roles in Terraform, RBAC, password hashing, secrets management (.env locally → AWS Secrets Manager in design), encryption in transit and at rest (explain local vs design), security headers, validation, rate limiting, audit logs, segmentation, private bucket with public access blocked, relevant OWASP Top 10 protections.
docs/security-assessment.md: assets, trust boundaries, attack surface; STRIDE table Asset → Threat → Likelihood/Impact → Mitigation → Status; IAM, storage, network, application, logging risks; real results of scans actually run (CodeQL, npm audit, Trivy, gitleaks, checkov) with what was fixed or accepted and why.

## 9. INFRASTRUCTURE AS CODE (/infrastructure/terraform/)
Modules: network, compute (ECS Fargate — explain why over EC2/EKS), load_balancer, database, storage, iam, monitoring, secrets. environments/dev and environments/prod with terraform.tfvars.example. Variables everywhere; no hardcoded IDs, regions, or secrets. Useful outputs. Tags: Project, Environment, CostCenter. Commented-out remote backend example. README on how someone with an account would deploy it, with a clear paid-resources warning and an estimated monthly cost range labelled as an estimate. Validate with fmt, init -backend=false, validate, and a scanner; report real results.

## 10. CI/CD (.github/workflows/, docs/cicd.md)
CI on push/PR: checkout → install → lint → type-check → tests (Postgres service container) → build → security checks (npm audit, CodeQL, gitleaks, Trivy, Terraform fmt/validate/checkov) → Docker build (no push; ask before pushing anywhere).
Deploy workflow: shows GitHub OIDC → AWS IAM role, no stored keys, manual workflow_dispatch only, environment protection. Mark DESIGNED / NOT DEPLOYED; it must not run successfully without deliberate configuration from me.
Keep workflows lean: caching, concurrency, path filters.

## 11. MONITORING (/observability/, docs/monitoring.md)
Structured logs, request IDs, Prometheus scraping /metrics, Grafana dashboard provisioned from code (request rate, error rate, p50/p95 latency, uploads, failed logins, container CPU/memory). Alert rules: high error rate, high latency, service down, DB not ready, storage not ready, failed-login spike, disk usage. Answer "What would I monitor in production?" and map to AWS equivalents (DESIGNED / NOT DEPLOYED). Screenshots only from the real local stack.

## 12. RELIABILITY
### 12.1 Backups & DR (docs/disaster-recovery.md)
Explain RPO/RTO simply, set and justify targets. Design: RDS backups + snapshots, S3 versioning + lifecycle, optional cross-region copy (with cost note). Local and real: Node/Bash backup and restore scripts for Postgres and object storage; test the restore and document what happened. Runbooks: DB unavailable, storage unavailable, accidental deletion, leaked credentials — each Detect → Investigate → Restore/Fail over → Verify → Communicate → Document.
### 12.2 Failure engineering
Local simulations (stopping containers, bad creds, expired tokens, traffic spikes) for: app down, DB down, storage down, invalid credentials, expired auth, high traffic, app-DB network failure. Expected vs actual behaviour. Never touch real cloud resources.
### 12.3 Scalability (docs/scalability.md)
Horizontal scaling, stateless servers, load balancing, caching, read replicas/connection pooling, object storage, CDN, async jobs. Walk through 100 → 1,000 → 10,000 → 100,000 users: what breaks first and what changes. Keep DESIGNED FOR separate from ACTUALLY TESTED AT.
### 12.4 Load testing (/load-tests/, docs/load-testing.md)
k6 scripts for login, list, upload, download against the local stack. Report real RPS, latency percentiles, error rate, resource use, and my machine specs. State that laptop results don't predict cloud capacity.
### 12.5 Cost (docs/cost-analysis.md)
What would cost money in AWS and why (NAT, LB, RDS, Fargate, data transfer, logs), as dated estimates with the pricing source to check. Built-in savings (VPC endpoints, lifecycle rules, small dev sizes, log retention, tagging). Confirm actual project cost so far: $0.

## 13. ROADMAP — one phase per session, stop after each
1. Environment inspection, requirements, architecture docs + diagrams
2. Monorepo scaffold, lint/format/type-check, CI skeleton
3. DB schema, migrations, auth, RBAC
4. Document management + object storage + ownership enforcement
5. Docker Compose environment with network segmentation
6. Frontend: auth, dashboard, documents, upload, admin
7. Audit logging + malware-scan background job
8. Terraform modules and environments (validate only)
9. Security hardening + assessment + scans
10. Full CI + designed deploy workflow
11. Monitoring, dashboards, alerts
12. Backup/restore, DR runbooks, failure simulations
13. Load testing, scalability, cost docs
14. Final docs, portfolio docs, senior-engineer review

## 14. TESTING
Unit tests (auth, validation, permissions); API tests for every endpoint; security-boundary tests (User A can't touch User B's documents; non-admins blocked from admin routes; deactivated users rejected); missing/invalid/expired/tampered tokens; refresh-token reuse detection; malformed input, oversized files, disallowed and disguised file types, missing files, duplicates; /health and /ready when DB or storage is down; a few Playwright end-to-end flows. Report real pass/fail counts.

## 15. TEACH ME WHILE YOU BUILD
For every major component, docs answer: What is it? Why do we need it? How does it work? Why did we choose it? What happens without it? How does a real company use it? Beginner-friendly but accurate; connect to networking concepts I know. Create docs/glossary.md.

## 16. DOCUMENTATION & REPO
README: overview, problem, objectives, status table (Section 0.4 labels), both diagrams, stack with reasons, features, security, local setup in under 5 commands, testing, monitoring, DR, cost, a "Lessons learned" section left for me to write, future improvements.
Repo: .gitignore, .env.example, .editorconfig, MIT LICENSE, SECURITY.md, CONTRIBUTING.md, Dependabot config, conventional commits, small commits per phase.

## 17. FINAL REVIEW & PORTFOLIO PACKAGE
Review as a senior engineer: Is it genuinely a cloud project? Realistic architecture? Sound networking? Security holes? Anything unnecessary, misleading, or overstated? Are all status labels accurate? Fix and list changes.
Then create docs/portfolio-summary.md (honest about local vs designed), docs/linkedin-description.md (only what was implemented and tested; says built and tested locally with AWS designed in Terraform, not deployed), docs/interview-guide.md (likely questions with strong answers I can give in my own words). Connect the project to my networking, security and Web3 background where genuinely relevant, but never invent experience I do not have.

## 18. START NOW
1. Inspect the environment (Section 1) and report.
2. Propose the architecture and confirm the stack.
3. Show the roadmap.
4. Begin Phase 1, then stop and report per Section 0.5.
Make sensible decisions without asking me to design things, but anything that could cost money, needs credentials, deletes things, or creates a security risk: stop and ask first.
