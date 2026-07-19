# Multi-stage Dockerfile for Claude Code Agent Monitor - a Node.js server with a React client.
# This setup optimizes the final image size by separating the build and runtime stages.
# The first stage installs only the production dependencies for the server, while the second stage builds the React client.
# The final stage combines the necessary files and dependencies to run the application in production.
# Compatibility: This setup is compatible with both Podman and Docker. Runnable on any platform that supports Node.js and Alpine Linux.
#
# Author: Son Nguyen <hoangson091104@gmail.com>

# ── Stage 1: Install server production deps ───────────────────────────
FROM node:22-alpine AS server-deps
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
FROM node:22-alpine AS client-build
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
FROM node:22-alpine
WORKDIR /app

COPY --from=server-deps /app/node_modules ./node_modules/
COPY package.json ./
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY statusline/ ./statusline/
COPY --from=client-build /app/client/dist ./client/dist/

RUN mkdir -p data

EXPOSE 4820

ENV NODE_ENV=production

# In a container the app MUST bind all interfaces: the server binds loopback by
# default (GHSA-gr74-4xfh-6jw9), but a container's loopback is a separate
# namespace the published port cannot reach, so a loopback bind makes the port
# unreachable. Inside a container the trust boundary is the *host* port publish
# (keep it on 127.0.0.1 — see docker-compose.yml / INSTALL.md), not this bind.
ENV DASHBOARD_HOST=0.0.0.0

# The recommended ~/.claude bind mount is read-only, so the server cannot write
# its default data dir (~/.claude/agent-dashboard). Persist to the mounted
# volume at /app/data instead.
ENV DASHBOARD_DATA_DIR=/app/data

CMD ["node", "server/index.js"]
