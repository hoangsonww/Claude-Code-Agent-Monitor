#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# rollback.sh – Rollback deployments for Claude Code Agent Monitor
#
# Usage:
#   ./rollback.sh --env production --method helm --revision 5
#   ./rollback.sh --env staging --method kustomize
#   ./rollback.sh --help
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
METHOD=""
REVISION=""
NAMESPACE=""
HELM_RELEASE="${APP_NAME}"
SKIP_HEALTH_CHECK=false

# ── Usage ───────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}Usage:${NC}
  $(basename "$0") --env <environment> --method <method> [options]

${BOLD}Required:${NC}
  --env, -e          Environment: dev, staging, production
  --method, -m       Method: helm, kustomize

${BOLD}Options:${NC}
  --revision, -r     Helm revision or rollout history number to roll back to
  --namespace, -n    Kubernetes namespace (default: agent-monitor-<env>)
  --release          Helm release name (default: ${APP_NAME})
  --skip-health      Skip post-rollback health check
  --help, -h         Show this help message

${BOLD}Examples:${NC}
  $(basename "$0") --env production --method helm --revision 5
  $(basename "$0") --env staging --method kustomize
  $(basename "$0") --env production --method helm  # rolls back to previous

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
      --revision|-r)    REVISION="$2"; shift 2 ;;
      --namespace|-n)   NAMESPACE="$2"; shift 2 ;;
      --release)        HELM_RELEASE="$2"; shift 2 ;;
      --skip-health)    SKIP_HEALTH_CHECK=true; shift ;;
      --help|-h)        usage ;;
      *)                fatal "Unknown option: $1" ;;
    esac
  done

  [[ -z "$ENVIRONMENT" ]] && fatal "Missing required argument: --env"
  [[ -z "$METHOD" ]]      && fatal "Missing required argument: --method"
  [[ -z "$NAMESPACE" ]]   && NAMESPACE="agent-monitor-${ENVIRONMENT}"
}

# ── Show release history ───────────────────────────────────────────────────
show_history() {
  info "Release history:"
  case "$METHOD" in
    helm)
      helm history "${HELM_RELEASE}" -n "${NAMESPACE}" --max 10 2>/dev/null || warn "No history found"
      ;;
    kustomize)
      kubectl rollout history "deployment/${APP_NAME}" -n "${NAMESPACE}" 2>/dev/null || warn "No history found"
      ;;
  esac
  echo ""
}

# ── Confirm rollback ───────────────────────────────────────────────────────
confirm_rollback() {
  if [[ "$ENVIRONMENT" == "production" ]]; then
    local target_msg="previous revision"
    [[ -n "$REVISION" ]] && target_msg="revision ${REVISION}"

    warn "Rolling back ${BOLD}PRODUCTION${NC} to ${target_msg}"
    read -r -p "$(echo -e "${YELLOW}Type 'yes' to confirm:${NC} ")" confirm
    [[ "$confirm" == "yes" ]] || fatal "Rollback cancelled."
  fi
}

# ── Helm rollback ───────────────────────────────────────────────────────────
rollback_helm() {
  info "Rolling back Helm release '${HELM_RELEASE}' in namespace '${NAMESPACE}'..."

  local rollback_args=(rollback "${HELM_RELEASE}")
  [[ -n "$REVISION" ]] && rollback_args+=("${REVISION}")
  rollback_args+=(-n "${NAMESPACE}" --wait --timeout 300s)

  if ! helm "${rollback_args[@]}"; then
    fatal "Helm rollback failed! Manual intervention required."
  fi

  ok "Helm rollback completed"

  # Show current status
  info "Current release status:"
  helm status "${HELM_RELEASE}" -n "${NAMESPACE}" 2>/dev/null || true
}

# ── Kustomize rollback ─────────────────────────────────────────────────────
rollback_kustomize() {
  info "Rolling back deployment '${APP_NAME}' in namespace '${NAMESPACE}'..."

  local undo_args=(rollout undo "deployment/${APP_NAME}" -n "${NAMESPACE}")
  if [[ -n "$REVISION" ]]; then
    undo_args+=(--to-revision="${REVISION}")
  fi

  if ! kubectl "${undo_args[@]}"; then
    fatal "Kubectl rollback failed! Manual intervention required."
  fi

  # Wait for rollout
  info "Waiting for rollout to complete..."
  if ! kubectl rollout status "deployment/${APP_NAME}" -n "${NAMESPACE}" --timeout=300s; then
    fatal "Rollout did not complete in time!"
  fi

  ok "Kustomize rollback completed"
}

# ── Post-rollback health check ─────────────────────────────────────────────
run_health_check() {
  if [[ "$SKIP_HEALTH_CHECK" == true ]]; then
    info "Skipping health check"
    return
  fi

  info "Running post-rollback health check..."

  # Wait for pods to be ready
  if ! kubectl wait --for=condition=ready pod \
      -l "app.kubernetes.io/name=${APP_NAME}" \
      -n "${NAMESPACE}" --timeout=120s 2>/dev/null; then
    fatal "Pods did not become ready after rollback!"
  fi

  # Use health-check.sh if available
  if [[ -x "${SCRIPT_DIR}/health-check.sh" ]]; then
    # Port forward for check
    local local_port=14820
    kubectl port-forward "svc/${APP_NAME}" "${local_port}:${APP_PORT}" -n "${NAMESPACE}" &
    local pf_pid=$!
    sleep 3

    if "${SCRIPT_DIR}/health-check.sh" --url "http://localhost:${local_port}" --retries 10 --interval 3; then
      ok "Health check passed after rollback"
    else
      err "Health check failed after rollback!"
    fi

    kill "$pf_pid" 2>/dev/null || true
  else
    ok "Pods are ready"
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${YELLOW}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${YELLOW}║   Claude Code Agent Monitor – Rollback          ║${NC}"
  echo -e "${BOLD}${YELLOW}╚══════════════════════════════════════════════════╝${NC}"
  echo ""

  parse_args "$@"
  show_history
  confirm_rollback

  case "$METHOD" in
    helm)       rollback_helm ;;
    kustomize)  rollback_kustomize ;;
    *)          fatal "Rollback not supported for method: ${METHOD}" ;;
  esac

  run_health_check

  echo ""
  ok "${BOLD}Rollback complete!${NC}"
  echo -e "  ${BOLD}Environment:${NC}  ${ENVIRONMENT}"
  echo -e "  ${BOLD}Method:${NC}       ${METHOD}"
  echo -e "  ${BOLD}Revision:${NC}     ${REVISION:-previous}"
  echo -e "  ${BOLD}Timestamp:${NC}    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
}

main "$@"
