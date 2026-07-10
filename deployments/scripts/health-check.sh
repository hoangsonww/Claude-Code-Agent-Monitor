#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# health-check.sh – Comprehensive health check for Claude Code Agent Monitor
#
# Usage:
#   ./health-check.sh --url http://localhost:4820
#   ./health-check.sh --url http://host:port --retries 30 --interval 5
#   ./health-check.sh --url http://host:port --json
#   ./health-check.sh --help
# ─────────────────────────────────────────────────────────────────────────────
# @author Son Nguyen <hoangson091104@gmail.com>
set -euo pipefail

# ── Colors & logging ───────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()   { [[ "$JSON_OUTPUT" == true ]] && return; echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $*"; }
info()  { [[ "$JSON_OUTPUT" == true ]] && return; echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${BLUE}ℹ${NC}  $*"; }
ok()    { [[ "$JSON_OUTPUT" == true ]] && return; echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${GREEN}✔${NC}  $*"; }
warn()  { [[ "$JSON_OUTPUT" == true ]] && return; echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${YELLOW}⚠${NC}  $*" >&2; }
err()   { [[ "$JSON_OUTPUT" == true ]] && return; echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ${RED}✖${NC}  $*" >&2; }

# ── Defaults ────────────────────────────────────────────────────────────────
BASE_URL=""
RETRIES=30
INTERVAL=5
TIMEOUT=5
RESPONSE_THRESHOLD=2000  # milliseconds
JSON_OUTPUT=false
CHECK_WEBSOCKET=true
HEALTH_PATH="/api/health"

# ── Usage ───────────────────────────────────────────────────────────────────
usage() {
  cat <<HELP
${BOLD}Usage:${NC}
  $(basename "$0") --url <base-url> [options]

${BOLD}Required:${NC}
  --url, -u          Base URL (e.g., http://localhost:4820)

${BOLD}Options:${NC}
  --retries, -r      Max retry attempts (default: 30)
  --interval, -i     Seconds between retries (default: 5)
  --timeout          HTTP request timeout in seconds (default: 5)
  --threshold        Max response time in ms (default: 2000)
  --path             Health endpoint path (default: /api/health)
  --no-websocket     Skip WebSocket connectivity check
  --json             Output results as JSON
  --help, -h         Show this help message

${BOLD}Exit codes:${NC}
  0                  All checks passed
  1                  One or more checks failed

${BOLD}Examples:${NC}
  $(basename "$0") --url http://localhost:4820
  $(basename "$0") --url https://monitor.example.com --retries 10 --json
  $(basename "$0") --url http://10.0.1.5:4820 --threshold 500 --no-websocket

HELP
  exit 0
}

# ── Argument parsing ────────────────────────────────────────────────────────
parse_args() {
  [[ $# -eq 0 ]] && usage

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --url|-u)          BASE_URL="$2"; shift 2 ;;
      --retries|-r)      RETRIES="$2"; shift 2 ;;
      --interval|-i)     INTERVAL="$2"; shift 2 ;;
      --timeout)         TIMEOUT="$2"; shift 2 ;;
      --threshold)       RESPONSE_THRESHOLD="$2"; shift 2 ;;
      --path)            HEALTH_PATH="$2"; shift 2 ;;
      --no-websocket)    CHECK_WEBSOCKET=false; shift ;;
      --json)            JSON_OUTPUT=true; shift ;;
      --help|-h)         usage ;;
      *)                 echo "Unknown option: $1" >&2; exit 1 ;;
    esac
  done

  [[ -z "$BASE_URL" ]] && { echo "Missing required argument: --url" >&2; exit 1; }

  # Strip trailing slash
  BASE_URL="${BASE_URL%/}"
}

