#!/usr/bin/env bash
# validate-deployment.sh — advisory static review of CCAM container and cloud
# deployment assets. It checks the single-writer SQLite topology plus the
# Docker, Compose, Nginx, Helm, Kustomize, Terraform, dependency, and header
# contracts.
#
# ## Reporting model
# Findings are INFORMATIONAL. Every check runs even when an earlier one reports
# something, findings surface as GitHub Actions `::warning::` annotations with
# their detail inside a collapsed `::group::`, a markdown table is appended to
# `$GITHUB_STEP_SUMMARY`, and the script exits 0 so it never halts the pipeline.
# Dependency advisories from `npm audit --omit=dev` are reported the same way:
# listed, never fatal (many have only semver-major fixes).
#
# Set `CCAM_DEPLOY_VALIDATE_STRICT=1` to exit non-zero when findings exist —
# use that for a deliberate release gate, never in the default CI path.
#
# Usage:
#   npm run deploy:validate
#   CCAM_DEPLOY_VALIDATE_STRICT=1 npm run deploy:validate   # hard gate
# @author Son Nguyen <hoangson091104@gmail.com>

set -uo pipefail

readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
readonly CHART_DIR="${PROJECT_ROOT}/deployments/helm/agent-monitor"
readonly KUSTOMIZE_DIR="${PROJECT_ROOT}/deployments/kubernetes"

readonly IN_ACTIONS="${GITHUB_ACTIONS:-}"
readonly STRICT="${CCAM_DEPLOY_VALIDATE_STRICT:-0}"
FINDINGS=0
SUMMARY_ROWS=()

log() { printf '[deployment-check] %s\n' "$*"; }

# `fatal` still aborts the *check* it runs inside — every check is executed in a
# subshell by run_check — but it no longer aborts the script.
fatal() { printf '[deployment-check] ERROR: %s\n' "$*" >&2; exit 1; }

group_start() {
  if [[ -n "$IN_ACTIONS" ]]; then printf '::group::%s\n' "$*"; else log "--- $* ---"; fi
}
group_end() {
  if [[ -n "$IN_ACTIONS" ]]; then printf '::endgroup::\n'; fi
}

# Annotations are single-line; GitHub decodes %0A back into newlines.
annotation_escape() {
  printf '%s' "$1" | sed -e 's/%/%25/g' -e 's/\r/%0D/g' | awk 'BEGIN{ORS=""} {print sep $0; sep="%0A"}'
}

# Findings are warnings, never errors: this job is advisory by design.
warn_finding() {
  local title="$1" message="$2"
  if [[ -n "$IN_ACTIONS" ]]; then
    printf '::warning title=%s::%s\n' "$(annotation_escape "$title")" "$(annotation_escape "$message")"
  else
    printf '[deployment-check] FINDING (%s): %s\n' "$title" "$message" >&2
  fi
}

notice() {
  local message="$1"
  if [[ -n "$IN_ACTIONS" ]]; then
    printf '::notice::%s\n' "$(annotation_escape "$message")"
  else
    log "$message"
  fi
}

record() {
  local icon="$1" name="$2" detail="$3"
  SUMMARY_ROWS+=("| ${icon} | ${name} | ${detail} |")
}

record_finding() {
  local name="$1" detail="$2"
  FINDINGS=$((FINDINGS + 1))
  warn_finding "$name" "$detail"
  record "⚠️" "$name" "$detail"
}

# Runs one validator in a subshell so a `fatal` inside it ends only that check.
run_check() {
  local name="$1" fn="$2" out status detail
  out="$(mktemp)"
  if ( set -uo pipefail; "$fn" ) >"$out" 2>&1; then status=0; else status=$?; fi
  group_start "$name"
  cat "$out"
  group_end
  if (( status == 0 )); then
    record "✅" "$name" "passed"
    log "${name}: passed"
  else
    detail="$(grep -m1 'ERROR:' "$out" | sed 's/^\[deployment-check\] ERROR: //')"
    [[ -z "$detail" ]] && detail="$(tail -n 1 "$out")"
    [[ -z "$detail" ]] && detail="check exited ${status} with no output"
    record_finding "$name" "$detail"
  fi
  rm -f "$out"
}

write_summary() {
  local total="${#SUMMARY_ROWS[@]}"
  local heading
  if (( FINDINGS == 0 )); then
    heading="✅ Deployment stack review — no findings across ${total} checks"
  else
    heading="⚠️ Deployment stack review — ${FINDINGS} advisory finding(s) across ${total} checks"
  fi
  notice "${heading} (advisory: this job never fails the pipeline)"
  [[ -z "${GITHUB_STEP_SUMMARY:-}" ]] && return 0
  {
    printf '## %s\n\n' "$heading"
    printf 'These findings are **informational**. This job does not gate the pipeline; '
    printf 'run `CCAM_DEPLOY_VALIDATE_STRICT=1 npm run deploy:validate` for a hard gate.\n\n'
    printf '| | Check | Detail |\n|---|---|---|\n'
    printf '%s\n' "${SUMMARY_ROWS[@]}"
  } >>"$GITHUB_STEP_SUMMARY"
}

