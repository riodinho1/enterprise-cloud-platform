# Security policy

This is a portfolio project. It runs locally in Docker and has no public deployment, so there is no live system to attack. Vulnerability reports are still welcome because the code is meant to demonstrate secure engineering.

## Reporting

Open a GitHub issue titled `security:` with a description and reproduction steps, or use GitHub's private vulnerability reporting on this repository if it is enabled. Do not include real credentials or personal data in a report.

## Scope

- Authentication and session handling (JWT access tokens, refresh token rotation)
- Authorisation, especially any way for one user to reach another user's documents
- Upload validation (size, type detection, filename handling)
- Container and Compose configuration
- Terraform configuration (design only, never deployed)

## What this project deliberately does not do

- It does not encrypt traffic locally. TLS is designed at the CloudFront and load balancer layers in Terraform and documented as DESIGNED / NOT DEPLOYED.
- It does not claim any production hardening beyond what [docs/security.md](docs/security.md) and [docs/security-assessment.md](docs/security-assessment.md) state with a status label.

## Supported versions

Only the `main` branch.
