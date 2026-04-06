# Deployment Guide

Production deployment guide for Claude Code Agent Monitor. This document covers every supported deployment path — from a single Docker container to a fully orchestrated, multi-cloud Kubernetes deployment with blue-green releases, automated canary analysis, and comprehensive observability.

## Architecture Overview

```mermaid
graph TB
  subgraph "Internet"
    U[Users / Browsers]
  end

  subgraph "Edge Layer"
    LB[Load Balancer<br/>TLS Termination<br/>WebSocket Upgrade]
  end

  subgraph "Compute Layer"
    subgraph "Blue Slot"
      B1[Dashboard Pod 1]
      B2[Dashboard Pod 2]
      B3[Dashboard Pod N]
    end
    subgraph "Green Slot"
      G1[Dashboard Pod 1]
      G2[Dashboard Pod 2]
      G3[Dashboard Pod N]
    end
  end

  subgraph "MCP Sidecar"
    MCP1[MCP Server]
  end

  subgraph "Persistence"
    PV[(SQLite on<br/>Persistent Volume)]
  end

  subgraph "Observability"
    PROM[Prometheus]
    GRAF[Grafana]
    ALERT[Alertmanager]
    CX[Coralogix]
    OTEL[OTel Collector]
  end

  U --> LB
  LB -->|Active| B1 & B2 & B3
  LB -.->|Standby| G1 & G2 & G3
  B1 --- MCP1
  B1 & B2 & B3 --> PV
  PROM -->|Scrape| B1 & B2 & B3
  PROM --> ALERT
  OTEL -->|Ship logs, metrics, traces| CX
  B1 & B2 & B3 --> OTEL
  GRAF --> PROM
```

## Deployment Methods

Three deployment methods are supported, each targeting different operational maturity levels:

```mermaid
flowchart LR
  Start([Choose Method]) --> Q1{Have<br/>Kubernetes?}
  Q1 -->|No| Docker["🐳 Docker Compose<br/><i>Simplest path</i>"]
  Q1 -->|Yes| Q2{Need<br/>IaC?}
  Q2 -->|No| Q3{Prefer<br/>templating?}
  Q2 -->|Yes| TF["🏗️ Terraform<br/><i>Full cloud provisioning</i>"]
  Q3 -->|Helm| Helm["⎈ Helm Chart<br/><i>Parameterized installs</i>"]
  Q3 -->|Raw YAML| Kust["📦 Kustomize<br/><i>Overlay-based patching</i>"]

  style Docker fill:#0db7ed,color:#fff
  style Helm fill:#0f1689,color:#fff
  style Kust fill:#326ce5,color:#fff
  style TF fill:#7b42bc,color:#fff
```

| Method | Best For | Prerequisites | Cloud Agnostic |
|--------|----------|---------------|:--------------:|
| **Docker Compose** | Local dev, single-server | Docker | ✅ |
| **Helm** | Teams with Kubernetes | `helm`, `kubectl` | ✅ |
| **Kustomize** | GitOps, raw YAML fans | `kustomize`, `kubectl` | ✅ |
| **Terraform** | Full infra provisioning | `terraform` | ✅ AWS/GCP/Azure/OCI |

---

## Quick Start: Docker Compose

The fastest path to a running production instance:

```bash
# Build and start everything
docker compose up -d --build

# Verify
curl http://localhost:4820/api/health
# → {"status":"ok","timestamp":"..."}

# View logs
docker compose logs -f
```

The included `docker-compose.yml` at the project root runs the dashboard on port `4820` with a persistent `./data` volume for SQLite.

---

## Helm Deployment

### Prerequisites

```bash
# Verify tools
helm version    # >= 3.12
kubectl version # >= 1.27
```

### Install

```bash
# From the repository root:
cd deployments/helm/agent-monitor

# Dev environment (1 replica, relaxed resources)
helm install agent-monitor . \
  -f values-dev.yaml \
  -n agent-monitor-dev --create-namespace

# Staging (2 replicas, moderate resources)
helm install agent-monitor . \
  -f values-staging.yaml \
  -n agent-monitor-staging --create-namespace

# Production (3+ replicas, HPA, strict security)
helm install agent-monitor . \
  -f values-production.yaml \
  -n agent-monitor-production --create-namespace
```

