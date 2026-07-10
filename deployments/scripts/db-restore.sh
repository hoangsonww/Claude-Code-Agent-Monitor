#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-restore.sh – SQLite database restore for Claude Code Agent Monitor
#
# Usage:
#   ./db-restore.sh --env production --input ./backups/agent-monitor_production_20240101_120000.db
#   ./db-restore.sh --help
# ─────────────────────────────────────────────────────────────────────────────
# @author Son Nguyen <hoangson091104@gmail.com>
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly APP_NAME="agent-monitor"
readonly APP_PORT=4820
readonly DB_PATH_IN_CONTAINER="/app/data"

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
INPUT_FILE=""
NAMESPACE=""
SKIP_HEALTH_CHECK=false
FORCE=false
BACKUP_BEFORE_RESTORE=true

# ── Usage ───────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}Usage:${NC}
  $(basename "$0") --env <environment> --input <backup-file> [options]

${BOLD}Required:${NC}
  --env, -e          Environment: dev, staging, production
  --input, -i        Path to backup file (.db or .db.gz)

${BOLD}Options:${NC}
  --namespace, -n    Kubernetes namespace (default: agent-monitor-<env>)
  --no-backup        Skip backing up current DB before restore
  --skip-health      Skip post-restore health check
  --force            Skip confirmation prompt
  --help, -h         Show this help message

${BOLD}Examples:${NC}
  $(basename "$0") --env production --input ./backups/agent-monitor_production_20240101_120000.db
  $(basename "$0") --env staging --input ./backups/backup.db.gz --force

EOF
  exit 0
}

# ── Argument parsing ────────────────────────────────────────────────────────
parse_args() {
  [[ $# -eq 0 ]] && usage

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env|-e)         ENVIRONMENT="$2"; shift 2 ;;
      --input|-i)       INPUT_FILE="$2"; shift 2 ;;
      --namespace|-n)   NAMESPACE="$2"; shift 2 ;;
      --no-backup)      BACKUP_BEFORE_RESTORE=false; shift ;;
      --skip-health)    SKIP_HEALTH_CHECK=true; shift ;;
      --force)          FORCE=true; shift ;;
      --help|-h)        usage ;;
      *)                fatal "Unknown option: $1" ;;
    esac
  done

  [[ -z "$ENVIRONMENT" ]] && fatal "Missing required argument: --env"
  [[ -z "$INPUT_FILE" ]]  && fatal "Missing required argument: --input"
  [[ -z "$NAMESPACE" ]]   && NAMESPACE="agent-monitor-${ENVIRONMENT}"

  # Validate input file exists
  [[ -f "$INPUT_FILE" ]] || fatal "Input file not found: ${INPUT_FILE}"
}

# ── Validate backup file ───────────────────────────────────────────────────
validate_input() {
  info "Validating input file: ${INPUT_FILE}"

  local restore_file="${INPUT_FILE}"

  # Decompress if needed
  if [[ "$INPUT_FILE" == *.gz ]]; then
    info "Decompressing gzipped backup..."
    restore_file="${INPUT_FILE%.gz}"
    if [[ -f "$restore_file" ]]; then
      warn "Decompressed file already exists: ${restore_file}"
    else
      gzip -dk "${INPUT_FILE}" || fatal "Failed to decompress ${INPUT_FILE}"
    fi
  fi

  RESTORE_FILE="$restore_file"

  # Validate with sqlite3 if available
  if command -v sqlite3 &>/dev/null; then
    local integrity
    integrity=$(sqlite3 "${RESTORE_FILE}" "PRAGMA integrity_check;" 2>/dev/null || echo "error")
    if [[ "$integrity" == "ok" ]]; then
      ok "SQLite integrity check passed"
    else
      fatal "Input file failed integrity check: ${integrity}"
    fi

    local table_count
    table_count=$(sqlite3 "${RESTORE_FILE}" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "?")
    info "Backup contains ${table_count} tables"
  else
    warn "sqlite3 not available – skipping integrity check"
    # Basic file header check
    local header
    header=$(head -c 16 "${RESTORE_FILE}" | strings 2>/dev/null || echo "")
    if echo "$header" | grep -q "SQLite format"; then
      ok "File appears to be a valid SQLite database"
    else
      fatal "File does not appear to be a SQLite database"
    fi
  fi

  local file_size
  file_size=$(du -sh "${RESTORE_FILE}" 2>/dev/null | awk '{print $1}')
  info "Restore file size: ${file_size}"
}

