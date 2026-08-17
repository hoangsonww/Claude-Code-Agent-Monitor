/**
 * @file Universal webhook delivery for fired alerts. A "target" is an outbound
 * destination described by the provider registry (server/lib/webhook-providers.js)
 * — Slack, Discord, Teams, Mattermost, Rocket.Chat, Telegram, PagerDuty,
 * Opsgenie, Splunk On-Call, Zapier, Make, n8n, Pipedream, or a generic endpoint.
 * When the alerting engine fires an alert (server/lib/alerts.js), it calls
 * dispatchAlert(), which formats the provider-native payload and POSTs it to
 * every enabled target (optionally scoped to specific rules) with a timeout and
 * bounded retry/backoff. Every attempt-chain is recorded in webhook_deliveries.
 *
 * Delivery is detached and fully fail-safe: it never throws into, slows, or
 * blocks the alert path or hook ingestion.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

const crypto = require("crypto");
const { stmts } = require("../db");
const {
  PROVIDERS,
  WEBHOOK_TYPES,
  isGenericFamily,
  resolveUrl,
  resolveAuthHeaders,
  formatPayload,
  truncate,
} = require("./webhook-providers");

// Tunables (env-overridable so tests can shrink timeouts/backoff). All read at
// module load — restart to change.
function posEnv(name, fallback) {
  const raw = parseInt(process.env[name], 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}
const TIMEOUT_MS = posEnv("WEBHOOK_TIMEOUT_MS", 10_000);
const MAX_ATTEMPTS = posEnv("WEBHOOK_MAX_ATTEMPTS", 3);
const RETRY_BASE_MS = posEnv("WEBHOOK_RETRY_BASE_MS", 1500);

// Enabled-target cache. Alert fires are hot; targets only change through the
// CRUD routes, which call invalidateWebhookCache().
let targetsCache = null;

function invalidateWebhookCache() {
  targetsCache = null;
}

/** Parse the JSON columns and coerce the enabled flag for a raw target row. */
function normalizeTarget(row) {
  if (!row) return null;
  let headers = null;
  let ruleIds = null;
  let config = null;
  try {
    headers = row.headers ? JSON.parse(row.headers) : null;
  } catch {
    /* tolerate hand-edited bad JSON — extra headers simply not applied */
  }
  try {
    ruleIds = row.rule_ids ? JSON.parse(row.rule_ids) : null;
  } catch {
    /* tolerate bad JSON — target falls back to "all rules" */
  }
  try {
    config = row.config ? JSON.parse(row.config) : null;
  } catch {
    /* tolerate bad JSON — provider config falls back to empty */
  }
  return { ...row, enabled: row.enabled === 1, headers, rule_ids: ruleIds, config };
}

function loadEnabledTargets() {
  if (targetsCache) return targetsCache;
  targetsCache = stmts.listEnabledWebhookTargets.all().map(normalizeTarget);
  return targetsCache;
}

/**
 * Build the HTTP request for a target + alert: resolved URL, provider-native
 * serialized body, and headers (provider auth headers, plus custom headers and
 * an optional HMAC-SHA256 signature for the generic family). Exported for tests.
 */
function buildRequest(target, alert) {
  const url = resolveUrl(target);
  if (!url) throw new Error(`no URL resolved for webhook type "${target.type}"`);

  const payload = formatPayload(target.type, alert, target.config || {});
  const body = JSON.stringify(payload);

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "claude-code-agent-monitor/webhooks",
    ...resolveAuthHeaders(target),
  };

  if (isGenericFamily(target.type)) {
    if (target.headers && typeof target.headers === "object") {
      for (const [k, v] of Object.entries(target.headers)) {
        if (typeof k !== "string" || typeof v !== "string") continue;
        // Never let a custom header clobber Content-Type or the signature.
        const lower = k.toLowerCase();
        if (lower === "content-type" || lower === "x-webhook-signature") continue;
        headers[k] = v;
      }
    }
    if (target.secret) {
      const ts = new Date().toISOString();
      const sig = crypto.createHmac("sha256", target.secret).update(`${ts}.${body}`).digest("hex");
      headers["X-Webhook-Timestamp"] = ts;
      headers["X-Webhook-Signature"] = `sha256=${sig}`;
    }
  }

  return { url, body, headers };
}

// ── Delivery ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (t.unref) t.unref();
  });
}

async function postOnce(url, body, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (timer.unref) timer.unref();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      redirect: "error",
    });
    // Read the response body — some providers (Splunk On-Call) signal failure
    // in the body despite a 200, so deliver() may need to inspect it. Also
    // frees the socket promptly. (Named distinctly from the `body` param.)
    let responseBody = "";
    try {
      responseBody = await res.text();
    } catch {
      /* body read is best-effort */
    }
    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      error: null,
      body: responseBody,
    };
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    return {
      ok: false,
      status: null,
      error: timedOut ? "timeout" : err?.message || "network error",
      body: "",
    };
  } finally {
    clearTimeout(timer);
  }
}

