#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# db-backup.sh – SQLite database backup for Claude Code Agent Monitor
#
# Usage:
#   ./db-backup.sh --env production --output ./backups/
#   ./db-backup.sh --env production --output ./backups/ --upload s3://bucket/path
#   ./db-backup.sh --help
# ─────────────────────────────────────────────────────────────────────────────
# @author Son Nguyen <hoangson091104@gmail.com>
set -euo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly APP_NAME="agent-monitor"
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
OUTPUT_DIR=""
NAMESPACE=""
UPLOAD_DEST=""
POD_NAME=""
DB_FILENAME=""
COMPRESS=true

# ── Usage ───────────────────────────────────────────────────────────────────
usage() {
  cat <<EOF
${BOLD}Usage:${NC}
  $(basename "$0") --env <environment> --output <directory> [options]

${BOLD}Required:${NC}
  --env, -e          Environment: dev, staging, production
  --output, -o       Local directory for the backup file

${BOLD}Options:${NC}
  --namespace, -n    Kubernetes namespace (default: agent-monitor-<env>)
  --pod              Specific pod name to copy from (auto-detected if omitted)
  --upload           Upload backup to S3/GCS (e.g., s3://bucket/backups/)
  --no-compress      Skip gzip compression
  --help, -h         Show this help message

${BOLD}Examples:${NC}
  $(basename "$0") --env production --output ./backups/
  $(basename "$0") --env staging --output /tmp/backups --upload s3://my-bucket/db-backups/

EOF
  exit 0
}

# ── Argument parsing ────────────────────────────────────────────────────────
parse_args() {
  [[ $# -eq 0 ]] && usage

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env|-e)         ENVIRONMENT="$2"; shift 2 ;;
      --output|-o)      OUTPUT_DIR="$2"; shift 2 ;;
      --namespace|-n)   NAMESPACE="$2"; shift 2 ;;
      --pod)            POD_NAME="$2"; shift 2 ;;
      --upload)         UPLOAD_DEST="$2"; shift 2 ;;
      --no-compress)    COMPRESS=false; shift ;;
      --help|-h)        usage ;;
      *)                fatal "Unknown option: $1" ;;
    esac
  done

  [[ -z "$ENVIRONMENT" ]] && fatal "Missing required argument: --env"
  [[ -z "$OUTPUT_DIR" ]]  && fatal "Missing required argument: --output"
  [[ -z "$NAMESPACE" ]]   && NAMESPACE="agent-monitor-${ENVIRONMENT}"
}

