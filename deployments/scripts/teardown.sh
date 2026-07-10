#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# teardown.sh – Clean removal of Claude Code Agent Monitor infrastructure
#
# Usage:
#   ./teardown.sh --env dev --method helm
#   ./teardown.sh --env production --method terraform
#   ./teardown.sh --help
# ─────────────────────────────────────────────────────────────────────────────
# @author Son Nguyen <hoangson091104@gmail.com>
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly DEPLOY_DIR="${PROJECT_ROOT}/deployments"
readonly APP_NAME="agent-monitor"

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
NAMESPACE=""
HELM_RELEASE="${APP_NAME}"
SKIP_BACKUP=false
FORCE=false
DELETE_NAMESPACE=false
DELETE_PVC=false

# ── Usage ───────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}Usage:${NC}
  $(basename "$0") --env <environment> --method <method> [options]

${BOLD}Required:${NC}
  --env, -e          Environment: dev, staging, production
  --method, -m       Method: helm, kustomize, terraform

${BOLD}Options:${NC}
  --namespace, -n    Kubernetes namespace (default: agent-monitor-<env>)
  --release          Helm release name (default: ${APP_NAME})
  --delete-namespace Also delete the Kubernetes namespace
  --delete-pvc       Also delete PersistentVolumeClaims (data loss!)
  --skip-backup      Skip data backup before teardown
  --force            Skip all confirmation prompts
  --help, -h         Show this help message

${BOLD}Examples:${NC}
  $(basename "$0") --env dev --method helm
  $(basename "$0") --env staging --method kustomize --delete-namespace
  $(basename "$0") --env production --method terraform

EOF
  exit 0
}

# ── Argument parsing ────────────────────────────────────────────────────────
parse_args() {
  [[ $# -eq 0 ]] && usage

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env|-e)            ENVIRONMENT="$2"; shift 2 ;;
      --method|-m)         METHOD="$2"; shift 2 ;;
      --namespace|-n)      NAMESPACE="$2"; shift 2 ;;
      --release)           HELM_RELEASE="$2"; shift 2 ;;
      --delete-namespace)  DELETE_NAMESPACE=true; shift ;;
      --delete-pvc)        DELETE_PVC=true; shift ;;
      --skip-backup)       SKIP_BACKUP=true; shift ;;
      --force)             FORCE=true; shift ;;
      --help|-h)           usage ;;
      *)                   fatal "Unknown option: $1" ;;
    esac
  done

  [[ -z "$ENVIRONMENT" ]] && fatal "Missing required argument: --env"
  [[ -z "$METHOD" ]]      && fatal "Missing required argument: --method"
  [[ -z "$NAMESPACE" ]]   && NAMESPACE="agent-monitor-${ENVIRONMENT}"
}

# ── Confirm teardown ───────────────────────────────────────────────────────
confirm_teardown() {
  if [[ "$FORCE" == true ]]; then
    return
  fi

  echo ""
  echo -e "  ${RED}${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "  ${RED}${BOLD}║         ⚠  TEARDOWN WARNING  ⚠          ║${NC}"
  echo -e "  ${RED}${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  This will ${RED}${BOLD}DESTROY${NC} the following resources:"
  echo -e "    • Environment:  ${BOLD}${ENVIRONMENT}${NC}"
  echo -e "    • Method:       ${BOLD}${METHOD}${NC}"
  echo -e "    • Namespace:    ${BOLD}${NAMESPACE}${NC}"
  [[ "$DELETE_NAMESPACE" == true ]] && echo -e "    • ${RED}Namespace will be deleted${NC}"
  [[ "$DELETE_PVC" == true ]]       && echo -e "    • ${RED}PVCs will be deleted (DATA LOSS!)${NC}"
  echo ""

  if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "  ${RED}${BOLD}THIS IS A PRODUCTION ENVIRONMENT!${NC}"
    echo ""
    read -r -p "$(echo -e "${RED}Type 'destroy ${ENVIRONMENT}' to confirm:${NC} ")" confirm
    [[ "$confirm" == "destroy ${ENVIRONMENT}" ]] || fatal "Teardown cancelled."

    # Second confirmation for production
    echo ""
    read -r -p "$(echo -e "${RED}Are you absolutely sure? Type 'YES' in caps:${NC} ")" confirm2
    [[ "$confirm2" == "YES" ]] || fatal "Teardown cancelled."
  else
    read -r -p "$(echo -e "${YELLOW}Type 'yes' to confirm:${NC} ")" confirm
    [[ "$confirm" == "yes" ]] || fatal "Teardown cancelled."
  fi
}

