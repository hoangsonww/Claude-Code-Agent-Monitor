# Terraform deployment

This module deploys CCAM to an existing conformant Kubernetes cluster through
the validated Helm chart. It works with EKS, GKE, AKS, OKE, or self-managed
Kubernetes because cloud infrastructure and identity are supplied by the
cluster, CSI driver, ingress or Gateway implementation, and secret controller.

It deliberately does not provision cloud networks, load balancers, or container
services. The previous provider-specific tree mixed AWS resources into a
supposedly cloud-neutral root and allowed several active SQLite writers. That
was not a safe portable production contract.

## Prerequisites

- Terraform 1.7 or newer
- An existing Kubernetes cluster and kubeconfig
- A default or named ReadWriteOnce CSI StorageClass
- An existing Secret with `dashboard-token`, `hook-token`, and `mcp-token`
- An Ingress controller or Gateway API implementation when public access is needed
- Prometheus Operator when `service_monitor_enabled = true`

## Apply

```bash
cd deployments/terraform
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

Use your cloud secret controller or External Secrets Operator to create
`agent-monitor-secrets`. Do not put production tokens in Terraform variables or
state.

## Safety

The module and Helm schema both reject more than one replica and reject HPA.
CCAM uses SQLite and supports one active dashboard writer per persistent volume.
Upgrades use Helm atomic Recreate rollouts. Back up with
`deployments/scripts/db-backup.sh` before production changes.