# ── Find target pod ────────────────────────────────────────────────────────
find_pod() {
  if [[ -n "$POD_NAME" ]]; then
    info "Using specified pod: ${POD_NAME}"
    return
  fi

  info "Finding running pod in namespace '${NAMESPACE}'..."

  POD_NAME=$(kubectl get pods -n "${NAMESPACE}" \
    -l "app.kubernetes.io/name=${APP_NAME}" \
    --field-selector=status.phase=Running \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

  if [[ -z "$POD_NAME" ]]; then
    fatal "No running pods found for ${APP_NAME} in ${NAMESPACE}"
  fi

  info "Selected pod: ${POD_NAME}"
}

# ── Create backup ──────────────────────────────────────────────────────────
create_backup() {
  local timestamp
  timestamp=$(date -u +%Y%m%d_%H%M%S)
  DB_FILENAME="${APP_NAME}_${ENVIRONMENT}_${timestamp}.db"

  # Create output directory
  mkdir -p "${OUTPUT_DIR}"

  info "Creating backup..."

  # Use sqlite3 .backup inside the pod for a consistent snapshot
  # This avoids copying a potentially locked/in-flight database
  local remote_backup_path="/tmp/${DB_FILENAME}"

  info "Running SQLite backup inside pod (consistent snapshot)..."
  if kubectl exec "${POD_NAME}" -n "${NAMESPACE}" -- \
      sh -c "
        if command -v sqlite3 >/dev/null 2>&1; then
          sqlite3 '${DB_PATH_IN_CONTAINER}/dashboard.db' '.backup ${remote_backup_path}'
        else
          cp '${DB_PATH_IN_CONTAINER}/dashboard.db' '${remote_backup_path}'
        fi
      " 2>/dev/null; then
    ok "In-pod backup created at ${remote_backup_path}"
  else
    # Fallback: also copy WAL files if present
    warn "sqlite3 not available in pod, falling back to file copy"
    kubectl exec "${POD_NAME}" -n "${NAMESPACE}" -- \
      sh -c "cp '${DB_PATH_IN_CONTAINER}/dashboard.db' '${remote_backup_path}'" \
      || fatal "Failed to copy database file"

    # Try to also get WAL and SHM files
    kubectl exec "${POD_NAME}" -n "${NAMESPACE}" -- \
      sh -c "cp '${DB_PATH_IN_CONTAINER}/dashboard.db-wal' '${remote_backup_path}-wal' 2>/dev/null || true"
    kubectl exec "${POD_NAME}" -n "${NAMESPACE}" -- \
      sh -c "cp '${DB_PATH_IN_CONTAINER}/dashboard.db-shm' '${remote_backup_path}-shm' 2>/dev/null || true"
  fi

  # Copy backup from pod to local
  info "Copying backup to local filesystem..."
  kubectl cp "${NAMESPACE}/${POD_NAME}:${remote_backup_path}" "${OUTPUT_DIR}/${DB_FILENAME}" \
    || fatal "Failed to copy backup from pod"

  # Copy WAL if it exists
  kubectl cp "${NAMESPACE}/${POD_NAME}:${remote_backup_path}-wal" "${OUTPUT_DIR}/${DB_FILENAME}-wal" 2>/dev/null || true

  # Cleanup remote temp file
  kubectl exec "${POD_NAME}" -n "${NAMESPACE}" -- \
    sh -c "rm -f '${remote_backup_path}' '${remote_backup_path}-wal' '${remote_backup_path}-shm'" 2>/dev/null || true

  local file_size
  file_size=$(du -sh "${OUTPUT_DIR}/${DB_FILENAME}" 2>/dev/null | awk '{print $1}')
  ok "Backup saved: ${OUTPUT_DIR}/${DB_FILENAME} (${file_size})"
}

# ── Validate backup integrity ──────────────────────────────────────────────
validate_backup() {
  info "Validating backup integrity..."

  local db_file="${OUTPUT_DIR}/${DB_FILENAME}"

  if ! command -v sqlite3 &>/dev/null; then
    warn "sqlite3 not found locally – skipping integrity check"
    return
  fi

  # Check integrity
  local integrity
  integrity=$(sqlite3 "${db_file}" "PRAGMA integrity_check;" 2>/dev/null || echo "error")

  if [[ "$integrity" == "ok" ]]; then
    ok "SQLite integrity check: OK"
  else
    err "SQLite integrity check failed: ${integrity}"
    warn "Backup may be corrupted – consider re-running the backup"
    return 1
  fi

  # Show basic stats
  local table_count
  table_count=$(sqlite3 "${db_file}" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "?")
  local page_count
  page_count=$(sqlite3 "${db_file}" "PRAGMA page_count;" 2>/dev/null || echo "?")
  local page_size
  page_size=$(sqlite3 "${db_file}" "PRAGMA page_size;" 2>/dev/null || echo "?")

  info "Database stats: ${table_count} tables, ${page_count} pages × ${page_size} bytes"
}

# ── Compress backup ────────────────────────────────────────────────────────
compress_backup() {
  if [[ "$COMPRESS" == false ]]; then
    info "Compression skipped"
    return
  fi

  local db_file="${OUTPUT_DIR}/${DB_FILENAME}"

  if ! command -v gzip &>/dev/null; then
    warn "gzip not available – skipping compression"
    return
  fi

  info "Compressing backup..."
  gzip -k "${db_file}"
  DB_FILENAME="${DB_FILENAME}.gz"

  local compressed_size
  compressed_size=$(du -sh "${OUTPUT_DIR}/${DB_FILENAME}" 2>/dev/null | awk '{print $1}')
  ok "Compressed: ${OUTPUT_DIR}/${DB_FILENAME} (${compressed_size})"
}

# ── Upload to cloud storage ────────────────────────────────────────────────
upload_backup() {
  if [[ -z "$UPLOAD_DEST" ]]; then
    return
  fi

  local backup_file="${OUTPUT_DIR}/${DB_FILENAME}"

  info "Uploading backup to ${UPLOAD_DEST}..."

  if [[ "$UPLOAD_DEST" == s3://* ]]; then
    if ! command -v aws &>/dev/null; then
      fatal "AWS CLI not found. Install it to upload to S3."
    fi
    aws s3 cp "${backup_file}" "${UPLOAD_DEST}${DB_FILENAME}" \
      --storage-class STANDARD_IA \
      || fatal "S3 upload failed"
    ok "Uploaded to ${UPLOAD_DEST}${DB_FILENAME}"

  elif [[ "$UPLOAD_DEST" == gs://* ]]; then
    if ! command -v gsutil &>/dev/null; then
      fatal "gsutil not found. Install Google Cloud SDK to upload to GCS."
    fi
    gsutil cp "${backup_file}" "${UPLOAD_DEST}${DB_FILENAME}" \
      || fatal "GCS upload failed"
    ok "Uploaded to ${UPLOAD_DEST}${DB_FILENAME}"

  elif [[ "$UPLOAD_DEST" == az://* ]] || [[ "$UPLOAD_DEST" == https://*.blob.core.windows.net/* ]]; then
    if ! command -v az &>/dev/null; then
      fatal "Azure CLI not found. Install it to upload to Azure Blob."
    fi
    local container_url="${UPLOAD_DEST}"
    az storage blob upload \
      --file "${backup_file}" \
      --name "${DB_FILENAME}" \
      --overwrite \
      || fatal "Azure Blob upload failed"
    ok "Uploaded to Azure Blob Storage"

  else
    warn "Unknown upload destination scheme: ${UPLOAD_DEST}"
    warn "Supported: s3://, gs://, az://"
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}${BLUE}║   Claude Code Agent Monitor – DB Backup         ║${NC}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════╝${NC}"
  echo ""

  parse_args "$@"

  info "Configuration:"
  echo -e "  ${BOLD}Environment:${NC}  ${ENVIRONMENT}"
  echo -e "  ${BOLD}Namespace:${NC}    ${NAMESPACE}"
  echo -e "  ${BOLD}Output:${NC}       ${OUTPUT_DIR}"
  [[ -n "$UPLOAD_DEST" ]] && echo -e "  ${BOLD}Upload:${NC}       ${UPLOAD_DEST}"
  echo ""

  find_pod
  create_backup
  validate_backup
  compress_backup
  upload_backup

  echo ""
  ok "${BOLD}Backup complete!${NC}"
  echo -e "  ${BOLD}File:${NC}         ${OUTPUT_DIR}/${DB_FILENAME}"
  echo -e "  ${BOLD}Timestamp:${NC}    $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
}

main "$@"