# ── Pre-teardown backup ────────────────────────────────────────────────────
backup_data() {
  if [[ "$SKIP_BACKUP" == true ]]; then
    info "Skipping pre-teardown backup (--skip-backup)"
    return
  fi

  info "Creating backup before teardown..."

  if [[ -x "${SCRIPT_DIR}/db-backup.sh" ]]; then
    local backup_dir="${PROJECT_ROOT}/data/pre-teardown-backups"
    "${SCRIPT_DIR}/db-backup.sh" \
      --env "${ENVIRONMENT}" \
      --output "${backup_dir}" \
      --namespace "${NAMESPACE}" \
      && ok "Pre-teardown backup created" \
      || warn "Backup failed – continuing with teardown"
  else
    warn "db-backup.sh not found – skipping backup"
  fi
}

# ── Show current resources ──────────────────────────────────────────────────
show_resources() {
  info "Current resources in namespace '${NAMESPACE}':"
  echo ""

  kubectl get all -n "${NAMESPACE}" 2>/dev/null || warn "Could not list resources"

  if [[ "$METHOD" != "terraform" ]]; then
    echo ""
    info "PersistentVolumeClaims:"
    kubectl get pvc -n "${NAMESPACE}" 2>/dev/null || warn "No PVCs found"
  fi
  echo ""
}

# ── Helm teardown ──────────────────────────────────────────────────────────
teardown_helm() {
  info "Uninstalling Helm release '${HELM_RELEASE}'..."

  if helm status "${HELM_RELEASE}" -n "${NAMESPACE}" &>/dev/null; then
    helm uninstall "${HELM_RELEASE}" -n "${NAMESPACE}" --wait --timeout 300s \
      || fatal "Helm uninstall failed"
    ok "Helm release '${HELM_RELEASE}' uninstalled"
  else
    warn "Helm release '${HELM_RELEASE}' not found in namespace '${NAMESPACE}'"
  fi

  # Also try uninstalling blue/green releases
  for color in blue green; do
    if helm status "${HELM_RELEASE}-${color}" -n "${NAMESPACE}" &>/dev/null; then
      info "Uninstalling ${color} slot release..."
      helm uninstall "${HELM_RELEASE}-${color}" -n "${NAMESPACE}" --wait --timeout 300s \
        && ok "Release '${HELM_RELEASE}-${color}' uninstalled" \
        || warn "Failed to uninstall ${color} release"
    fi
  done
}

# ── Kustomize teardown ─────────────────────────────────────────────────────
teardown_kustomize() {
  local overlay_dir="${DEPLOY_DIR}/kubernetes/overlays/${ENVIRONMENT}"

  if [[ -d "$overlay_dir" ]]; then
    info "Deleting Kustomize resources..."
    kubectl delete -k "${overlay_dir}" --ignore-not-found=true --wait=true --timeout=300s \
      && ok "Kustomize resources deleted" \
      || warn "Some resources may not have been deleted"
  else
    warn "Kustomize overlay not found at ${overlay_dir}"
    info "Deleting resources by label..."
    kubectl delete all -l "app.kubernetes.io/name=${APP_NAME}" -n "${NAMESPACE}" --wait=true \
      || warn "Could not delete resources by label"
  fi
}

