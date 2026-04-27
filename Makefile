# ─────────────────────────────────────────────────────────────────────────────
# Claude Code Agent Monitor — Makefile
# A collection of convenient commands for development, testing, and deployment.
# Prerequisites: GNU Make, Node.js, npm
# Author: Son Nguyen <hoangson091104@gmail.com>
# Quickstart:
#   make setup            # Install all dependencies
#   make dev              # Start server + client in watch mode
#   make build            # Build the React client for production
#   make start            # Start the production server
#   make test             # Run all tests
#   make format           # Format all files with Prettier
#   make mcp-dev          # Start MCP server in watch mode
#   make seed             # Load deterministic demo data
# For more commands, run `make help` to see descriptions, or see below.
# ─────────────────────────────────────────────────────────────────────────────

.DEFAULT_GOAL := help
SHELL         := /bin/bash

# ─── Setup ──────────────────────────────────────────────────────────────────

.PHONY: setup
setup: ## Install all dependencies (root + client + MCP)
	npm install
	cd client && npm install
	npm --prefix mcp install

.PHONY: install-hooks
install-hooks: ## Register Claude Code hooks in ~/.claude/settings.json
	node scripts/install-hooks.js

# ─── Development ────────────────────────────────────────────────────────────

.PHONY: dev
dev: ## Start server + client in watch mode (concurrent)
	npx concurrently -n server,client -c blue,green "npm run dev:server" "npm run dev:client"

.PHONY: dev-server
dev-server: ## Start only the Express server in watch mode
	node --watch server/index.js

.PHONY: dev-client
dev-client: ## Start only the Vite dev server
	cd client && npm run dev

# ─── Production ─────────────────────────────────────────────────────────────

.PHONY: build
build: ## Build the React client for production
	cd client && npm run build

.PHONY: start
start: ## Start the production server (build first)
	node server/index.js

.PHONY: prod
prod: build start ## Build client then start production server

# ─── Testing ────────────────────────────────────────────────────────────────

.PHONY: test
test: ## Run all tests (server + client)
	node --test server/__tests__/*.test.js
	cd client && npm test

.PHONY: test-server
test-server: ## Run server tests only
	node --test server/__tests__/*.test.js

.PHONY: test-client
test-client: ## Run client tests only
	cd client && npm test

# ─── Formatting ─────────────────────────────────────────────────────────────

.PHONY: format
format: ## Format all files with Prettier
	npx prettier --write .

.PHONY: format-check
format-check: ## Check formatting without writing
	npx prettier --check .

# ─── MCP Server ─────────────────────────────────────────────────────────────

.PHONY: mcp-install
mcp-install: ## Install MCP server dependencies
	npm --prefix mcp install

.PHONY: mcp-build
mcp-build: ## Compile MCP TypeScript → JavaScript
	npm --prefix mcp run build

.PHONY: mcp-typecheck
mcp-typecheck: ## Type-check MCP source without emitting
	npm --prefix mcp run typecheck

.PHONY: mcp-start
mcp-start: ## Start the MCP stdio server
	npm --prefix mcp run start

.PHONY: mcp-dev
mcp-dev: ## Start MCP server in watch mode
	npm --prefix mcp run dev

# ─── Data Management ───────────────────────────────────────────────────────

.PHONY: seed
seed: ## Load deterministic demo data
	node scripts/seed.js

.PHONY: import-history
import-history: ## Import sessions from ~/.claude/ history
	node scripts/import-history.js

.PHONY: clear-data
clear-data: ## Delete all data rows (preserves schema)
	node scripts/clear-data.js

# ─── Docker / Podman ───────────────────────────────────────────────────────

.PHONY: docker-build
docker-build: ## Build dashboard Docker image
	docker build -t claude-agent-monitor:local .

.PHONY: docker-up
docker-up: ## Start via docker-compose
	docker compose up -d

.PHONY: docker-down
docker-down: ## Stop docker-compose stack
	docker compose down

.PHONY: docker-logs
docker-logs: ## Tail docker-compose logs
	docker compose logs -f

.PHONY: mcp-docker-build
mcp-docker-build: ## Build MCP Docker image
	docker build -f mcp/Dockerfile -t agent-dashboard-mcp:local .

.PHONY: podman-build
podman-build: ## Build dashboard Podman image
	podman build -t localhost/claude-agent-monitor:local .

.PHONY: mcp-podman-build
mcp-podman-build: ## Build MCP Podman image
	podman build -f mcp/Dockerfile -t localhost/agent-dashboard-mcp:local .

# ─── Help ───────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