# Reports `npm audit --omit=dev` advisories as informational findings. Never
# fatal: most advisories here resolve only through a semver-major upgrade, so
# gating the pipeline on them blocks unrelated work indefinitely.
audit_production_dependencies() {
  local label="$1"
  shift
  local attempt=1
  local max_attempts=3
  local retry_base_seconds="${CCAM_AUDIT_RETRY_BASE_SECONDS:-2}"
  local output errors status report stdout_file stderr_file

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

    # Emits "<vulnerablePackages>\t<distinctAdvisories>" on the first line, then one
    # "<severity>\t<package>\t<title>\t<fix>" line per distinct advisory.
    # Exit 2 means the payload was not a usable audit report.
    if ! report="$(
      printf '%s' "$output" | node -e '
        let body = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => (body += chunk));
        process.stdin.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(body);
          } catch {
            process.exit(2);
          }
          const total = Number(parsed?.metadata?.vulnerabilities?.total);
          if (!Number.isFinite(total)) process.exit(2);
          const lines = [];
          const seen = new Set();
          for (const entry of Object.values(parsed.vulnerabilities ?? {})) {
            for (const via of entry.via ?? []) {
              if (typeof via !== "object" || !via.title) continue;
              const key = via.url ?? via.title;
              if (seen.has(key)) continue;
              seen.add(key);
              const fix = entry.fixAvailable;
              const remedy =
                fix === false || fix == null
                  ? "no fix available"
                  : fix === true
                    ? "fix available"
                    : `fix: ${fix.name}@${fix.version}${fix.isSemVerMajor ? " (semver-major)" : ""}`;
              lines.push([via.severity ?? "unknown", via.name ?? entry.name, via.title, remedy].join("\t"));
            }
          }
          lines.unshift([total, lines.length].join("\t"));
          process.stdout.write(lines.join("\n"));
        });
      '
    )"; then
      if (( attempt < max_attempts )); then
        log "${label} audit transport failure (attempt ${attempt}/${max_attempts}); retrying"
        [[ -n "$errors" ]] && printf '%s\n' "$errors" >&2
        local retry_delay=$(( attempt * retry_base_seconds ))
        log "${label} audit retrying after ${retry_delay}s"
        sleep "$retry_delay"
        ((attempt += 1))
        continue
      fi
      [[ -n "$errors" ]] && printf '%s\n' "$errors" >&2
      record_finding "${label} dependency audit" \
        "could not retrieve a valid registry report after ${max_attempts} attempts"
      return 0
    fi

    local total advisories header
    header="$(printf '%s' "$report" | head -n 1)"
    total="${header%%$'\t'*}"
    advisories="${header##*$'\t'}"
    if (( total == 0 )); then
      record "✅" "${label} dependency audit" "no advisories in production dependencies"
      log "${label} production dependency audit passed"
      return 0
    fi

    group_start "${label} dependency advisories (${advisories} across ${total} package(s))"
    printf '%s\n' "$report" | tail -n +2 |
      while IFS=$'\t' read -r severity package title remedy; do
        [[ -z "$severity" ]] && continue
        printf '  [%s] %s — %s (%s)\n' "$severity" "$package" "$title" "$remedy"
      done
    group_end

    local top
    top="$(printf '%s' "$report" | tail -n +2 | head -n 3 |
      awk -F'\t' '{printf "%s%s: %s (%s)", sep, $1, $3, $4; sep="; "}')"
    record_finding "${label} dependency audit" \
      "${advisories} advisory(ies) affecting ${total} production package(s) — ${top}"
    if (( status != 0 )); then
      log "${label} audit exited ${status} (expected while advisories are open)"
    fi
    return 0
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

validate_headers() {
  log "Authorship headers"
  bash "${PROJECT_ROOT}/.claude/skills/file-headers/scripts/check-headers.sh" >/dev/null ||
    fatal "source files are missing the authorship header"
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

# Writes the summary and decides the exit status. Advisory by default; only
# CCAM_DEPLOY_VALIDATE_STRICT=1 turns findings into a non-zero exit.
finish() {
  write_summary
  if (( FINDINGS > 0 )) && [[ "$STRICT" == "1" ]]; then
    log "CCAM_DEPLOY_VALIDATE_STRICT=1 — failing on ${FINDINGS} finding(s)"
    return 1
  fi
  if (( FINDINGS > 0 )); then
    log "${FINDINGS} advisory finding(s) reported; exiting 0 (advisory review)"
  else
    log "all deployment checks passed"
  fi
  return 0
}

main() {
  cd "${PROJECT_ROOT}"
  run_check "Docker, Compose, and Nginx" validate_docker
  run_check "Helm chart" validate_helm
  run_check "Kustomize manifests" validate_kustomize
  run_check "Terraform" validate_terraform
  run_check "Authorship headers" validate_headers
  audit_production_dependencies "root" npm
  audit_production_dependencies "MCP" npm --prefix mcp
  finish
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