# ── Safety confirmation ─────────────────────────────────────────────────────
confirm_restore() {
  if [[ "$FORCE" == true ]]; then
    return
  fi

  echo ""
  warn "${BOLD}⚠  DATABASE RESTORE WARNING  ⚠${NC}"
  echo ""
  echo -e "  This will ${RED}${BOLD}REPLACE${NC} the current database in ${BOLD}${ENVIRONMENT}${NC}"
  echo -e "  with the contents of: ${INPUT_FILE}"
  echo ""
  echo -e "  The deployment will be ${BOLD}scaled down${NC} during restore."
  echo ""

  if [[ "$ENVIRONMENT" == "production" ]]; then
    echo -e "  ${RED}${BOLD}THIS IS A PRODUCTION ENVIRONMENT!${NC}"
    echo ""
    read -r -p "$(echo -e "${YELLOW}Type the environment name to confirm:${NC} ")" confirm
    [[ "$confirm" == "$ENVIRONMENT" ]] || fatal "Restore cancelled. You typed '${confirm}', expected '${ENVIRONMENT}'."
  else
    read -r -p "$(echo -e "${YELLOW}Type 'yes' to confirm:${NC} ")" confirm
    [[ "$confirm" == "yes" ]] || fatal "Restore cancelled."
  fi
}

