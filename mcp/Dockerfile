# syntax=docker/dockerfile:1.7
# Multi-stage OCI image for CCAM's MCP server. The repository root is the build
# context so the local agent-dashboard dependency resolves, while the runtime
# contains only production dependencies and compiled output under a non-root
# user.
# @author Son Nguyen <hoangson091104@gmail.com>

ARG NODE_IMAGE=node:24.19.0-alpine3.24@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43

FROM ${NODE_IMAGE} AS deps
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY mcp/package.json mcp/package-lock.json ./mcp/
COPY scripts/postinstall.js ./scripts/postinstall.js

RUN npm --prefix mcp ci --omit=dev

FROM ${NODE_IMAGE} AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
COPY mcp/package.json mcp/package-lock.json ./mcp/
COPY scripts/postinstall.js ./scripts/postinstall.js

RUN npm --prefix mcp ci

COPY mcp ./mcp

RUN npm --prefix mcp run build

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app

RUN apk add --no-cache ca-certificates tini

ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=8819 \
    MCP_DASHBOARD_BASE_URL=http://127.0.0.1:4820

COPY --chown=node:node --from=deps /workspace/mcp/node_modules ./node_modules
COPY --chown=node:node --from=build /workspace/mcp/build ./build
COPY --chown=node:node --from=build /workspace/mcp/package.json ./package.json

USER node

EXPOSE 8819

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8819/health').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--", "node", "build/index.js"]
