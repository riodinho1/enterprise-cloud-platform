# Development environment report

Inspected on 2026-09-25. Nothing was configured, installed, or logged into during the inspection. This file exists so that later measurements (load tests, scan timings) can cite the exact machine they ran on.

## Machine

| Item | Value |
|---|---|
| OS | Windows 11 Pro, build 22621 |
| CPU | Intel Core i5-6300U, 2 cores / 4 threads, 2.40 GHz |
| RAM | 7.9 GB |
| Disk | 238 GB total, 35 GB free at inspection |
| Virtualisation | Hypervisor present. No WSL distribution installed yet. |
| Shell | Git Bash (MSYS) and PowerShell 5.1 |

This is a modest laptop. It can run the whole local stack, but memory is the limiting factor. The Docker Compose design keeps the number of containers small and makes ClamAV an opt-in profile. See [architecture.md](architecture.md).

## Tools found

| Tool | Version | Used from phase |
|---|---|---|
| Node.js | 22.18.0 | 2 |
| npm | 11.6.3 | 2 |
| Git | 2.52.0 | 1 |
| GitHub CLI (gh) | present | 2 |
| VS Code | present | 1 |
| winget | 1.29 | for installs |
| Chocolatey | 2.2.2 | for installs |

No cloud CLIs (aws, az, gcloud) are installed. That is the desired state for this project: there is nothing that could authenticate to a provider by accident.

## Tools missing and how to install them

All of these are free, need no account and no card. Install each one only when its phase arrives. Run the commands from an **administrator** PowerShell.

| Tool | Needed from phase | Install command |
|---|---|---|
| WSL 2 + Docker Desktop | 5 | `wsl --install` then reboot, then `winget install Docker.DockerDesktop` |
| Terraform | 8 | `winget install Hashicorp.Terraform` |
| tflint | 8 | `choco install tflint` |
| Trivy | 8 | `choco install trivy` |
| gitleaks | 9 | `choco install gitleaks` |
| k6 | 13 | `winget install k6.k6` |

Docker Desktop is free for personal use and education. It was installed on 2026-09-26 (`docker run hello-world` works; it must be started by hand, it does not auto-start). The same day this file was created as `C:\Users\<you>\.wslconfig` with a 4 GB memory cap so the laptop stays responsive:

```ini
[wsl2]
memory=4GB
processors=2
swap=1GB
```

## Checkov policy

Checkov is a Python-only Terraform scanner. The project rule is "no Python anywhere", so:

- Locally, Terraform is scanned with Trivy (`trivy config`) and tflint. Both are Go binaries.
- In GitHub Actions only, checkov also runs, inside the CI runner. It is never installed or run on the development machine. Approved by the project owner on 2026-09-25.

## Object storage image check (2026-09-25)

The brief asks for an open-source S3-compatible server and to check licensing and image availability first.

| Candidate | Licence | Docker Hub state on 2026-09-25 | Verdict |
|---|---|---|---|
| MinIO (`minio/minio`) | AGPL 3.0 | GitHub repository banner: "THIS REPOSITORY IS NO LONGER MAINTAINED". Community edition is source-only. Legacy images "will not receive updates". | Rejected |
| SeaweedFS (`chrislusf/seaweedfs`) | Apache 2.0 | Image pushed on 2026-09-25 | **Chosen** |
| Garage (`dxflrs/garage`) | AGPL 3.0 | Image pushed on 2026-09-24 | Fallback |
| RustFS (`rustfs/rustfs`) | Apache 2.0 | 1.0.0 released 2026-09-16 | Too new |

SeaweedFS was chosen because it is a single binary with a built-in S3 gateway, works with the AWS SDK for JavaScript v3, supports pre-signed URLs, is light on RAM, and has a permissive licence. Confirmed for real on 2026-09-26 in Phase 4: `chrislusf/seaweedfs:4.47` in `mini` mode, SDK round trip and credential rejection verified, healthcheck on `GET /healthz`. Its status label is SIMULATED: it stands in for Amazon S3.

## ClamAV feasibility note

The official `clamav/clamav` image is about 183 MB to download, but the daemon needs roughly 1 to 1.5 GB of RAM once the signature database is loaded, and it downloads about 300 MB of signatures on first start. On this machine that is feasible but tight, so ClamAV runs as an opt-in Docker Compose profile. The final call is made in Phase 7.
