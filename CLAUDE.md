# CLAUDE.md — project rules

These rules come from Section 0 of docs/PROJECT_SPEC.md and override everything else. The full brief lives in docs/PROJECT_SPEC.md; resume state lives in docs/progress.md.

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


## Session start checklist

1. Read docs/progress.md first. It says which phase is current and what was approved.
2. Owner-approved decisions live in docs/architecture.md Section 11. Do not re-open them without asking.
3. checkov never runs on this machine (Python-only). Trivy and tflint locally; checkov in GitHub Actions only.
4. Git identity for this repo is set locally, not globally. Do not change it.