# ── HTTP health check ──────────────────────────────────────────────────────
check_http_health() {
  local url="${BASE_URL}${HEALTH_PATH}"
  local attempt=0
  local http_ok=false
  local status_code=""
  local response_body=""
  local response_time_ms=0

  info "Checking HTTP health: ${url}"

  while [[ $attempt -lt $RETRIES ]]; do
    attempt=$((attempt + 1))

    # Measure response time and capture output
    local start_ns
    start_ns=$(date +%s%N 2>/dev/null || echo "0")

    local http_response
    http_response=$(curl -sf \
      --max-time "${TIMEOUT}" \
      --write-out "\n%{http_code}\n%{time_total}" \
      "${url}" 2>/dev/null) || true

    local end_ns
    end_ns=$(date +%s%N 2>/dev/null || echo "0")

    if [[ -n "$http_response" ]]; then
      response_body=$(echo "$http_response" | head -n -2)
      status_code=$(echo "$http_response" | tail -2 | head -1)
      local time_total
      time_total=$(echo "$http_response" | tail -1)
      # Convert seconds to milliseconds
      response_time_ms=$(echo "$time_total" | awk '{printf "%.0f", $1 * 1000}' 2>/dev/null || echo "0")

      if [[ "$status_code" == "200" ]] && echo "$response_body" | grep -q '"status":"ok"'; then
        http_ok=true
        break
      fi
    fi

    if [[ $attempt -lt $RETRIES ]]; then
      info "Attempt ${attempt}/${RETRIES} – waiting ${INTERVAL}s..."
      sleep "${INTERVAL}"
    fi
  done

  # Results
  HTTP_OK="$http_ok"
  HTTP_STATUS="$status_code"
  HTTP_BODY="$response_body"
  HTTP_RESPONSE_TIME_MS="$response_time_ms"
  HTTP_ATTEMPTS="$attempt"

  if [[ "$http_ok" == true ]]; then
    ok "HTTP health check passed (${response_time_ms}ms, ${attempt} attempt(s))"
  else
    err "HTTP health check failed after ${attempt} attempts"
  fi
}

# ── Response time check ────────────────────────────────────────────────────
check_response_time() {
  if [[ "$HTTP_OK" != true ]]; then
    LATENCY_OK=false
    return
  fi

  if [[ "$HTTP_RESPONSE_TIME_MS" -le "$RESPONSE_THRESHOLD" ]]; then
    LATENCY_OK=true
    ok "Response time ${HTTP_RESPONSE_TIME_MS}ms within threshold (${RESPONSE_THRESHOLD}ms)"
  else
    LATENCY_OK=false
    warn "Response time ${HTTP_RESPONSE_TIME_MS}ms exceeds threshold (${RESPONSE_THRESHOLD}ms)"
  fi
}

# ── WebSocket connectivity check ───────────────────────────────────────────
check_websocket() {
  WS_OK=false

  if [[ "$CHECK_WEBSOCKET" == false ]]; then
    info "WebSocket check skipped"
    WS_OK=true  # treat as pass when skipped
    return
  fi

  # Construct WebSocket URL
  local ws_url="${BASE_URL}"
  ws_url="${ws_url/http:/ws:}"
  ws_url="${ws_url/https:/wss:}"
  ws_url="${ws_url}/ws"

  info "Checking WebSocket: ${ws_url}"

  # Check if we have a WebSocket testing tool
  if command -v websocat &>/dev/null; then
    if echo "" | websocat --one-message -t "${ws_url}" 2>/dev/null; then
      WS_OK=true
      ok "WebSocket connection succeeded (websocat)"
      return
    fi
  fi

  # Fallback: use curl with upgrade headers to test the handshake
  local ws_status
  ws_status=$(curl -sf \
    --max-time "${TIMEOUT}" \
    -o /dev/null \
    -w "%{http_code}" \
    -H "Upgrade: websocket" \
    -H "Connection: Upgrade" \
    -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
    -H "Sec-WebSocket-Version: 13" \
    "${BASE_URL}/ws" 2>/dev/null) || ws_status="000"

  # 101 = Switching Protocols (WebSocket upgrade success)
  # 400 = Bad Request (server recognized WS but rejected – still proves WS is available)
  case "$ws_status" in
    101)
      WS_OK=true
      ok "WebSocket handshake succeeded (HTTP 101)"
      ;;
    400|426)
      WS_OK=true
      ok "WebSocket endpoint reachable (HTTP ${ws_status} – server recognized upgrade)"
      ;;
    *)
      # Try Node.js one-liner as last resort
      if command -v node &>/dev/null; then
        local node_result
        node_result=$(node -e "
          const ws = new (require('ws'))('${ws_url}');
          const t = setTimeout(() => { process.stdout.write('timeout'); process.exit(1); }, 5000);
          ws.on('open', () => { clearTimeout(t); process.stdout.write('ok'); ws.close(); process.exit(0); });
          ws.on('error', (e) => { clearTimeout(t); process.stdout.write('error:' + e.message); process.exit(1); });
        " 2>/dev/null) || node_result="error"

        if [[ "$node_result" == "ok" ]]; then
          WS_OK=true
          ok "WebSocket connection verified (node)"
        else
          WS_OK=false
          warn "WebSocket check failed: ${node_result}"
        fi
      else
        warn "WebSocket check inconclusive (no ws testing tool available, HTTP status: ${ws_status})"
        WS_OK=true  # Don't fail the whole check for this
      fi
      ;;
  esac
}

