#!/usr/bin/env bash
# validate-deployment.sh — static release gate for CCAM container and cloud
# deployment assets. It enforces the single-writer SQLite topology and validates
# Docker, Compose, Nginx, Helm, Kustomize, dependency, and header contracts.
# @author Son Nguyen <hoangson091104@gmail.com>

set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly CHART_DIR="${PROJECT_ROOT}/deployments/helm/agent-monitor"
readonly KUSTOMIZE_DIR="${PROJECT_ROOT}/deployments/kubernetes"

log() { printf '[deployment-check] %s\n' "$*"; }
fatal() { printf '[deployment-check] ERROR: %s\n' "$*" >&2; exit 1; }

audit_production_dependencies() {
  local label="$1"
  shift
  local attempt=1
  local max_attempts=3
  local retry_base_seconds="${CCAM_AUDIT_RETRY_BASE_SECONDS:-2}"
  local output errors status vulnerabilities stdout_file stderr_file

  if [[ ! "$retry_base_seconds" =~ ^[0-9]+$ ]]; then
    retry_base_seconds=2
  else
    retry_base_seconds=$((10#$retry_base_seconds))
  fi

  while (( attempt <= max_attempts )); do
    stdout_file="$(mktemp)"
    stderr_file="$(mktemp)"
    "$@" audit --omit=dev --json >"$stdout_file" 2>"$stderr_file" && status=0 || status=$?
    output="$(cat "$stdout_file")"
    errors="$(cat "$stderr_file")"
    rm -f "$stdout_file" "$stderr_file"
    if ! vulnerabilities="$(
      printf '%s' "$output" | node -e '
        let body = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => (body += chunk));
        process.stdin.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            const count = Number(parsed?.metadata?.vulnerabilities?.total);
            if (!Number.isFinite(count)) process.exit(2);
            process.stdout.write(String(count));
          } catch {
            process.exit(2);
          }
        });
      '
    )"; then
      if (( attempt < max_attempts )); then
        log "${label} audit transport failure (attempt ${attempt}/${max_attempts}); retrying"
        [[ -n "$errors" ]] && printf '%s\n' "$errors" >&2
        [[ -n "$output" ]] && printf '%s\n' "$output" >&2
        local retry_delay=$(( attempt * retry_base_seconds ))
        log "${label} audit retrying after ${retry_delay}s"
        sleep "$retry_delay"
        ((attempt += 1))
        continue
      fi
      [[ -n "$errors" ]] && printf '%s\n' "$errors" >&2
      [[ -n "$output" ]] && printf '%s\n' "$output" >&2
      fatal "${label} audit could not retrieve a valid registry report after ${max_attempts} attempts"
    fi

    if (( vulnerabilities > 0 )); then
      [[ -n "$errors" ]] && printf '%s\n' "$errors" >&2
      printf '%s\n' "$output" >&2
      fatal "${label} production dependency audit found ${vulnerabilities} vulnerability record(s)"
    fi
    if (( status != 0 )); then
      [[ -n "$errors" ]] && printf '%s\n' "$errors" >&2
      printf '%s\n' "$output" >&2
      fatal "${label} production dependency audit exited ${status} despite reporting zero vulnerabilities"
    fi
    log "${label} production dependency audit passed"
    return
  done
}

need() {
  command -v "$1" >/dev/null 2>&1 || fatal "missing required command: $1"
}

assert_single_writer() {
  local manifest="$1"
  grep -q '^kind: Deployment$' "$manifest" || fatal "no Deployment in ${manifest}"
  grep -q '^  replicas: 1$' "$manifest" || fatal "replicas must be exactly 1 in ${manifest}"
  grep -q '^    type: Recreate$' "$manifest" || fatal "Deployment must use Recreate in ${manifest}"
  if grep -Eq '^kind: (HorizontalPodAutoscaler|PodDisruptionBudget)$' "$manifest"; then
    fatal "HPA/PDB are unsupported for the SQLite topology in ${manifest}"
  fi
}

assert_no_unsafe_assets() {
  local unsafe_matches
  unsafe_matches="$(
    find "${KUSTOMIZE_DIR}" -type f \( -name '*.yaml' -o -name '*.yml' \) \
      -exec grep -EnH \
        '\$\{IMAGE_|newTag: (latest|dev|staging)|replicas: [2-9]|minReplicas:|maxReplicas:|kind: HorizontalPodAutoscaler|kind: PodDisruptionBudget|app.kubernetes.io/version: "1\.0\.0"' \
        {} + || true
  )"
  if [[ -n "$unsafe_matches" ]]; then
    printf '%s\n' "$unsafe_matches"
    fatal "unsafe or stale Kubernetes deployment values remain"
  fi
}

