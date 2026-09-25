# Glossary

Short, accurate definitions of every term used in this project, with the networking concept it maps to where one exists. Terms are grouped, then alphabetical within each group. New terms are added as phases introduce them.

## Cloud networking

- **Availability Zone (AZ)**: one or more physical data centres in a region with independent power and networking. Running in two AZs survives the loss of one building.
- **CIDR block**: an IP range written as address/prefix, for example 10.0.0.0/16. Same notation as CCNA subnetting.
- **Internet gateway (IGW)**: the VPC's door to the internet. A subnet is "public" only because its route table sends 0.0.0.0/0 to the IGW.
- **Isolated subnet**: a subnet whose route table has no route to an IGW or NAT. Only reachable from inside the VPC. Where the database lives.
- **NAT gateway**: lets instances in private subnets start outbound connections (updates, image pulls) while blocking inbound. Billed per hour and per GB. Same idea as PAT/overload NAT on a Cisco edge router.
- **Network ACL (NACL)**: a stateless allow/deny list on a subnet, evaluated in rule order. Behaves like a router ACL from CCNA: you must allow return traffic explicitly.
- **Private subnet**: a subnet with no direct inbound route from the internet, but with outbound via NAT. Where application containers live.
- **Public subnet**: a subnet with a route to the IGW. Only the load balancer and NAT gateway live here.
- **Route table**: per-subnet rules that decide where packets go next. Identical concept to a routing table on a router.
- **Security group**: a stateful virtual firewall attached to a resource. If you allow inbound 443, the reply is allowed automatically. Rules can reference other security groups ("allow 5432 from the app security group"), which is how least privilege is expressed.
- **Subnet**: a slice of the VPC's CIDR in one AZ. Segmentation unit for security groups and route tables.
- **VPC (Virtual Private Cloud)**: your own isolated network inside AWS, with its own CIDR, subnets, route tables and gateways.
- **VPC endpoint (gateway)**: a route-table entry that sends traffic for S3 or DynamoDB over the AWS backbone instead of through NAT. Free, and keeps data off the internet.

## Edge and delivery

- **Application Load Balancer (ALB)**: a layer-7 load balancer that routes HTTP(S) by path or host, health-checks targets and spreads traffic across AZs.
- **CDN (Content Delivery Network)**: servers near users that cache static content. CloudFront is AWS's CDN. Cuts latency and origin load.
- **Health check**: a periodic request (here `/health`) that a load balancer or orchestrator uses to decide whether a target may receive traffic.
- **Reverse proxy**: a server (nginx here) that receives client requests and forwards them to backend services. The client only ever sees the proxy.
- **TLS termination**: the point where HTTPS is decrypted. In the design it happens at CloudFront and the ALB; locally the stack speaks plain HTTP and the docs say so.
- **WAF (Web Application Firewall)**: inspects HTTP requests for attack patterns (SQL injection, XSS) and rate-limits abusive IPs before traffic reaches the application.

## Compute, containers and orchestration

- **Container**: a process with its own filesystem, network namespace and resource limits, built from an image. Lighter than a VM because it shares the host kernel.
- **Docker Compose**: a YAML file describing several containers, their networks and volumes, started with one command.
- **Docker network**: a virtual bridge. Containers on the same network resolve each other by service name; containers on different networks cannot talk. The local equivalent of a subnet plus security group.
- **ECR (Elastic Container Registry)**: AWS's private Docker image registry.
- **ECS (Elastic Container Service)**: AWS's container orchestrator. A *service* keeps N copies of a *task* running.
- **Fargate**: the serverless launch type for ECS. You declare CPU and memory per task and AWS runs it; no EC2 instances to patch.
- **Healthcheck (Docker)**: a command run inside the container on a schedule; Compose can wait for `healthy` before starting dependants.
- **Image**: an immutable, layered filesystem snapshot that containers start from.
- **Multi-stage build**: a Dockerfile with several `FROM` stages so build tools stay out of the final image, which becomes smaller and has less attack surface.
- **Non-root container**: the process runs as an unprivileged user, so a container escape gives an attacker less.
- **Profile (Compose)**: a label that makes a service optional. `docker compose --profile scan up` starts ClamAV; without the flag it does not.
- **Stateless service**: a process that keeps no per-user state in memory or on local disk, so any replica can serve any request and replicas can be added or killed freely.
- **Task definition**: ECS's description of a container set: image, CPU, memory, environment, secrets, IAM role, log driver.
- **Volume**: persistent storage attached to a container; the database's data directory lives on one so it survives restarts.