function recordDelivery(target, alertId, { status, statusCode, attempts, error }) {
  try {
    stmts.insertWebhookDelivery.run(
      target.id,
      target.name,
      target.type,
      alertId == null ? null : alertId,
      status,
      statusCode == null ? null : statusCode,
      attempts,
      error == null ? null : truncate(error, 500)
    );
    stmts.pruneWebhookDeliveries.run();
  } catch (err) {
    console.warn("[WEBHOOK] delivery log write failed:", err?.message || err);
  }
}

/**
 * Deliver one alert to one target with bounded retry. Retries on transport
 * errors, HTTP 429, and 5xx; gives up immediately on other 4xx (misconfigured
 * URL / bad payload won't fix themselves). Always records the outcome and
 * never throws. Returns `{ ok, status, attempts, error }`.
 */
async function deliver(target, alert) {
  let built;
  try {
    built = buildRequest(target, alert);
  } catch (err) {
    recordDelivery(target, alert.id, {
      status: "failed",
      statusCode: null,
      attempts: 0,
      error: `request build failed: ${err?.message || err}`,
    });
    return { ok: false, status: null, attempts: 0, error: "request build failed" };
  }

  let attempts = 0;
  let status = null;
  let error = null;
  const verifyResponse = PROVIDERS[target.type]?.verifyResponse;

  while (attempts < MAX_ATTEMPTS) {
    attempts += 1;
    const res = await postOnce(built.url, built.body, built.headers);
    status = res.status;
    error = res.error;
    if (res.ok) {
      // Some providers (Splunk On-Call) return 200 even on rejection — let the
      // provider veto a "successful" status by inspecting the response body.
      const verdict = verifyResponse ? verifyResponse(res.body) : { ok: true };
      if (verdict.ok) {
        recordDelivery(target, alert.id, {
          status: "success",
          statusCode: status,
          attempts,
          error: null,
        });
        return { ok: true, status, attempts };
      }
      // A logical rejection won't fix on retry — fail immediately.
      error = verdict.error || "provider reported failure";
      break;
    }
    const retryable = status == null || status === 429 || status >= 500;
    if (!retryable || attempts >= MAX_ATTEMPTS) break;
    await sleep(RETRY_BASE_MS * attempts);
  }

  recordDelivery(target, alert.id, {
    status: "failed",
    statusCode: status,
    attempts,
    error: error || (status ? `HTTP ${status}` : "request failed"),
  });
  return {
    ok: false,
    status,
    attempts,
    error: error || (status ? `HTTP ${status}` : "request failed"),
  };
}

/** A target receives an alert when it has no rule scope, or the alert's rule is in scope. */
function targetAppliesTo(target, alert) {
  if (!Array.isArray(target.rule_ids) || target.rule_ids.length === 0) return true;
  return target.rule_ids.includes(alert.rule_id);
}

/**
 * Fan an alert out to every enabled, in-scope target. Returns a promise that
 * settles when all deliveries finish (used by tests); callers in the alert
 * path invoke it fire-and-forget. Never rejects.
 */
function dispatchAlert(alert) {
  let targets;
  try {
    targets = loadEnabledTargets();
  } catch (err) {
    console.warn("[WEBHOOK] target load failed:", err?.message || err);
    return Promise.resolve([]);
  }
  const applicable = targets.filter((t) => {
    try {
      return targetAppliesTo(t, alert);
    } catch {
      return false;
    }
  });
  if (applicable.length === 0) return Promise.resolve([]);
  return Promise.allSettled(applicable.map((t) => deliver(t, alert)));
}

/**
 * Send a synthetic test alert to a single (already DB-loaded, un-redacted)
 * target. Awaits the result so the route can report success/failure inline.
 */
function sendTest(target) {
  const alert = {
    id: null,
    rule_id: null,
    rule_name: "Webhook test",
    rule_type: "test",
    session_id: null,
    agent_id: null,
    message: `Test notification from Claude Code Agent Monitor to "${target.name}". If you can read this, delivery works.`,
    details: { test: true, target: target.name, type: target.type },
    triggered_at: new Date().toISOString(),
  };
  return deliver(target, alert);
}

module.exports = {
  PROVIDERS,
  WEBHOOK_TYPES,
  invalidateWebhookCache,
  loadEnabledTargets,
  normalizeTarget,
  formatPayload,
  buildRequest,
  deliver,
  dispatchAlert,
  sendTest,
  targetAppliesTo,
};
