# Kubernetes deployment

The Kustomize stack deploys one CCAM dashboard writer with a retained
ReadWriteOnce PVC and `strategy.type: Recreate`. This is the supported SQLite
production topology.

## Render

```bash
kubectl kustomize deployments/kubernetes/base
kubectl kustomize deployments/kubernetes/overlays/production
```

The overlays create `agent-monitor-dev`, `agent-monitor-staging`, or
`agent-monitor-production` and keep the same one-writer contract.

## Required Secret

Create `agent-monitor-secrets` in the target namespace with:

- `dashboard-token`
- `hook-token`
- `mcp-token`

Use External Secrets Operator or the cloud's secret controller in production.

## Optional components

| Component | Purpose |
| --- | --- |
| `components/mcp-sidecar` | Authenticated MCP sidecar, private Service, NetworkPolicy |
| `components/monitoring` | Bearer-authenticated Prometheus Operator ServiceMonitor |
| `components/gateway-api` | Gateway API v1 HTTPRoute and removal of base Ingress |
| `components/volume-snapshot` | Manual CSI VolumeSnapshot template |

Create a local Kustomization that references the base and desired components.
MCP is available only from namespaces labeled `ccam.dev/mcp-client=true`.

## Security

- Restricted Pod Security Standard labels
- non-root UID/GID 1000
- read-only root filesystems
- all capabilities dropped
- RuntimeDefault seccomp
- no service-account token mount
- token files mounted from Secret
- Nginx/Gateway/Ingress handles TLS and WebSockets

## Validate

```bash
npm run deploy:validate
```

See [`../../DEPLOYMENT.md`](../../DEPLOYMENT.md) for backup, restore, rollout,
Gateway API, monitoring, and cloud-provider guidance.
