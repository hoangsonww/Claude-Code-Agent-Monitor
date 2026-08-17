#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh – Main deployment orchestrator for Claude Code Agent Monitor
#
# Usage:
#   ./deploy.sh --env dev|staging|production --method helm|kustomize
#   ./deploy.sh --env staging --method helm --dry-run
#   ./deploy.sh --help
# ─────────────────────────────────────────────────────────────────────────────
# @author Son Nguyen <hoangson091104@gmail.com>
set -euo pipefail

# ── Constants ───────────────────────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly DEPLOY_DIR="${PROJECT_ROOT}/deployments"
readonly APP_NAME="agent-monitor"
readonly APP_PORT=4820
readonly DEFAULT_REGISTRY="ghcr.io"
readonly DEFAULT_IMAGE_NAME="claude-code-agent-monitor"

# ── Colors & logging ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()   { echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"; }
info()  { echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${BLUE}ℹ${NC}  $*"; }
ok()    { echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${GREEN}✔${NC}  $*"; }
warn()  { echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${YELLOW}⚠${NC}  $*" >&2; }
err()   { echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${RED}✖${NC}  $*" >&2; }
fatal() { err "$@"; exit 1; }

banner() {
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${BLUE}║   Claude Code Agent Monitor – Deploy            ║${NC}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════╝${NC}"
  echo ""
}

# ── Default parameter values ────────────────────────────────────────────────
ENVIRONMENT=""
METHOD=""
DRY_RUN=false
IMAGE_TAG=""
REGISTRY="${DOCKER_REGISTRY:-$DEFAULT_REGISTRY}"
IMAGE_NAME="${DOCKER_IMAGE_NAME:-$DEFAULT_IMAGE_NAME}"
NAMESPACE=""
HELM_RELEASE="${APP_NAME}"
HELM_CHART_DIR="${DEPLOY_DIR}/helm/agent-monitor"
KUBE_CONTEXT=""
SKIP_BUILD=false
SKIP_HEALTH_CHECK=false
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=5
VALUES_FILE=""

# ── Usage ───────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}Usage:${NC}
  $(basename "$0") --env <environment> --method <method> [options]

${BOLD}Required:${NC}
  --env, -e          Environment: dev, staging, production
  --method, -m       Deployment method: helm, kustomize

${BOLD}Options:${NC}
  --tag, -t          Docker image tag (default: git SHA)
  --registry         Container registry (default: ${DEFAULT_REGISTRY})
  --image            Image name (default: ${DEFAULT_IMAGE_NAME})
  --namespace, -n    Kubernetes namespace (default: agent-monitor-<env>)
  --release          Helm release name (default: ${APP_NAME})
  --context          Kubernetes context to use
  --values           Additional Helm values file
  --skip-build       Skip container image build/push
  --skip-health      Skip post-deploy health check
  --dry-run          Preview changes without applying
  --help, -h         Show this help message

${BOLD}Examples:${NC}
  $(basename "$0") --env dev --method helm
  $(basename "$0") --env production --method helm --tag 2.0.8
  $(basename "$0") --env staging --method kustomize --dry-run

EOF
  exit 0
}

# ── Argument parsing ────────────────────────────────────────────────────────
parse_args() {
  [[ $# -eq 0 ]] && usage

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env|-e)         ENVIRONMENT="$2"; shift 2 ;;
      --method|-m)      METHOD="$2"; shift 2 ;;
      --tag|-t)         IMAGE_TAG="$2"; shift 2 ;;
      --registry)       REGISTRY="$2"; shift 2 ;;
      --image)          IMAGE_NAME="$2"; shift 2 ;;
      --namespace|-n)   NAMESPACE="$2"; shift 2 ;;
      --release)        HELM_RELEASE="$2"; shift 2 ;;
      --context)        KUBE_CONTEXT="$2"; shift 2 ;;
      --values)         VALUES_FILE="$2"; shift 2 ;;
      --skip-build)     SKIP_BUILD=true; shift ;;
      --skip-health)    SKIP_HEALTH_CHECK=true; shift ;;
      --dry-run)        DRY_RUN=true; shift ;;
      --help|-h)        usage ;;
      *)                fatal "Unknown option: $1. Use --help for usage." ;;
    esac
  done
}