### Helm Values Hierarchy

```mermaid
graph TD
  Base["values.yaml<br/><i>Defaults for all environments</i>"]
  Dev["values-dev.yaml<br/>1 replica · 64Mi memory<br/>No HPA · No network policy"]
  Stg["values-staging.yaml<br/>2 replicas · 256Mi memory<br/>HPA 2→5 · TLS enabled"]
  Prod["values-production.yaml<br/>3 replicas · 512Mi memory<br/>HPA 3→20 · Strict PSS"]

  Base --> Dev
  Base --> Stg
  Base --> Prod

  style Base fill:#f5f5f5,stroke:#333
  style Dev fill:#4caf50,color:#fff
  style Stg fill:#ff9800,color:#fff
  style Prod fill:#f44336,color:#fff
```

### Key Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `replicaCount` | `2` | Number of pod replicas |
| `image.registry` | `ghcr.io` | Container registry |
| `image.tag` | `""` (appVersion) | Image tag |
| `service.type` | `ClusterIP` | Service type |
| `ingress.enabled` | `false` | Enable Ingress resource |
| `persistence.enabled` | `true` | Enable PVC for SQLite |
| `persistence.size` | `5Gi` | PVC size |
| `autoscaling.enabled` | `true` | Enable HPA |
| `mcp.enabled` | `false` | Deploy MCP sidecar |
| `monitoring.enabled` | `false` | Enable ServiceMonitor |
| `networkPolicy.enabled` | `true` | Enable NetworkPolicy |

### Upgrade

```bash
helm upgrade agent-monitor . \
  -f values-production.yaml \
  -n agent-monitor-production \
  --set image.tag=sha-abc1234
```

### Rollback

```bash
# View history
helm history agent-monitor -n agent-monitor-production

# Roll back to previous
helm rollback agent-monitor -n agent-monitor-production

# Roll back to specific revision
helm rollback agent-monitor 3 -n agent-monitor-production
```

### Test

```bash
helm test agent-monitor -n agent-monitor-production
```

---

## Kustomize Deployment

### Base + Overlays Structure

```mermaid
graph TB
  subgraph "kubernetes/"
    Base["base/<br/>11 resource manifests"]
    Dev["overlays/dev/<br/>1 replica, low resources"]
    Stg["overlays/staging/<br/>2 replicas, mid resources"]
    Prod["overlays/production/<br/>3 replicas, HA, strict HPA"]

    Base --> Dev
    Base --> Stg
    Base --> Prod

    Comp1["components/mcp-sidecar/<br/>Adds MCP container"]
    Comp2["components/monitoring/<br/>Adds ServiceMonitor"]

    Comp1 -.->|Optional| Dev & Stg & Prod
    Comp2 -.->|Optional| Stg & Prod
  end

  style Base fill:#326ce5,color:#fff
  style Dev fill:#4caf50,color:#fff
  style Stg fill:#ff9800,color:#fff
  style Prod fill:#f44336,color:#fff
  style Comp1 fill:#9c27b0,color:#fff
  style Comp2 fill:#9c27b0,color:#fff
```

### Deploy

```bash
cd deployments/kubernetes

# Preview what will be applied
kubectl kustomize overlays/production

# Apply
kubectl apply -k overlays/dev          # Dev
kubectl apply -k overlays/staging      # Staging
kubectl apply -k overlays/production   # Production
```

### Enable MCP Sidecar

Add the component to your overlay's `kustomization.yaml`:

```yaml
# overlays/production/kustomization.yaml
components:
  - ../../components/mcp-sidecar
  - ../../components/monitoring
```

Then re-apply:

```bash
kubectl apply -k overlays/production
```

### Base Resources

The base layer includes all required Kubernetes resources:

| Resource | File | Purpose |
|----------|------|---------|
| Namespace | `namespace.yaml` | Isolated namespace with Restricted PSS |
| Deployment | `deployment.yaml` | App pods with probes, security context, anti-affinity |
| Service | `service.yaml` | ClusterIP with WebSocket session affinity |
| Ingress | `ingress.yaml` | TLS, HSTS, WebSocket upgrade headers |
| HPA | `hpa.yaml` | CPU/memory auto-scaling with scale-down stabilization |
| PDB | `pdb.yaml` | Disruption budget (`minAvailable: 1`) |
| NetworkPolicy | `networkpolicy.yaml` | Restricted ingress/egress |
| ConfigMap | `configmap.yaml` | Runtime configuration |
| PVC | `pvc.yaml` | Persistent storage for SQLite |
| ServiceAccount | `serviceaccount.yaml` | Dedicated SA, no token mount |