validate_docker() {
  need docker
  log "Dockerfile static checks"
  docker build --check --target runtime -t ccam-dashboard:check "${PROJECT_ROOT}" >/dev/null
  docker build --check --target agent-runtime -t ccam-dashboard-agent:check "${PROJECT_ROOT}" >/dev/null
  docker build --check -f "${PROJECT_ROOT}/mcp/Dockerfile" --target runtime \
    -t ccam-mcp:check "${PROJECT_ROOT}" >/dev/null

  log "Compose rendering"
  docker compose -f "${PROJECT_ROOT}/docker-compose.yml" config >/dev/null
  local full_services
  full_services="$(
    docker compose -f "${PROJECT_ROOT}/docker-compose.full.yml" \
      --profile mcp --profile edge config --services
  )"
  for service in agent-monitor mcp nginx prometheus grafana; do
    grep -qx "$service" <<<"$full_services" || fatal "full Compose stack is missing ${service}"
  done

  log "Nginx syntax"
  docker run --rm --add-host agent-monitor:127.0.0.1 \
    -v "${PROJECT_ROOT}/deployments/nginx/nginx.conf:/etc/nginx/nginx.conf.template:ro" \
    -v "${PROJECT_ROOT}/deployments/nginx/conf.d:/etc/nginx/conf.d:ro" \
    -v "${PROJECT_ROOT}/deployments/nginx/snippets/hooks-blocked.conf:/etc/nginx/snippets/hooks-policy.conf:ro" \
    -v "${PROJECT_ROOT}/deployments/nginx/snippets/mcp-blocked.conf:/etc/nginx/snippets/mcp-policy.conf:ro" \
    --entrypoint /bin/sh nginxinc/nginx-unprivileged:1.30.0-alpine@sha256:808f7846d21a9c94cf53833e8807a00a33fd0b65cc47fb05b79efe366c2d201f -c \
    'resolver=$(awk '\''/^nameserver[[:space:]]+/ {print $2; exit}'\'' /etc/resolv.conf); sed "s/__CCAM_DNS_RESOLVER__/${resolver}/g" /etc/nginx/nginx.conf.template >/tmp/nginx.conf; nginx -t -c /tmp/nginx.conf' \
    >/dev/null
}

validate_helm() {
  need helm
  log "Helm lint and environment renders"
  helm lint "${CHART_DIR}" --strict >/dev/null
  for values in values.yaml values-dev.yaml values-staging.yaml values-production.yaml; do
    local output
    output="$(mktemp)"
    helm template ccam "${CHART_DIR}" -f "${CHART_DIR}/${values}" \
      --namespace agent-monitor >"$output"
    assert_single_writer "$output"
    rm -f "$output"
  done

  log "Helm schema rejects unsafe scaling"
  if helm template unsafe "${CHART_DIR}" --set replicaCount=2 >/dev/null 2>&1; then
    fatal "Helm accepted replicaCount=2"
  fi
  if helm template unsafe "${CHART_DIR}" --set autoscaling.enabled=true >/dev/null 2>&1; then
    fatal "Helm accepted autoscaling.enabled=true"
  fi
}

validate_kustomize() {
  need kubectl
  log "Kustomize base and overlays"
  for target in base overlays/dev overlays/staging overlays/production; do
    local output
    output="$(mktemp)"
    kubectl kustomize "${KUSTOMIZE_DIR}/${target}" >"$output"
    assert_single_writer "$output"
    rm -f "$output"
  done

  log "Kustomize optional components"
  local composition output
  composition="${KUSTOMIZE_DIR}/.validation-$$"
  output="$(mktemp)"
  mkdir -p "$composition"
  trap 'rm -rf "${composition:-}"; rm -f "${output:-}"' EXIT
  cat >"${composition}/kustomization.yaml" <<'YAML'
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources: [../base]
components:
  - ../components/mcp-sidecar
  - ../components/monitoring
  - ../components/gateway-api
  - ../components/volume-snapshot
YAML
  kubectl kustomize "$composition" >"$output"
  for kind in HTTPRoute ServiceMonitor VolumeSnapshot; do
    grep -q "^kind: ${kind}$" "$output" || fatal "optional component missing ${kind}"
  done
  assert_single_writer "$output"
  rm -rf "$composition"
  rm -f "$output"
  trap - EXIT
  assert_no_unsafe_assets
}

validate_repo() {
  log "Production dependency audits"
  (cd "${PROJECT_ROOT}" && audit_production_dependencies "root" npm)
  (cd "${PROJECT_ROOT}" && audit_production_dependencies "MCP" npm --prefix mcp)
  log "Authorship headers"
  bash "${PROJECT_ROOT}/.claude/skills/file-headers/scripts/check-headers.sh" >/dev/null
}

validate_terraform() {
  log "Terraform format and provider validation"
  local terraform_dir="${PROJECT_ROOT}/deployments/terraform"
  if command -v terraform >/dev/null 2>&1; then
    (
      cd "$terraform_dir"
      terraform fmt -check -recursive
      terraform init -backend=false -input=false >/dev/null
      terraform validate >/dev/null
      rm -rf .terraform
    )
    return
  fi
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    --env HOME=/tmp \
    --env TF_DATA_DIR=/tmp/ccam-terraform-data \
    -v "${PROJECT_ROOT}:/workspace" \
    -w /workspace/deployments/terraform \
    --entrypoint /bin/sh \
    hashicorp/terraform:1.15.8@sha256:7ae513256f7ce67879e218ae8593d6fbe216ec9e123abe6c94e4e10704857963 \
    -c 'terraform fmt -check -recursive &&
        terraform init -backend=false -input=false >/dev/null &&
        terraform validate >/dev/null'
}

main() {
  cd "${PROJECT_ROOT}"
  validate_docker
  validate_helm
  validate_kustomize
  validate_terraform
  validate_repo
  log "all deployment checks passed"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