# ── Output results ──────────────────────────────────────────────────────────
output_results() {
  local overall_healthy=true
  [[ "$HTTP_OK" != true ]] && overall_healthy=false
  [[ "$LATENCY_OK" != true ]] && overall_healthy=false
  [[ "$WS_OK" != true ]] && overall_healthy=false

  if [[ "$JSON_OUTPUT" == true ]]; then
    cat <<JSON
{
  "healthy": ${overall_healthy},
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "url": "${BASE_URL}",
  "checks": {
    "http": {
      "passed": ${HTTP_OK},
      "status_code": "${HTTP_STATUS:-null}",
      "response_time_ms": ${HTTP_RESPONSE_TIME_MS:-0},
      "attempts": ${HTTP_ATTEMPTS:-0},
      "body": $(echo "${HTTP_BODY:-null}" | head -c 500 | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '"null"')
    },
    "latency": {
      "passed": ${LATENCY_OK},
      "response_time_ms": ${HTTP_RESPONSE_TIME_MS:-0},
      "threshold_ms": ${RESPONSE_THRESHOLD}
    },
    "websocket": {
      "passed": ${WS_OK},
      "checked": ${CHECK_WEBSOCKET}
    }
  }
}
JSON
  else
    echo ""
    echo -e "${BOLD}Health Check Summary${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local http_icon=$([[ "$HTTP_OK" == true ]] && echo "${GREEN}✔${NC}" || echo "${RED}✖${NC}")
    local latency_icon=$([[ "$LATENCY_OK" == true ]] && echo "${GREEN}✔${NC}" || echo "${YELLOW}⚠${NC}")
    local ws_icon=$([[ "$WS_OK" == true ]] && echo "${GREEN}✔${NC}" || echo "${RED}✖${NC}")

    echo -e "  ${http_icon}  HTTP /api/health  (${HTTP_STATUS:-???}, ${HTTP_RESPONSE_TIME_MS:-?}ms, ${HTTP_ATTEMPTS:-?} attempts)"
    echo -e "  ${latency_icon}  Response time     (${HTTP_RESPONSE_TIME_MS:-?}ms / ${RESPONSE_THRESHOLD}ms threshold)"
    echo -e "  ${ws_icon}  WebSocket         (checked: ${CHECK_WEBSOCKET})"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [[ "$overall_healthy" == true ]]; then
      echo -e "  ${GREEN}${BOLD}Overall: HEALTHY${NC}"
    else
      echo -e "  ${RED}${BOLD}Overall: UNHEALTHY${NC}"
    fi
    echo ""
  fi

  if [[ "$overall_healthy" == true ]]; then
    return 0
  else
    return 1
  fi
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
  parse_args "$@"

  # Initialize result variables
  HTTP_OK=false
  HTTP_STATUS=""
  HTTP_BODY=""
  HTTP_RESPONSE_TIME_MS=0
  HTTP_ATTEMPTS=0
  LATENCY_OK=false
  WS_OK=false

  [[ "$JSON_OUTPUT" != true ]] && {
    echo ""
    echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${GREEN}║   Claude Code Agent Monitor – Health Check      ║${NC}"
    echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════╝${NC}"
    echo ""
    info "Target: ${BASE_URL}"
    info "Config: retries=${RETRIES}, interval=${INTERVAL}s, threshold=${RESPONSE_THRESHOLD}ms"
    echo ""
  }

  check_http_health
  check_response_time
  check_websocket

  output_results
}

main "$@"