---

## Terraform Deployment

Full cloud infrastructure provisioning with support for AWS, GCP, Azure, and OCI.

### Cloud Provider Architecture

```mermaid
graph TB
  subgraph "Terraform Root Module"
    TF[main.tf<br/>Module orchestration]
    TF --> NET[networking/]
    TF --> DB[database/]
    TF --> COMP[compute/]
    TF --> LB[loadbalancer/]
    TF --> MON[monitoring/]
  end

  subgraph "Provider Implementations"
    AWS["☁️ AWS<br/>VPC → ECS Fargate → EFS → ALB"]
    GCP["☁️ GCP<br/>VPC → Cloud Run → Filestore → GCLB"]
    AZ["☁️ Azure<br/>VNet → ACI → Files → AppGW"]
    OCI["☁️ OCI<br/>VCN → OKE → FSS → LBaaS"]
  end

  TF -.-> AWS & GCP & AZ & OCI

  style AWS fill:#ff9900,color:#fff
  style GCP fill:#4285f4,color:#fff
  style AZ fill:#0078d4,color:#fff
  style OCI fill:#f80000,color:#fff
```

### Modules

| Module | Provisions | Key Features |
|--------|-----------|--------------|
| **networking** | VPC/VNet, subnets, NAT, security groups | Multi-AZ, public/private subnet separation |
| **compute** | Container instances, task definitions | Blue-green dual slots, auto-scaling |
| **database** | Managed file storage (EFS/Filestore/Files/FSS) | Encrypted at rest, NFS mount |
| **loadbalancer** | Application load balancer | TLS 1.3, WebSocket sticky sessions, weighted routing |
| **monitoring** | CloudWatch/Stackdriver/Azure Monitor | Alarms, dashboards, log retention |

### Deploy with Terraform

```bash
cd deployments/terraform

# 1. Select a cloud provider
#    Copy the provider directory as your working root, or symlink:
cp -r providers/aws/* .
#    Or for GCP: cp -r providers/gcp/* .
#    Or for Azure: cp -r providers/azure/* .
#    Or for OCI: cp -r providers/oci/* .

# 2. Configure backend (edit backend.tf — uncomment your provider's backend block)
vim backend.tf

# 3. Initialize
terraform init

# 4. Plan with environment-specific variables
terraform plan -var-file=environments/dev/terraform.tfvars -out=tfplan

# 5. Apply
terraform apply tfplan

# 6. Get outputs
terraform output application_url
```

### Environment Configuration

Each environment has a pre-configured `terraform.tfvars`:

| Environment | Replicas | CPU | Memory | Monitoring | Strategy |
|-------------|:--------:|:---:|:------:|:----------:|----------|
| **dev** | 1 | 256 | 512 | Off | Rolling |
| **staging** | 2 | 512 | 1024 | On | Rolling |
| **production** | 3 | 1024 | 2048 | On | Blue-green |

### Blue-Green with Terraform

```mermaid
sequenceDiagram
  participant Op as Operator
  participant TF as Terraform
  participant LB as Load Balancer
  participant Blue as Blue Slot
  participant Green as Green Slot

  Note over Blue: Serving 100% traffic
  Op->>TF: Update green image tag
  TF->>Green: Deploy new version
  Green-->>TF: Health checks pass
  Op->>TF: Shift weights (blue=0, green=100)
  TF->>LB: Update target group weights
  LB->>Green: 100% traffic
  Note over Green: Now serving all traffic
  Note over Blue: Available for instant rollback
```

Adjust weights in your tfvars:

```hcl
# Switch traffic from blue to green
blue_weight  = 0
green_weight = 100
```

Then apply:

```bash
terraform plan -var-file=environments/production/terraform.tfvars -out=tfplan
terraform apply tfplan
```

---

## Deployment Strategies

### Rolling Update (Default)

Zero-downtime rolling replacement. One pod at a time is replaced while the rest continue serving.