# ── Terraform teardown ─────────────────────────────────────────────────────
teardown_terraform() {
  local tf_dir="${DEPLOY_DIR}/terraform"
  local env_vars_file="${tf_dir}/environments/${ENVIRONMENT}/terraform.tfvars"

  info "Destroying Terraform-managed infrastructure..."

  pushd "${tf_dir}" > /dev/null

  terraform init -input=false

  local destroy_args=(-input=false -auto-approve)
  if [[ -f "$env_vars_file" ]]; then
    destroy_args+=(-var-file="$env_vars_file")
  fi
  # Need to provide required variables that may not have defaults
  destroy_args+=(-var "environment=${ENVIRONMENT}")

  if ! terraform destroy "${destroy_args[@]}"; then
    popd > /dev/null
    fatal "Terraform destroy failed! Review state manually."
  fi

  popd > /dev/null
  ok "Terraform infrastructure destroyed"
}

# ── Cleanup PVCs ────────────────────────────────────────────────────────────
cleanup_pvcs() {
  if [[ "$DELETE_PVC" != true ]]; then
    local pvc_count
    pvc_count=$(kubectl get pvc -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$pvc_count" -gt 0 ]]; then
      warn "PersistentVolumeClaims still exist. Use --delete-pvc to remove them."
      kubectl get pvc -n "${NAMESPACE}" 2>/dev/null
    fi
    return
  fi

  info "Deleting PersistentVolumeClaims..."
  kubectl delete pvc --all -n "${NAMESPACE}" --wait=true \
    && ok "PVCs deleted" \
    || warn "Some PVCs could not be deleted"
}

# ── Cleanup namespace ──────────────────────────────────────────────────────
cleanup_namespace() {
  if [[ "$DELETE_NAMESPACE" != true ]]; then
    return
  fi

  if [[ "$ENVIRONMENT" == "production" ]]; then
    warn "Refusing to delete production namespace automatically."
    warn "Delete manually: kubectl delete namespace ${NAMESPACE}"
    return
  fi

  info "Deleting namespace '${NAMESPACE}'..."
  kubectl delete namespace "${NAMESPACE}" --ignore-not-found=true --wait=true --timeout=120s \
    && ok "Namespace '${NAMESPACE}' deleted" \
    || warn "Namespace deletion may be stuck. Check: kubectl get namespace ${NAMESPACE}"
}

# ── Verify teardown ────────────────────────────────────────────────────────
verify_teardown() {
  info "Verifying teardown..."

  if [[ "$METHOD" == "terraform" ]]; then
    ok "Terraform state should reflect no resources"
    return
  fi

  local remaining
  remaining=$(kubectl get all -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l | tr -d ' ')

  if [[ "$remaining" -eq 0 ]]; then
    ok "No resources remaining in namespace '${NAMESPACE}'"
  else
    warn "${remaining} resources still exist in namespace '${NAMESPACE}':"
    kubectl get all -n "${NAMESPACE}" 2>/dev/null
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${RED}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${RED}║   Claude Code Agent Monitor – Teardown          ║${NC}"
  echo -e "${BOLD}${RED}╚══════════════════════════════════════════════════╝${NC}"
  echo ""

  parse_args "$@"

  info "Teardown configuration:"
  echo -e "  ${BOLD}Environment:${NC}  ${ENVIRONMENT}"
  echo -e "  ${BOLD}Method:${NC}       ${METHOD}"
  echo -e "  ${BOLD}Namespace:${NC}    ${NAMESPACE}"
  echo ""

  if [[ "$METHOD" != "terraform" ]]; then
    show_resources
  fi

  confirm_teardown
  backup_data

  case "$METHOD" in
    helm)       teardown_helm ;;
    kustomize)  teardown_kustomize ;;
    terraform)  teardown_terraform ;;
    *)          fatal "Invalid method: ${METHOD}" ;;
  esac

  if [[ "$METHOD" != "terraform" ]]; then
    cleanup_pvcs
    cleanup_namespace
    verify_teardown
  fi

  echo ""
  ok "${BOLD}Teardown complete!${NC}"
  echo -e "  ${BOLD}Environment:${NC}  ${ENVIRONMENT}"
  echo -e "  ${BOLD}Method:${NC}       ${METHOD}"
  echo -e "  ${BOLD}Timestamp:${NC}    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
}

main "$@"
