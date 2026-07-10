#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# blue-green-switch.sh – Switch traffic between blue/green deployment slots
#
# Usage:
#   ./blue-green-switch.sh --env production --target green
#   ./blue-green-switch.sh --env production --target blue --skip-health
#   ./blue-green-switch.sh --help
# ─────────────────────────────────────────────────────────────────────────────
# @author Son Nguyen <hoangson091104@gmail.com>
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly APP_NAME="agent-monitor"
readonly APP_PORT=4820

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

# ── Defaults ────────────────────────────────────────────────────────────────
ENVIRONMENT=""
TARGET=""
NAMESPACE=""
SERVICE_NAME="${APP_NAME}"
SKIP_HEALTH_CHECK=false
DRY_RUN=false

# ── Usage ───────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}Usage:${NC}
  $(basename "$0") --env <environment> --target <blue|green> [options]

${BOLD}Required:${NC}
  --env, -e          Environment: dev, staging, production
  --target, -t       Target slot: blue, green

${BOLD}Options:${NC}
  --namespace, -n    Kubernetes namespace (default: agent-monitor-<env>)
  --service          Service name (default: ${APP_NAME})
  --skip-health      Skip health check on target before switching
  --dry-run          Show what would change without applying
  --help, -h         Show this help message

${BOLD}Examples:${NC}
  $(basename "$0") --env production --target green
  $(basename "$0") --env production --target blue   # instant rollback

EOF
  exit 0
}

# ── Argument parsing ────────────────────────────────────────────────────────
parse_args() {
  [[ $# -eq 0 ]] && usage

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env|-e)         ENVIRONMENT="$2"; shift 2 ;;
      --target|-t)      TARGET="$2"; shift 2 ;;
      --namespace|-n)   NAMESPACE="$2"; shift 2 ;;
      --service)        SERVICE_NAME="$2"; shift 2 ;;
      --skip-health)    SKIP_HEALTH_CHECK=true; shift ;;
      --dry-run)        DRY_RUN=true; shift ;;
      --help|-h)        usage ;;
      *)                fatal "Unknown option: $1" ;;
    esac
  done

  [[ -z "$ENVIRONMENT" ]] && fatal "Missing required argument: --env"
  [[ -z "$TARGET" ]]      && fatal "Missing required argument: --target"
  [[ -z "$NAMESPACE" ]]   && NAMESPACE="agent-monitor-${ENVIRONMENT}"

  case "$TARGET" in
    blue|green) ;;
    *) fatal "Invalid target: $TARGET. Must be 'blue' or 'green'." ;;
  esac
}

# ── Detect current active slot ──────────────────────────────────────────────
detect_current_slot() {
  local current
  current=$(kubectl get svc "${SERVICE_NAME}" -n "${NAMESPACE}" \
    -o jsonpath='{.spec.selector.slot}' 2>/dev/null || echo "")

  if [[ -z "$current" ]]; then
    # Try alternative label names
    current=$(kubectl get svc "${SERVICE_NAME}" -n "${NAMESPACE}" \
      -o jsonpath='{.spec.selector.deployment-slot}' 2>/dev/null || echo "")
  fi

  if [[ -z "$current" ]]; then
    current=$(kubectl get svc "${SERVICE_NAME}" -n "${NAMESPACE}" \
      -o jsonpath='{.spec.selector.color}' 2>/dev/null || echo "unknown")
  fi

  echo "$current"
}