```mermaid
gantt
  title Rolling Update Timeline
  dateFormat X
  axisFormat %s

  section Pod 1
    Running (old)   :done, 0, 3
    Terminating     :crit, 3, 4
    Running (new)   :active, 4, 10

  section Pod 2
    Running (old)   :done, 0, 5
    Terminating     :crit, 5, 6
    Running (new)   :active, 6, 10

  section Pod 3
    Running (old)   :done, 0, 7
    Terminating     :crit, 7, 8
    Running (new)   :active, 8, 10
```

```bash
# Rolling is the default strategy
./deployments/scripts/deploy.sh --env production --method helm
```

### Blue-Green

Two identical environments. Traffic switches instantly between them. Enables instant rollback.

```mermaid
stateDiagram-v2
  [*] --> BlueActive: Initial state
  BlueActive --> GreenActive: Switch to green
  GreenActive --> BlueActive: Switch to blue (rollback)

  state BlueActive {
    Blue_100: Blue receives 100% traffic
    Green_Standby: Green on standby
  }

  state GreenActive {
    Green_100: Green receives 100% traffic
    Blue_Standby: Blue on standby
  }
```

```bash
# Deploy with blue-green strategy
./deployments/scripts/deploy.sh \
  --env production --method helm --strategy blue-green

# Switch traffic to green slot
./deployments/scripts/blue-green-switch.sh \
  --env production --target green

# Instant rollback to blue
./deployments/scripts/blue-green-switch.sh \
  --env production --target blue
```

### Canary

Gradually shift traffic to the new version while monitoring error rates and latency. Automatic rollback if metrics exceed thresholds.

```mermaid
graph LR
  subgraph "Canary Progression"
    S1["5% traffic<br/>Monitor 60s"] --> S2["25% traffic<br/>Monitor 60s"]
    S2 --> S3["50% traffic<br/>Monitor 60s"]
    S3 --> S4["100% traffic<br/>Promotion complete"]
  end

  subgraph "Auto-Rollback Triggers"
    T1["Success rate < 99%"]
    T2["P99 latency > 500ms"]
    T3["Error rate > 1%"]
  end

  T1 & T2 & T3 -->|"failureLimit: 2"| RB[Automatic Rollback]

  style S4 fill:#4caf50,color:#fff
  style RB fill:#f44336,color:#fff
```

```bash
# Deploy with canary strategy (requires Argo Rollouts)
./deployments/scripts/deploy.sh \
  --env production --method helm --strategy canary
```

Canary analysis is defined in `kubernetes/strategies/canary/canary-analysis.yaml` with three Prometheus queries:

| Metric | Threshold | Window |
|--------|-----------|--------|
| Success rate | ≥ 99% | 60s |
| P99 latency | < 500ms | 60s |
| Error rate | ≤ 1% | 60s |

---

## Operations Scripts

All scripts live in `deployments/scripts/` and share consistent flags:

```mermaid
graph LR
  Deploy["deploy.sh<br/><i>Build, push, deploy</i>"] --> Health["health-check.sh<br/><i>Verify deployment</i>"]
  Deploy --> Rollback["rollback.sh<br/><i>Undo deployment</i>"]
  Deploy --> BGSwitch["blue-green-switch.sh<br/><i>Switch traffic slots</i>"]

  Backup["db-backup.sh<br/><i>Backup SQLite</i>"] --> Restore["db-restore.sh<br/><i>Restore from backup</i>"]

  Teardown["teardown.sh<br/><i>Destroy environment</i>"] -.->|"Requires confirmation"| Deploy

  style Deploy fill:#4caf50,color:#fff
  style Rollback fill:#ff9800,color:#fff
  style Teardown fill:#f44336,color:#fff
```

### deploy.sh

The primary deployment orchestrator. Builds images, pushes to registry, and deploys using your chosen method and strategy.

```bash
# Basic deployment
./deployments/scripts/deploy.sh --env dev --method helm

# Production with blue-green
./deployments/scripts/deploy.sh \
  --env production \
  --method helm \
  --strategy blue-green \
  --tag v1.2.3

# Dry run (preview changes)
./deployments/scripts/deploy.sh \
  --env staging --method kustomize --dry-run

# Skip image build (use existing image)
./deployments/scripts/deploy.sh \
  --env production --method helm --skip-build --tag sha-abc1234

# Terraform deployment
./deployments/scripts/deploy.sh --env production --method terraform
```