## Storage and data

- **Bucket**: the top-level container for objects in S3-style storage.
- **Checksum**: a hash (SHA-256 here) of file bytes stored with the metadata, used to detect corruption and duplicates.
- **Connection pool**: a set of reusable database connections. Postgres handles a few hundred connections well, not thousands, so pooling matters when replicas grow.
- **Lifecycle rule**: an S3 policy that expires or moves objects after N days, which controls cost.
- **Migration**: a versioned, ordered change to the database schema, checked into git. Prisma generates and applies them.
- **Multi-AZ (RDS)**: a synchronous standby in a second AZ with automatic failover.
- **Object key**: the "path" of an object in a bucket. This project uses random UUIDs so keys cannot be guessed.
- **Object storage**: flat storage of blobs by key with HTTP access. Cheap, durable, scales without action. Not a filesystem.
- **ORM (Object-Relational Mapper)**: a library (Prisma here) that maps tables to typed objects and generates SQL.
- **Pre-signed URL**: a time-limited URL that grants direct access to one object. Powerful and a bearer credential; this project streams instead and documents the trade-off.
- **Read replica**: a read-only copy of the database fed by replication, used to offload read traffic.
- **RPO / RTO**: Recovery Point Objective is how much data you can afford to lose (time since the last backup). Recovery Time Objective is how long you can afford to be down.
- **S3 (Simple Storage Service)**: AWS object storage. SeaweedFS speaks the same API locally.
- **Server-side encryption (SSE)**: the storage service encrypts objects at rest with a managed key.
- **Snapshot**: a point-in-time copy of a database volume.
- **SKIP LOCKED**: a Postgres clause that lets a worker claim a row other workers have not locked, without waiting. The basis of the job queue.
- **Soft delete**: marking a row deleted with a timestamp instead of removing it, so it can be recovered and audited.
- **Versioning (S3)**: keeping previous versions of an object when it is overwritten or deleted, which protects against accidental deletion.

## Identity and security

- **argon2id**: a memory-hard password hashing algorithm, the current recommendation over bcrypt. Slow on purpose so brute force is expensive.
- **Access token**: a short-lived JWT (minutes) sent as a Bearer header. If stolen, it expires soon.
- **Audit log**: an append-only record of who did what, to which target, when, from where, with what result.
- **Bearer token**: any token that grants access to whoever holds it. Treat like a password.
- **CORS (Cross-Origin Resource Sharing)**: browser rules controlling which web origins may call an API. The API allows only the frontend's origin.
- **CSRF (Cross-Site Request Forgery)**: tricking a logged-in browser into sending a request. Mitigated by SameSite cookies and by requiring the Bearer header, which a cross-site form cannot set.
- **Defence in depth**: several independent layers so one failure does not mean a breach. Segmentation plus RBAC plus validation plus audit.
- **Encryption at rest / in transit**: at rest means stored bytes are encrypted (RDS, S3 SSE). In transit means TLS on the wire. Locally neither is on, and the docs say so.
- **Helmet**: an Express middleware that sets security headers (CSP, HSTS, no-sniff, frame options).
- **httpOnly cookie**: a cookie JavaScript cannot read, which keeps the refresh token away from XSS.
- **IAM (Identity and Access Management)**: AWS's system of users, roles and policies. A *role* is an identity a service assumes; a *policy* is the JSON list of allowed actions and resources.
- **JWT (JSON Web Token)**: a signed, base64-encoded claim set. The API verifies the signature and expiry on every request; nothing needs a database lookup.
- **Least privilege**: every identity gets only the permissions it needs. Applies to IAM roles, database roles, security groups and API roles alike.
- **Magic bytes**: the first bytes of a file that identify its real type (for example `%PDF-`). Checked instead of trusting the extension or the client's declared MIME type.
- **OIDC (OpenID Connect) for GitHub Actions**: GitHub issues a short-lived signed token for a workflow run; AWS trusts it and lets the run assume an IAM role. No long-lived AWS keys are stored anywhere.
- **OWASP Top 10**: the standard list of the most common web application risks: broken access control, injection, and so on.
- **Rate limiting**: capping requests per client per time window. Applied to login and register to blunt credential stuffing.
- **RBAC (Role-Based Access Control)**: permissions attached to roles (user, admin), roles attached to users.
- **Refresh token rotation**: every refresh returns a new refresh token and invalidates the old one. If an old one is presented again, someone has a copy, and the whole family is revoked.
- **SameSite cookie**: a cookie attribute that stops the browser sending the cookie on cross-site requests.
- **Secrets manager**: a service that stores secrets encrypted and hands them to authorised identities at runtime, so they are never in code, images or state files.
- **STRIDE**: a threat-modelling checklist: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.
- **Threat model**: a structured list of assets, who might attack them, how, and what stops them.
- **Trust boundary**: a line where the level of trust changes, for example browser to API, or API to database.
- **XSS (Cross-Site Scripting)**: injecting script into a page. Mitigated by React's escaping, a Content Security Policy, and keeping tokens out of JavaScript-readable storage.
- **Zod**: a TypeScript validation library. One schema validates the request on the server and the form on the client.