# ── Check target slot is healthy ────────────────────────────────────────────
check_target_health() {
  if [[ "$SKIP_HEALTH_CHECK" == true ]]; then
    info "Skipping target health check (--skip-health)"
    return 0
  fi

  info "Checking health of ${BOLD}${TARGET}${NC} slot..."

  # Verify pods exist and are ready
  local ready_pods
  ready_pods=$(kubectl get pods -n "${NAMESPACE}" \
    -l "app.kubernetes.io/name=${APP_NAME},slot=${TARGET}" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")

  if [[ -z "$ready_pods" ]]; then
    # Try with 'color' label
    ready_pods=$(kubectl get pods -n "${NAMESPACE}" \
      -l "app.kubernetes.io/name=${APP_NAME},color=${TARGET}" \
      --field-selector=status.phase=Running \
      -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
  fi

  if [[ -z "$ready_pods" ]]; then
    # Try with 'deployment-slot' label
    ready_pods=$(kubectl get pods -n "${NAMESPACE}" \
      -l "app.kubernetes.io/name=${APP_NAME},deployment-slot=${TARGET}" \
      --field-selector=status.phase=Running \
      -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
  fi

  if [[ -z "$ready_pods" ]]; then
    fatal "No running pods found for ${TARGET} slot. Deploy first."
  fi

  info "Found running pods in ${TARGET} slot: ${ready_pods}"

  # Health check via port-forward to first pod
  local first_pod
  first_pod=$(echo "$ready_pods" | awk '{print $1}')
  local local_port=14821

  kubectl port-forward "pod/${first_pod}" "${local_port}:${APP_PORT}" -n "${NAMESPACE}" &
  local pf_pid=$!
  sleep 3

  local healthy=false
  for attempt in 1 2 3 4 5; do
    if curl -sf --max-time 5 "http://localhost:${local_port}/api/health" | grep -q '"status":"ok"'; then
      healthy=true
      break
    fi
    info "Health check attempt ${attempt}/5..."
    sleep 2
  done

  kill "$pf_pid" 2>/dev/null || true

  if [[ "$healthy" != true ]]; then
    fatal "${TARGET} slot is NOT healthy. Aborting traffic switch."
  fi

  ok "${TARGET} slot is healthy"
}

# ── Switch traffic ──────────────────────────────────────────────────────────
switch_traffic() {
  local current_slot
  current_slot=$(detect_current_slot)

  info "Current active slot: ${BOLD}${current_slot}${NC}"
  info "Switching to:        ${BOLD}${TARGET}${NC}"

  if [[ "$current_slot" == "$TARGET" ]]; then
    warn "Traffic is already pointing to ${TARGET}. Nothing to do."
    return 0
  fi

  if [[ "$ENVIRONMENT" == "production" ]] && [[ "$DRY_RUN" == false ]]; then
    echo ""
    warn "Switching ${BOLD}PRODUCTION${NC} traffic from ${current_slot} → ${TARGET}"
    read -r -p "$(echo -e "${YELLOW}Type 'yes' to confirm:${NC} ")" confirm
    [[ "$confirm" == "yes" ]] || fatal "Switch cancelled."
  fi

  # Build the patch – try common label conventions
  local label_key="slot"
  local current_labels
  current_labels=$(kubectl get svc "${SERVICE_NAME}" -n "${NAMESPACE}" -o json 2>/dev/null)

  if echo "$current_labels" | grep -q '"color"'; then
    label_key="color"
  elif echo "$current_labels" | grep -q '"deployment-slot"'; then
    label_key="deployment-slot"
  fi

  local patch="{\"spec\":{\"selector\":{\"${label_key}\":\"${TARGET}\"}}}"

  if [[ "$DRY_RUN" == true ]]; then
    info "[DRY-RUN] Would patch service '${SERVICE_NAME}' with:"
    echo "  ${patch}"
    return
  fi

  if ! kubectl patch svc "${SERVICE_NAME}" -n "${NAMESPACE}" -p "${patch}"; then
    fatal "Failed to patch service selector!"
  fi

  ok "Service '${SERVICE_NAME}' now routing to ${TARGET} slot"

  # Verify the switch
  local new_slot
  new_slot=$(detect_current_slot)
  if [[ "$new_slot" != "$TARGET" ]]; then
    err "Verification failed! Service selector shows: ${new_slot}"
    warn "Attempting to revert to ${current_slot}..."
    kubectl patch svc "${SERVICE_NAME}" -n "${NAMESPACE}" \
      -p "{\"spec\":{\"selector\":{\"${label_key}\":\"${current_slot}\"}}}" \
      && ok "Reverted to ${current_slot}" \
      || fatal "Revert failed! Manual intervention needed."
    exit 1
  fi

  ok "Verified: traffic now routes to ${TARGET}"
}

# ── Post-switch health check ───────────────────────────────────────────────
post_switch_health() {
  if [[ "$DRY_RUN" == true ]] || [[ "$SKIP_HEALTH_CHECK" == true ]]; then
    return
  fi

  info "Running post-switch health check via service..."
  sleep 5  # Let connections drain

  if [[ -x "${SCRIPT_DIR}/health-check.sh" ]]; then
    local local_port=14822
    kubectl port-forward "svc/${SERVICE_NAME}" "${local_port}:${APP_PORT}" -n "${NAMESPACE}" &
    local pf_pid=$!
    sleep 3

    if "${SCRIPT_DIR}/health-check.sh" --url "http://localhost:${local_port}" --retries 5 --interval 3; then
      ok "Post-switch health check passed"
    else
      warn "Post-switch health check failed – consider switching back!"
    fi

    kill "$pf_pid" 2>/dev/null || true
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${BLUE}║   Claude Code Agent Monitor – Blue/Green Switch ║${NC}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════╝${NC}"
  echo ""

  parse_args "$@"

  info "Configuration:"
  echo -e "  ${BOLD}Environment:${NC}  ${ENVIRONMENT}"
  echo -e "  ${BOLD}Target slot:${NC}  ${TARGET}"
  echo -e "  ${BOLD}Namespace:${NC}    ${NAMESPACE}"
  echo -e "  ${BOLD}Service:${NC}      ${SERVICE_NAME}"
  echo ""

  check_target_health
  switch_traffic
  post_switch_health

  echo ""
  ok "${BOLD}Blue-green switch complete!${NC}"
  echo -e "  ${BOLD}Active slot:${NC}  ${TARGET}"
  echo -e "  ${BOLD}Timestamp:${NC}    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo -e "  ${BOLD}Rollback:${NC}     $(basename "$0") --env ${ENVIRONMENT} --target $([ "$TARGET" = "blue" ] && echo "green" || echo "blue")"
  echo ""
}

main "$@"
