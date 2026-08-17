# Deployment infrastructure

This directory contains the supported production deployment surface for CCAM.
The complete operator guide is [`../DEPLOYMENT.md`](../DEPLOYMENT.md).

## Supported topology

CCAM uses SQLite and supports **one active dashboard writer per persistent
volume**. The deployment assets enforce one replica and a Recreate strategy.
HPA, active-active replicas, blue-green, and canary deployments are intentionally
not shipped while SQLite remains the persistence backend.

## Directory map

| Path | Purpose |
| --- | --- |
| `helm/agent-monitor/` | Helm 4-compatible chart with safety schema, digest support, retained PVC, Ingress/Gateway API, MCP, NetworkPolicy, and ServiceMonitor |
| `kubernetes/base/` | Restricted-PSS Kustomize base with one Recreate-managed writer |
| `kubernetes/overlays/` | Dev, staging, and production resources and namespaces |
| `kubernetes/components/` | Optional MCP, monitoring, Gateway API, and CSI snapshot layers |
| `nginx/` | Rootless Nginx edge with WebSocket support and default-blocked hooks, metrics, and MCP routes |
| `secrets/` | Ignored local secret-file contract for Compose |
| `terraform/` | Provider-neutral deployment to an existing Kubernetes cluster through the validated Helm chart |
| `scripts/` | Validation, deploy, backup, restore, rollback, health, and teardown operations |

## Validate

```bash
npm run deploy:validate
```

The gate checks Dockerfiles, Compose profiles, Nginx, Helm, Kustomize,
Terraform, dependency audits, authorship headers, and the one-writer invariant.

## Container stack

```bash
umask 077
openssl rand -hex 32 > deployments/secrets/dashboard-token
openssl rand -hex 32 > deployments/secrets/hook-token
openssl rand -hex 32 > deployments/secrets/mcp-token
openssl rand -base64 32 > deployments/secrets/grafana-admin-password
npm run docker:full:up
```

The full stack starts dashboard, authenticated MCP, rootless Nginx, Prometheus,
and Grafana. Every host port binds loopback by default.

## Kubernetes

Create `agent-monitor-secrets` with `dashboard-token`, `hook-token`, and
`mcp-token`, then use Helm or Kustomize. Prefer immutable image tags or digests.

```bash
REGISTRY="ghcr.io/$(gh repo view --json owner -q .owner.login)"
IMAGE_TAG="$(git rev-parse --short HEAD)"
helm upgrade --install agent-monitor deployments/helm/agent-monitor \
  --namespace agent-monitor-production \
  --create-namespace \
  --values deployments/helm/agent-monitor/values-production.yaml \
  --set image.registry= \
  --set image.repository=${REGISTRY}/claude-code-agent-monitor \
  --set image.tag=${IMAGE_TAG} \
  --atomic --wait --timeout 10m
```

## Operations

```bash
./deployments/scripts/db-backup.sh --env production \
  --namespace agent-monitor-production --output ./backups

./deployments/scripts/deploy.sh --env production --method helm \
  --registry "${REGISTRY}" --image claude-code-agent-monitor \
  --tag "${IMAGE_TAG}" --skip-build

./deployments/scripts/rollback.sh --env production --method helm \
  --namespace agent-monitor-production
```

Production deploy, restore, rollback, and teardown flows back up first and fail
closed when the backup cannot be verified.