### health-check.sh

Comprehensive health verification — HTTP endpoint, WebSocket connectivity, and response time thresholds.

```bash
# Basic health check
./deployments/scripts/health-check.sh --url http://localhost:4820

# With custom thresholds
./deployments/scripts/health-check.sh \
  --url https://monitor.example.com \
  --retries 60 \
  --interval 10 \
  --threshold 1000

# JSON output (for CI pipelines)
./deployments/scripts/health-check.sh \
  --url http://localhost:4820 --json

# Skip WebSocket check
./deployments/scripts/health-check.sh \
  --url http://localhost:4820 --no-websocket
```

### rollback.sh

Roll back to a previous deployment version.

```bash
# Roll back Helm to previous release
./deployments/scripts/rollback.sh --env production --method helm

# Roll back to specific revision
./deployments/scripts/rollback.sh --env production --method helm --revision 5

# Roll back Kustomize deployment
./deployments/scripts/rollback.sh --env staging --method kustomize
```

### blue-green-switch.sh

Switch live traffic between blue and green deployment slots.

```bash
# Switch production to green
./deployments/scripts/blue-green-switch.sh --env production --target green

# Instant rollback to blue
./deployments/scripts/blue-green-switch.sh --env production --target blue

# Dry run
./deployments/scripts/blue-green-switch.sh \
  --env production --target green --dry-run
```

### db-backup.sh / db-restore.sh

Back up and restore the SQLite database from Kubernetes PVCs.

```bash
# Backup
./deployments/scripts/db-backup.sh \
  --env production --output ./backups

# Backup with S3 upload
./deployments/scripts/db-backup.sh \
  --env production --output ./backups \
  --upload s3://my-bucket/backups/

# Restore from backup
./deployments/scripts/db-restore.sh \
  --env production --input ./backups/dashboard-20240128-143022.db.gz
```

### teardown.sh

Destroy an entire environment. Requires explicit confirmation for production.

```bash
# Tear down dev environment
./deployments/scripts/teardown.sh --env dev --method helm

# Tear down production (requires typing environment name to confirm)
./deployments/scripts/teardown.sh --env production --method terraform

# Also delete PVCs (permanent data loss)
./deployments/scripts/teardown.sh \
  --env staging --method helm --delete-pvc
```

---

## CI/CD Pipelines

Pre-built pipelines for GitHub Actions and GitLab CI.

### Pipeline Flow

```mermaid
graph LR
  subgraph "CI Pipeline"
    Lint["Lint &<br/>Typecheck"] --> Test["Unit<br/>Tests"]
    Test --> Build["Build<br/>Images"]
    Build --> Scan["Security<br/>Scan (Trivy)"]
  end

  subgraph "CD Pipeline"
    Scan --> DeployStg["Deploy<br/>Staging"]
    DeployStg --> SmokeTest["Smoke<br/>Tests"]
    SmokeTest --> Gate["Manual<br/>Approval"]
    Gate --> DeployProd["Deploy<br/>Production"]
    DeployProd --> HealthCheck["Health<br/>Check"]
  end

  subgraph "Safety"
    HealthCheck -->|Fail| AutoRollback["Auto<br/>Rollback"]
    DeployProd -->|Manual| ManualRollback["Manual<br/>Rollback"]
  end

  style Scan fill:#e91e63,color:#fff
  style Gate fill:#ff9800,color:#fff
  style AutoRollback fill:#f44336,color:#fff
```

### GitHub Actions

Three workflow files in `deployments/ci/github-actions/`:

| Workflow | Trigger | Actions |
|----------|---------|---------|
| `ci.yaml` | Push, PR | Lint, test, build images, Trivy scan |
| `deploy.yaml` | Tag `v*`, manual | Deploy to staging → approval → production |
| `rollback.yaml` | Manual | Roll back any environment |

```bash
# Copy workflows to your repo
cp -r deployments/ci/github-actions/*.yaml .github/workflows/

# Required GitHub secrets:
# - KUBE_CONFIG         (base64 kubeconfig)
# - REGISTRY_USERNAME   (container registry user)
# - REGISTRY_PASSWORD   (container registry token)
```