# ── Validation ──────────────────────────────────────────────────────────────
validate_args() {
  [[ -z "$ENVIRONMENT" ]] && fatal "Missing required argument: --env"
  [[ -z "$METHOD" ]]      && fatal "Missing required argument: --method"

  case "$ENVIRONMENT" in
    dev|staging|production) ;;
    *) fatal "Invalid environment: $ENVIRONMENT. Must be dev, staging, or production." ;;
  esac

  case "$METHOD" in
    helm|kustomize) ;;
    *) fatal "Invalid method: $METHOD. Must be helm or kustomize." ;;
  esac

  # Default namespace
  [[ -z "$NAMESPACE" ]] && NAMESPACE="agent-monitor-${ENVIRONMENT}"

  # Default image tag from git
  if [[ -z "$IMAGE_TAG" ]]; then
    IMAGE_TAG="$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'latest')"
  fi

  readonly FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
  readonly MCP_IMAGE="${REGISTRY}/${IMAGE_NAME}-mcp:${IMAGE_TAG}"
}

# ── Prerequisite checks ────────────────────────────────────────────────────
check_prerequisites() {
  info "Checking prerequisites..."

  local missing=()

  # Always need docker for building
  if [[ "$SKIP_BUILD" == false ]]; then
    command -v docker &>/dev/null || missing+=("docker")
  fi

  case "$METHOD" in
    helm)
      command -v kubectl &>/dev/null || missing+=("kubectl")
      command -v helm &>/dev/null    || missing+=("helm")
      ;;
    kustomize)
      command -v kubectl &>/dev/null || missing+=("kubectl")
      ;;
  esac

  if [[ ${#missing[@]} -gt 0 ]]; then
    fatal "Missing required tools: ${missing[*]}. Please install them and retry."
  fi

  # Validate kube context if specified
  if [[ -n "$KUBE_CONTEXT" ]]; then
    if ! kubectl config get-contexts "$KUBE_CONTEXT" &>/dev/null; then
      fatal "Kubernetes context '$KUBE_CONTEXT' not found."
    fi
    kubectl config use-context "$KUBE_CONTEXT"
  fi

  # Validate Helm chart exists
  if [[ "$METHOD" == "helm" ]] && [[ ! -f "${HELM_CHART_DIR}/Chart.yaml" ]]; then
    fatal "Helm chart not found at ${HELM_CHART_DIR}"
  fi

  bash "${SCRIPT_DIR}/validate-deployment.sh"

  ok "All prerequisites satisfied"
}

# ── Build & push container images ───────────────────────────────────────────
build_and_push() {
  if [[ "$SKIP_BUILD" == true ]]; then
    info "Skipping image build (--skip-build)"
    return
  fi

  info "Building container images..."

  if [[ "$DRY_RUN" == true ]]; then
    info "[DRY-RUN] Would build: ${FULL_IMAGE}"
    info "[DRY-RUN] Would build: ${MCP_IMAGE}"
    return
  fi

  log "Building and pushing multi-platform images with SBOM and provenance attestations"
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --file "${PROJECT_ROOT}/Dockerfile" \
    --target runtime \
    --tag "${FULL_IMAGE}" \
    --provenance=mode=max \
    --sbom=true \
    --push \
    "${PROJECT_ROOT}"
  docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --file "${PROJECT_ROOT}/mcp/Dockerfile" \
    --target runtime \
    --tag "${MCP_IMAGE}" \
    --provenance=mode=max \
    --sbom=true \
    --push \
    "${PROJECT_ROOT}"
  ok "Images pushed to ${REGISTRY}"
}

# ── Helm deployment ─────────────────────────────────────────────────────────
deploy_helm() {
  info "Deploying via Helm with a single-writer Recreate rollout..."

  local helm_args=(
    upgrade --install "${HELM_RELEASE}" "${HELM_CHART_DIR}"
    --namespace "${NAMESPACE}"
    --create-namespace
    --set "image.registry="
    --set "image.repository=${REGISTRY}/${IMAGE_NAME}"
    --set "image.tag=${IMAGE_TAG}"
    --set "mcp.image.registry="
    --set "mcp.image.repository=${REGISTRY}/${IMAGE_NAME}-mcp"
    --set "mcp.image.tag=${IMAGE_TAG}"
    --timeout 600s
    --wait
    --atomic
  )

  # Environment-specific values
  local env_values="${HELM_CHART_DIR}/values-${ENVIRONMENT}.yaml"
  if [[ -f "$env_values" ]]; then
    helm_args+=(--values "$env_values")
  fi

  # User-provided values file
  if [[ -n "$VALUES_FILE" ]] && [[ -f "$VALUES_FILE" ]]; then
    helm_args+=(--values "$VALUES_FILE")
  fi

  if [[ "$DRY_RUN" == true ]]; then
    helm_args+=(--dry-run --debug)
    info "[DRY-RUN] Helm command:"
    echo "  helm ${helm_args[*]}"
    helm "${helm_args[@]}" 2>&1 | head -100
    return
  fi

  # Store current revision for rollback
  local current_revision
  current_revision=$(helm history "${HELM_RELEASE}" -n "${NAMESPACE}" --max 1 -o json 2>/dev/null \
    | grep -o '"revision":[0-9]*' | head -1 | cut -d: -f2 || echo "0")
  info "Current Helm revision: ${current_revision}"

  # Execute deployment
  if ! helm "${helm_args[@]}"; then
    err "Helm deployment failed!"
    if [[ "$current_revision" != "0" ]]; then
      warn "Attempting auto-rollback to revision ${current_revision}..."
      helm rollback "${HELM_RELEASE}" "${current_revision}" -n "${NAMESPACE}" --wait --timeout 300s \
        && ok "Auto-rollback to revision ${current_revision} succeeded" \
        || fatal "Auto-rollback also failed! Manual intervention required."
    fi
    exit 1
  fi

  ok "Helm deployment succeeded"
}

# ── Kustomize deployment ───────────────────────────────────────────────────
deploy_kustomize() {
  info "Deploying via Kustomize (overlay: ${ENVIRONMENT})..."

  local overlay_dir="${DEPLOY_DIR}/kubernetes/overlays/${ENVIRONMENT}"
  if [[ ! -d "$overlay_dir" ]]; then
    fatal "Kustomize overlay not found at ${overlay_dir}"
  fi

  if [[ "$DRY_RUN" == true ]]; then
    info "[DRY-RUN] Kustomize output:"
    kubectl kustomize "${overlay_dir}"
    return
  fi

  local rendered
  rendered="$(mktemp)"
  kubectl kustomize "${overlay_dir}" | sed "s|ccam-dashboard:2.0.8|${FULL_IMAGE}|g" > "${rendered}"
  if ! kubectl apply -f "${rendered}" --server-side --field-manager=ccam-deployer; then
    rm -f "${rendered}"
    err "Kustomize deployment failed!"
    warn "Run: kubectl rollout undo deployment/${APP_NAME} -n ${NAMESPACE}"
    exit 1
  fi
  rm -f "${rendered}"

  # Wait for rollout
  info "Waiting for rollout to complete..."
  if ! kubectl rollout status "deployment/${APP_NAME}" -n "${NAMESPACE}" --timeout=600s; then
    err "Rollout did not complete in time!"
    warn "Attempting auto-rollback..."
    kubectl rollout undo "deployment/${APP_NAME}" -n "${NAMESPACE}" \
      && ok "Auto-rollback succeeded" \
      || fatal "Auto-rollback failed! Manual intervention required."
    exit 1
  fi

  ok "Kustomize deployment succeeded"
}

# ── Post-deployment health check ───────────────────────────────────────────
run_health_check() {
  if [[ "$SKIP_HEALTH_CHECK" == true ]] || [[ "$DRY_RUN" == true ]]; then
    info "Skipping health check"
    return
  fi

  info "Running post-deployment health check..."
  local deployment_name service_name secret_name
  deployment_name=$(kubectl get deployment -n "${NAMESPACE}" \
    -l "app.kubernetes.io/name=${APP_NAME}" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  service_name=$(kubectl get service -n "${NAMESPACE}" \
    -l "app.kubernetes.io/name=${APP_NAME}" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)
  [[ -n "$deployment_name" ]] || fatal "No CCAM Deployment found in ${NAMESPACE}"
  [[ -n "$service_name" ]] || fatal "No CCAM Service found in ${NAMESPACE}"

  # Determine health check URL
  local health_url=""

  # Try to get service URL from cluster
  local svc_type
  svc_type=$(kubectl get svc "${service_name}" -n "${NAMESPACE}" -o jsonpath='{.spec.type}' 2>/dev/null || echo "")

  case "$svc_type" in
    LoadBalancer)
      local lb_host
      lb_host=$(kubectl get svc "${service_name}" -n "${NAMESPACE}" \
        -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
      [[ -z "$lb_host" ]] && lb_host=$(kubectl get svc "${service_name}" -n "${NAMESPACE}" \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
      [[ -n "$lb_host" ]] && health_url="http://${lb_host}/api/health"
      ;;
    NodePort)
      local node_port
      node_port=$(kubectl get svc "${service_name}" -n "${NAMESPACE}" \
        -o jsonpath='{.spec.ports[0].nodePort}' 2>/dev/null || echo "")
      [[ -n "$node_port" ]] && health_url="http://localhost:${node_port}/api/health"
      ;;
    *)
      # Use port-forward for ClusterIP
      info "Service type is ClusterIP – using kubectl port-forward for health check"
      local local_port=14820
      kubectl port-forward "svc/${service_name}" "${local_port}:80" -n "${NAMESPACE}" &
      local pf_pid=$!
      sleep 3
      health_url="http://localhost:${local_port}/api/health"
      ;;
  esac

  if [[ -z "$health_url" ]]; then
    warn "Could not determine health check URL. Checking pod readiness instead."
    if kubectl wait --for=condition=ready pod -l "app.kubernetes.io/name=${APP_NAME}" \
        -n "${NAMESPACE}" --timeout=120s; then
      ok "Pods are ready"
    else
      err "Pods did not become ready"
      trigger_auto_rollback
    fi
    return
  fi

  # Run health check script
  if [[ -x "${SCRIPT_DIR}/health-check.sh" ]]; then
    local token_file=""
    secret_name=$(kubectl get deployment "${deployment_name}" -n "${NAMESPACE}" \
      -o jsonpath='{.spec.template.spec.volumes[?(@.name=="secrets")].secret.secretName}' 2>/dev/null || true)
    if [[ -n "$secret_name" ]]; then
      token_file=$(mktemp)
      kubectl get secret "$secret_name" -n "${NAMESPACE}" \
        -o jsonpath='{.data.dashboard-token}' | base64 --decode > "$token_file"
      chmod 600 "$token_file"
    fi
    local health_args=(
      --url "${health_url}"
      --retries "${HEALTH_CHECK_RETRIES}"
      --interval "${HEALTH_CHECK_INTERVAL}"
    )
    [[ -n "$token_file" ]] && health_args+=(--token-file "$token_file")
    if ! "${SCRIPT_DIR}/health-check.sh" "${health_args[@]}"; then
      err "Health check failed after deployment!"
      # Kill port-forward if running
      [[ -n "${pf_pid:-}" ]] && kill "$pf_pid" 2>/dev/null || true
      trigger_auto_rollback
    fi
    [[ -n "$token_file" ]] && rm -f "$token_file"
  else
    # Inline health check
    local attempt=0
    while [[ $attempt -lt $HEALTH_CHECK_RETRIES ]]; do
      if curl -sf --max-time 5 "${health_url}" | grep -q '"status":"ok"'; then
        ok "Health check passed"
        [[ -n "${pf_pid:-}" ]] && kill "$pf_pid" 2>/dev/null || true
        return
      fi
      attempt=$((attempt + 1))
      info "Health check attempt ${attempt}/${HEALTH_CHECK_RETRIES}..."
      sleep "${HEALTH_CHECK_INTERVAL}"
    done
    err "Health check failed after ${HEALTH_CHECK_RETRIES} attempts!"
    [[ -n "${pf_pid:-}" ]] && kill "$pf_pid" 2>/dev/null || true
    trigger_auto_rollback
  fi

  # Cleanup port-forward
  [[ -n "${pf_pid:-}" ]] && kill "$pf_pid" 2>/dev/null || true
}

trigger_auto_rollback() {
  warn "Triggering auto-rollback..."
  case "$METHOD" in
    helm)
      helm rollback "${HELM_RELEASE}" -n "${NAMESPACE}" --wait --timeout 300s \
        && ok "Auto-rollback succeeded" \
        || fatal "Auto-rollback failed! Manual intervention required."
      ;;
    kustomize)
      local deployment_name
      deployment_name=$(kubectl get deployment -n "${NAMESPACE}" \
        -l "app.kubernetes.io/name=${APP_NAME}" \
        -o jsonpath='{.items[0].metadata.name}')
      kubectl rollout undo "deployment/${deployment_name}" -n "${NAMESPACE}" \
        && ok "Auto-rollback succeeded" \
        || fatal "Auto-rollback failed! Manual intervention required."
      ;;
  esac
  exit 1
}

