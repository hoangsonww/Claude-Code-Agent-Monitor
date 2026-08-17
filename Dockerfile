# Multi-stage OCI image for the complete CCAM dashboard runtime. It builds the
# React client, installs production server dependencies, includes Git and
# OpenSSH for update checks and Remote Data Sources, and runs the application
# as a non-root user with explicit writable data and configuration paths.
# Compatible with Docker, Podman, Kubernetes, and other OCI runtimes.
#
# Author: Son Nguyen <hoangson091104@gmail.com>

ARG NODE_IMAGE=node:24.19.0-alpine3.24@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43

# ── Stage 1: Install server production deps ───────────────────────────
FROM ${NODE_IMAGE} AS server-deps
WORKDIR /app
COPY package.json package-lock.json ./
# The root `postinstall` hook (scripts/postinstall.js) fires during `npm ci`, so
# the file must exist here or npm aborts with MODULE_NOT_FOUND before installing
# anything. It self-skips when client/ is absent (as it is in this stage), so
# copying just the one script keeps this deps-cache layer from busting on
# unrelated scripts/ edits. Do NOT use --ignore-scripts: that would also skip
# better-sqlite3's prebuild fetch and silently drop the native SQLite driver.
COPY scripts/postinstall.js ./scripts/postinstall.js
RUN npm ci --omit=dev

# ── Stage 2: Build React client ───────────────────────────────────────
FROM ${NODE_IMAGE} AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
# vite.config.ts stamps the UI version from the repo-root package.json (one level
# up from the client dir). Provide it here so the built client shows the real
# release version; the config falls back gracefully if it is ever absent.
COPY package.json /app/package.json
RUN npm run build

# ── Stage 3: Production runtime ───────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime

WORKDIR /app

RUN apk add --no-cache ca-certificates git openssh-client sqlite tini tzdata \
  && mkdir -p /app/config /app/data /home/node/.claude /home/node/.codex \
  && chown -R node:node /app /home/node

COPY --chown=node:node --from=server-deps /app/node_modules ./node_modules/
COPY --chown=node:node package.json ./
COPY --chown=node:node server/ ./server/
COPY --chown=node:node scripts/ ./scripts/
COPY --chown=node:node statusline/ ./statusline/
COPY --chown=node:node --from=client-build /app/client/dist ./client/dist/

USER node

EXPOSE 4820

ENV NODE_ENV=production \
    HOME=/home/node \
    CLAUDE_HOME=/home/node/.claude \
    DASHBOARD_CODEX_HOME=/home/node/.codex \
    DASHBOARD_DATA_DIR=/app/data \
    DASHBOARD_ENV_PATH=/app/config/.env \
    DASHBOARD_HOST=0.0.0.0 \
    DASHBOARD_LIVENESS_PROBE=0

VOLUME ["/app/data", "/app/config"]

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4820/api/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/index.js"]

# ── Optional agent execution runtime ──────────────────────────────────
# The dashboard image above supports the full monitoring/import/config surface.
# Build this target only when the Run page must launch Claude Code or Codex
# inside the container. Pin both CLIs at build time for reproducible releases.
FROM runtime AS agent-runtime
ARG CLAUDE_CODE_VERSION=2.1.222
ARG CODEX_VERSION=0.146.0

USER root
RUN npm install --global \
      "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
      "@openai/codex@${CODEX_VERSION}" \
  && npm cache clean --force
USER node