### GitLab CI

Single pipeline file in `deployments/ci/gitlab-ci/`:

```bash
# Copy to repo root
cp deployments/ci/gitlab-ci/.gitlab-ci.yml .

# Required CI/CD variables:
# - KUBE_CONFIG         (base64 kubeconfig, type: File)
# - CI_REGISTRY_USER    (auto-provided by GitLab)
# - CI_REGISTRY_PASSWORD (auto-provided by GitLab)
```

---

## Monitoring & Observability

### Stack Overview

```mermaid
graph TB
  App[Agent Monitor<br/>Pods] -->|"/metrics"| Prom[Prometheus<br/>Scraping & Storage]
  App -->|"logs + metrics"| OTEL[OTel Collector<br/>DaemonSet]
  Prom --> Graf[Grafana<br/>Dashboards]
  Prom --> AM[Alertmanager<br/>Routing & Notifications]
  OTEL -->|"OTLP gRPC"| CX[Coralogix<br/>Full-Stack Observability]

  AM --> Slack[Slack]
  AM --> PD[PagerDuty]
  AM --> Email[Email]
  CX --> CXA[Coralogix Alerts]
  CXA --> PD
  CXA --> Slack

  subgraph "Grafana Dashboard"
    P1[Request Rate]
    P2[Error Rate]
    P3[Latency P50/P95/P99]
    P4[WebSocket Connections]
    P5[CPU / Memory Usage]
    P6[SQLite Operations]
  end

  subgraph "Coralogix Dashboard"
    C1[Log Analytics / DataPrime]
    C2[Metrics + Recording Rules]
    C3[SLO Tracking + Error Budget]
    C4[Distributed Tracing]
  end

  Graf --- P1 & P2 & P3 & P4 & P5 & P6
  CX --- C1 & C2 & C3 & C4

  style Prom fill:#e6522c,color:#fff
  style Graf fill:#f46800,color:#fff
  style AM fill:#e6522c,color:#fff
  style CX fill:#1a1a2e,color:#fff
  style OTEL fill:#4f46e5,color:#fff
  style CXA fill:#dc2626,color:#fff
```

### Setup

```bash
# Import Grafana dashboard
# File: deployments/monitoring/grafana/dashboards/agent-monitor.json
# → Import via Grafana UI: Dashboards → Import → Upload JSON

# Apply Prometheus rules
kubectl apply -f deployments/monitoring/prometheus/rules/agent-monitor.rules.yaml

# Apply Prometheus scrape config
# Merge deployments/monitoring/prometheus/prometheus.yaml into your Prometheus config

# Apply Alertmanager config
# Merge deployments/monitoring/alertmanager/alertmanager.yaml into your Alertmanager config

# Deploy Coralogix OTel Collector (optional – full-stack observability)
helm repo add coralogix https://cgx.jfrog.io/artifactory/coralogix-charts-virtual
kubectl create secret generic coralogix-keys \
  --namespace agent-monitor \
  --from-literal=PRIVATE_KEY=<YOUR_CORALOGIX_KEY>
helm install coralogix-otel coralogix/opentelemetry \
  --namespace agent-monitor \
  -f deployments/monitoring/coralogix/values.yaml
```

### Alert Rules

13 alert rules organized by category:

| Alert | Severity | Condition |
|-------|----------|-----------|
| `AgentMonitorDown` | critical | Instance unreachable > 2min |
| `HighErrorRate` | critical | 5xx rate > 5% for 5min |
| `HighLatency` | warning | P95 latency > 2s for 5min |
| `WebSocketConnectionSpike` | warning | WS connections > 1000 |
| `HighMemoryUsage` | warning | Memory > 85% of limit |
| `HighCpuUsage` | warning | CPU > 80% for 10min |
| `PVNearlyFull` | critical | PV usage > 90% |
| `PodRestartLooping` | critical | > 5 restarts in 15min |
| `HpaMaxedOut` | warning | Replicas at max for 15min |
| `SlowDatabaseQueries` | warning | DB query time > 1s |

### Grafana Dashboard

The pre-built dashboard (`agent-monitor.json`) includes 16 panels across 6 rows:

- **Overview** — Request rate, active sessions, WebSocket connections
- **HTTP Performance** — Latency histograms, status code distribution, error rate
- **WebSocket** — Connection count, message throughput, connection duration
- **Database** — Query duration, row counts, WAL checkpoint time
- **Resources** — CPU, memory, network I/O, filesystem usage
- **Deployment** — Pod status, restart count, HPA scaling events

### Coralogix Dashboard

The Coralogix custom dashboard (`monitoring/coralogix/dashboards.yaml`) provides 18 panels across 6 rows with SLO tracking:

- **Overview** — Active sessions, request rate, WebSocket connections
- **HTTP Performance** — Latency P50/P95/P99, error rate with thresholds, status code distribution
- **Application Logs** — Error log stream via DataPrime, log volume by severity, hook event throughput
- **Infrastructure** — CPU, memory, pod status gauges
- **Database & Storage** — SQLite query duration, PV usage gauge, network I/O
- **SLO Tracking** — Availability SLO (99.9% target), latency SLO (P95 < 500ms), error budget remaining

---

## Security Model

```mermaid
graph TB
  subgraph "Network Security"
    NS1[Private subnets for compute]
    NS2[NetworkPolicy: restricted egress]
    NS3[TLS 1.3 at load balancer]
    NS4[HSTS enforcement]
  end

  subgraph "Pod Security"
    PS1[Restricted PSS enforcement]
    PS2[runAsNonRoot / UID 1000]
    PS3[readOnlyRootFilesystem]
    PS4[Drop ALL capabilities]
    PS5[Seccomp RuntimeDefault]
    PS6[No privilege escalation]
    PS7[No automount SA token]
  end

  subgraph "Data Security"
    DS1[Encrypted storage at rest]
    DS2[Encrypted transit NFS]
    DS3[DB backups before destructive ops]
    DS4[Production confirmation gates]
  end

  subgraph "CI/CD Security"
    CS1[OIDC auth - no long-lived creds]
    CS2[Trivy vulnerability scanning]
    CS3[Pipeline blocks on CRITICAL/HIGH CVEs]
    CS4[GitHub Environment protection rules]
  end
```

---

## Directory Reference

```
deployments/
├── ci/                          # CI/CD pipeline definitions
│   ├── github-actions/
│   │   ├── ci.yaml              # Build, test, scan
│   │   ├── deploy.yaml          # Staged deployment
│   │   └── rollback.yaml        # Emergency rollback
│   └── gitlab-ci/
│       └── .gitlab-ci.yml       # Full GitLab pipeline
├── helm/
│   └── agent-monitor/           # Helm chart
│       ├── Chart.yaml
│       ├── values.yaml          # Default values
│       ├── values-dev.yaml      # Dev overrides
│       ├── values-staging.yaml  # Staging overrides
│       ├── values-production.yaml # Production overrides
│       └── templates/           # 12 Kubernetes templates
├── kubernetes/                  # Kustomize manifests
│   ├── base/                    # 11 base resources
│   ├── overlays/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── production/
│   ├── components/
│   │   ├── mcp-sidecar/         # Optional MCP sidecar
│   │   └── monitoring/          # Optional ServiceMonitor
│   └── strategies/
│       ├── blue-green/          # Blue-green deployments
│       └── canary/              # Canary with analysis
├── monitoring/
│   ├── alertmanager/            # Alert routing config
│   ├── coralogix/               # Coralogix full-stack observability
│   │   ├── values.yaml          # OTel Collector Helm values
│   │   ├── alerts.yaml          # Alert definitions
│   │   ├── dashboards.yaml      # Custom dashboard (18 panels)
│   │   └── coralogix-terraform.tf  # Terraform-managed resources
│   ├── grafana/
│   │   ├── dashboards/          # Pre-built dashboard JSON
│   │   └── datasources.yaml
│   └── prometheus/
│       ├── prometheus.yaml      # Scrape configuration
│       └── rules/               # 13 alerting rules
├── scripts/                     # Operational scripts
│   ├── deploy.sh                # Primary deploy orchestrator
│   ├── rollback.sh              # Version rollback
│   ├── blue-green-switch.sh     # Traffic slot switching
│   ├── health-check.sh          # Deployment verification
│   ├── db-backup.sh             # Database backup
│   ├── db-restore.sh            # Database restore
│   └── teardown.sh              # Environment teardown
└── terraform/                   # Infrastructure as Code
    ├── main.tf                  # Root module
    ├── variables.tf             # Input variables
    ├── outputs.tf               # Output values
    ├── versions.tf              # Provider version constraints
    ├── backend.tf               # State backend configs
    ├── modules/
    │   ├── networking/          # VPC, subnets, security groups
    │   ├── compute/             # Container orchestration
    │   ├── database/            # Persistent storage
    │   ├── loadbalancer/        # ALB with TLS & WebSocket
    │   └── monitoring/          # Alarms & dashboards
    ├── providers/
    │   ├── aws/                 # ECS Fargate + ALB + EFS
    │   ├── gcp/                 # Cloud Run + GCLB + Filestore
    │   ├── azure/               # ACI + App Gateway + Files
    │   └── oci/                 # OKE + LBaaS + FSS
    └── environments/
        ├── dev/
        ├── staging/
        └── production/
```