# ── Get deployment info ─────────────────────────────────────────────────────
get_deployment_info() {
  info "Getting deployment info..."

  DEPLOYMENT_NAME=$(kubectl get deployment -n "${NAMESPACE}" \
    -l "app.kubernetes.io/name=${APP_NAME}" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

  if [[ -z "$DEPLOYMENT_NAME" ]]; then
    fatal "No deployment found for ${APP_NAME} in ${NAMESPACE}"
  fi

  ORIGINAL_REPLICAS=$(kubectl get deployment "${DEPLOYMENT_NAME}" -n "${NAMESPACE}" \
    -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "1")

  info "Deployment: ${DEPLOYMENT_NAME} (${ORIGINAL_REPLICAS} replicas)"
}

# ── Backup current DB before restore ───────────────────────────────────────
backup_current() {
  if [[ "$BACKUP_BEFORE_RESTORE" == false ]]; then
    info "Skipping pre-restore backup (--no-backup)"
    return
  fi

  info "Backing up current database before restore..."

  if [[ -x "${SCRIPT_DIR}/db-backup.sh" ]]; then
    local backup_dir="${SCRIPT_DIR}/../../data/pre-restore-backups"
    "${SCRIPT_DIR}/db-backup.sh" \
      --env "${ENVIRONMENT}" \
      --output "${backup_dir}" \
      --namespace "${NAMESPACE}" \
      --no-compress \
      && ok "Pre-restore backup created in ${backup_dir}" \
      || warn "Pre-restore backup failed – proceeding anyway"
  else
    warn "db-backup.sh not found – skipping pre-restore backup"
  fi
}

# ── Scale down deployment ───────────────────────────────────────────────────
scale_down() {
  info "Scaling down deployment to 0 replicas..."

  kubectl scale deployment "${DEPLOYMENT_NAME}" \
    --replicas=0 \
    -n "${NAMESPACE}" \
    || fatal "Failed to scale down deployment"

  # Wait for all pods to terminate
  info "Waiting for pods to terminate..."
  local wait_count=0
  while [[ $wait_count -lt 60 ]]; do
    local running
    running=$(kubectl get pods -n "${NAMESPACE}" \
      -l "app.kubernetes.io/name=${APP_NAME}" \
      --field-selector=status.phase=Running \
      --no-headers 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$running" == "0" ]]; then
      ok "All pods terminated"
      return
    fi

    wait_count=$((wait_count + 1))
    sleep 2
  done

  warn "Pods did not terminate within timeout"
}

# ── Restore database ───────────────────────────────────────────────────────
restore_database() {
  info "Restoring database..."

  # We need a temporary pod to access the PVC
  # Create a helper pod that mounts the PVC
  local helper_pod="${APP_NAME}-db-restore-helper"

  # Get PVC name
  local pvc_name
  pvc_name=$(kubectl get pvc -n "${NAMESPACE}" \
    -l "app.kubernetes.io/name=${APP_NAME}" \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "agent-monitor-data")

  info "Creating helper pod to access PVC: ${pvc_name}"

  kubectl apply -n "${NAMESPACE}" -f - <<YAML
apiVersion: v1
kind: Pod
metadata:
  name: ${helper_pod}
  labels:
    app: db-restore-helper
spec:
  restartPolicy: Never
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: helper
    image: alpine:3.19
    command: ["sleep", "3600"]
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: ${pvc_name}
YAML

  # Wait for helper pod to be ready
  info "Waiting for helper pod..."
  if ! kubectl wait --for=condition=ready "pod/${helper_pod}" -n "${NAMESPACE}" --timeout=120s; then
    kubectl delete pod "${helper_pod}" -n "${NAMESPACE}" --ignore-not-found=true
    fatal "Helper pod did not become ready"
  fi

  # Backup existing DB in the PVC
  info "Moving existing database to .bak..."
  kubectl exec "${helper_pod}" -n "${NAMESPACE}" -- \
    sh -c "[ -f /data/dashboard.db ] && mv /data/dashboard.db /data/dashboard.db.bak || true"
  kubectl exec "${helper_pod}" -n "${NAMESPACE}" -- \
    sh -c "rm -f /data/dashboard.db-wal /data/dashboard.db-shm"

  # Copy new database to pod, then to PVC path
  info "Uploading restore file..."
  kubectl cp "${RESTORE_FILE}" "${NAMESPACE}/${helper_pod}:/data/dashboard.db" \
    || { kubectl delete pod "${helper_pod}" -n "${NAMESPACE}" --ignore-not-found=true; fatal "Failed to copy restore file"; }

  # Verify copied file
  kubectl exec "${helper_pod}" -n "${NAMESPACE}" -- ls -la /data/dashboard.db

  # Cleanup helper pod
  info "Removing helper pod..."
  kubectl delete pod "${helper_pod}" -n "${NAMESPACE}" --ignore-not-found=true --wait=false

  ok "Database file restored"
}

# ── Scale up deployment ─────────────────────────────────────────────────────
scale_up() {
  info "Scaling deployment back to ${ORIGINAL_REPLICAS} replicas..."

  kubectl scale deployment "${DEPLOYMENT_NAME}" \
    --replicas="${ORIGINAL_REPLICAS}" \
    -n "${NAMESPACE}" \
    || fatal "Failed to scale up deployment"

  # Wait for rollout
  info "Waiting for pods to start..."
  if ! kubectl rollout status "deployment/${DEPLOYMENT_NAME}" -n "${NAMESPACE}" --timeout=300s; then
    fatal "Deployment did not stabilize after restore!"
  fi

  ok "Deployment scaled up successfully"
}

# ── Post-restore health check ──────────────────────────────────────────────
run_health_check() {
  if [[ "$SKIP_HEALTH_CHECK" == true ]]; then
    info "Skipping health check"
    return
  fi

  info "Running post-restore health check..."

  # Wait for pods to be ready
  if ! kubectl wait --for=condition=ready pod \
      -l "app.kubernetes.io/name=${APP_NAME}" \
      -n "${NAMESPACE}" --timeout=120s 2>/dev/null; then
    fatal "Pods did not become ready after restore!"
  fi

  if [[ -x "${SCRIPT_DIR}/health-check.sh" ]]; then
    local local_port=14823
    kubectl port-forward "svc/${APP_NAME}" "${local_port}:${APP_PORT}" -n "${NAMESPACE}" &
    local pf_pid=$!
    sleep 3

    if "${SCRIPT_DIR}/health-check.sh" --url "http://localhost:${local_port}" --retries 10 --interval 3; then
      ok "Post-restore health check passed"
    else
      err "Post-restore health check failed!"
      warn "The application may need manual investigation"
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
  echo -e "${BOLD}${YELLOW}║   Claude Code Agent Monitor – DB Restore        ║${NC}"
  echo -e "${BOLD}${YELLOW}╚══════════════════════════════════════════════════╝${NC}"
  echo ""

  parse_args "$@"
  validate_input
  confirm_restore
  get_deployment_info
  backup_current
  scale_down
  restore_database
  scale_up
  run_health_check

  echo ""
  ok "${BOLD}Database restore complete!${NC}"
  echo -e "  ${BOLD}Environment:${NC}  ${ENVIRONMENT}"
  echo -e "  ${BOLD}Source:${NC}       ${INPUT_FILE}"
  echo -e "  ${BOLD}Timestamp:${NC}    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
}

main "$@"