# ── Production safety gate ──────────────────────────────────────────────────
confirm_production() {
  if [[ "$ENVIRONMENT" == "production" ]] && [[ "$DRY_RUN" == false ]]; then
    echo ""
    warn "You are about to deploy to ${BOLD}PRODUCTION${NC}"
    echo -e "  ${BOLD}Method:${NC}    ${METHOD}"
    echo -e "  ${BOLD}Strategy:${NC}  single-writer Recreate"
    echo -e "  ${BOLD}Image:${NC}     ${FULL_IMAGE}"
    echo -e "  ${BOLD}Namespace:${NC} ${NAMESPACE}"
    echo ""
    read -r -p "$(echo -e "${YELLOW}Type 'yes' to confirm:${NC} ")" confirm
    [[ "$confirm" == "yes" ]] || fatal "Deployment cancelled."
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
  banner
  parse_args "$@"
  validate_args

  info "Deployment configuration:"
  echo -e "  ${BOLD}Environment:${NC}  ${ENVIRONMENT}"
  echo -e "  ${BOLD}Method:${NC}       ${METHOD}"
  echo -e "  ${BOLD}Strategy:${NC}     single-writer Recreate"
  echo -e "  ${BOLD}Image:${NC}        ${FULL_IMAGE}"
  echo -e "  ${BOLD}Namespace:${NC}    ${NAMESPACE}"
  echo -e "  ${BOLD}Dry run:${NC}      ${DRY_RUN}"
  echo ""

  check_prerequisites
  confirm_production
  build_and_push

  if [[ "$ENVIRONMENT" == "production" && "$DRY_RUN" == false ]]; then
    if kubectl get deployment -n "${NAMESPACE}" \
        -l "app.kubernetes.io/name=${APP_NAME}" \
        -o name 2>/dev/null | grep -q .; then
      local backup_dir="${PROJECT_ROOT}/data/pre-deploy-backups"
      "${SCRIPT_DIR}/db-backup.sh" \
        --env production \
        --namespace "${NAMESPACE}" \
        --output "${backup_dir}"
    else
      info "No existing production deployment found; this is an initial install, so there is no database to back up."
    fi
  fi

  case "$METHOD" in
    helm)       deploy_helm ;;
    kustomize)  deploy_kustomize ;;
  esac

  run_health_check

  echo ""
  ok "${BOLD}Deployment complete!${NC}"
  echo -e "  ${BOLD}Environment:${NC}  ${ENVIRONMENT}"
  echo -e "  ${BOLD}Image:${NC}        ${FULL_IMAGE}"
  echo -e "  ${BOLD}Namespace:${NC}    ${NAMESPACE}"
  echo -e "  ${BOLD}Timestamp:${NC}    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
}

main "$@"