---

## Common Workflows

### First Production Deployment

```mermaid
graph TD
  A[1. Build image] --> B[2. Push to registry]
  B --> C[3. Create namespace]
  C --> D[4. Deploy with Helm]
  D --> E[5. Health check]
  E -->|Pass| F[6. Configure DNS]
  E -->|Fail| G[6. Rollback]
  F --> H[7. Enable monitoring]
```

```bash
# 1–2. Build and push
docker build -t ghcr.io/your-org/agent-monitor:v1.0.0 .
docker push ghcr.io/your-org/agent-monitor:v1.0.0

# 3–4. Deploy
./deployments/scripts/deploy.sh \
  --env production \
  --method helm \
  --tag v1.0.0 \
  --skip-build

# 5. Verify
./deployments/scripts/health-check.sh --url https://monitor.example.com

# 7. Enable monitoring
helm upgrade agent-monitor deployments/helm/agent-monitor \
  -f deployments/helm/agent-monitor/values-production.yaml \
  --set monitoring.enabled=true \
  -n agent-monitor-production
```

### Zero-Downtime Release

```bash
# 1. Deploy new version to green slot
./deployments/scripts/deploy.sh \
  --env production --method helm \
  --strategy blue-green --tag v1.1.0

# 2. Verify green is healthy
./deployments/scripts/health-check.sh \
  --url http://green-internal:4820

# 3. Switch traffic
./deployments/scripts/blue-green-switch.sh \
  --env production --target green

# 4. Verify production
./deployments/scripts/health-check.sh \
  --url https://monitor.example.com

# 5. If something goes wrong — instant rollback
./deployments/scripts/blue-green-switch.sh \
  --env production --target blue
```

### Disaster Recovery

```bash
# 1. Backup current state
./deployments/scripts/db-backup.sh \
  --env production --output ./backups

# 2. Restore from backup
./deployments/scripts/db-restore.sh \
  --env production \
  --input ./backups/dashboard-latest.db.gz

# 3. Verify
./deployments/scripts/health-check.sh --url https://monitor.example.com
```

---

## Troubleshooting

### Pod not starting

```bash
# Check pod status
kubectl get pods -n agent-monitor-production

# Check events
kubectl describe pod <pod-name> -n agent-monitor-production

# Check logs
kubectl logs <pod-name> -n agent-monitor-production
```

### WebSocket connections dropping

The dashboard requires WebSocket sticky sessions. Verify:

```bash
# Helm: check service session affinity
kubectl get svc -n agent-monitor-production -o yaml | grep -A5 sessionAffinity

# Ingress: check WebSocket annotations
kubectl get ingress -n agent-monitor-production -o yaml | grep -A10 annotations
```

Required ingress annotations for WebSocket:
```yaml
nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
```

### Database locked errors

SQLite supports one writer at a time. Ensure:

1. PVC access mode is `ReadWriteOnce` (not `ReadWriteMany`)
2. Only one pod writes at a time (replica count or leader election)
3. WAL mode is enabled (default in the application)

### Terraform state issues

```bash
# Refresh state
terraform refresh -var-file=environments/production/terraform.tfvars

# Import existing resource
terraform import -var-file=environments/production/terraform.tfvars \
  module.networking.aws_vpc.main vpc-12345

# Unlock state (if locked by a failed run)
terraform force-unlock <lock-id>
```