## Observability and reliability

- **Alert rule**: a condition over metrics ("error rate above 5 % for 5 minutes") that fires a notification.
- **CloudWatch**: AWS logs, metrics, dashboards and alarms.
- **Dashboard provisioning**: defining Grafana dashboards as JSON in git so they are reproducible instead of click-built.
- **Error rate**: the share of requests returning 5xx. The first thing to alert on.
- **Grafana**: dashboards and alerting on top of Prometheus or other sources.
- **Histogram (Prometheus)**: buckets of observed values that let you compute percentiles such as p95 latency.
- **Latency percentile (p50 / p95 / p99)**: the value below which that share of requests complete. p95 matters more than the average because averages hide slow tails.
- **Prometheus**: a metrics database that pulls (scrapes) `/metrics` endpoints on a schedule and stores time series.
- **Readiness vs liveness**: `/health` says the process is alive. `/ready` says it can do useful work (DB and storage reachable). Load balancers route on readiness.
- **Request ID**: a unique ID attached to each request and included in every log line it produces, so one user's problem can be traced across services.
- **Runbook**: a written, step-by-step procedure for a known incident, so the fix does not depend on who is on call.
- **Structured logging**: logs as JSON objects with named fields instead of free text, so they can be searched and aggregated. pino produces them.

## Delivery and tooling

- **Chaos / failure engineering**: deliberately breaking parts of a system to confirm it fails the way the design says it will.
- **CI / CD**: Continuous Integration runs lint, tests and scans on every push. Continuous Delivery packages a deployable artefact; deployment here is a designed manual workflow.
- **CodeQL**: GitHub's static analysis that finds security bugs in source code.
- **Conventional commits**: commit messages shaped `type(scope): summary`, for example `feat(api): add refresh rotation`, so history is readable and changelogs can be generated.
- **Dependabot**: GitHub's bot that opens pull requests to update vulnerable or outdated dependencies.
- **gitleaks**: scans git history for committed secrets.
- **Infrastructure as Code (IaC)**: describing infrastructure in versioned files (Terraform) instead of clicking in a console. Reviewable, repeatable, diffable.
- **k6**: a load-testing tool that scripts virtual users in JavaScript and reports RPS and latency percentiles.
- **Mermaid**: diagrams written as text inside Markdown, rendered by GitHub.
- **Monorepo / npm workspaces**: one repository holding several packages (`apps/web`, `apps/api`, `packages/shared`) that share tooling and can import each other.
- **npm audit**: reports known vulnerabilities in installed dependencies.
- **Playwright**: browser automation for end-to-end tests.
- **Terraform**: HashiCorp's IaC tool. `init` downloads providers, `validate` checks syntax and types, `plan` shows changes, `apply` makes them. This project stops at `validate`.
- **Terraform state**: the file where Terraform records what it created. Contains sensitive values, so it belongs in a locked remote backend, never in git.
- **tflint / Trivy / checkov**: Terraform linters and misconfiguration scanners. tflint and Trivy run locally; checkov only in CI.
- **Trivy**: scans container images, filesystems and IaC for vulnerabilities and misconfigurations.
- **Vitest / Supertest**: Vitest runs unit tests; Supertest sends HTTP requests to the Express app in tests.
