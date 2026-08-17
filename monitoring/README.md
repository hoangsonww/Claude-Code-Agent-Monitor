# CCAM monitoring stack (Prometheus + Grafana)

![Prometheus](https://img.shields.io/badge/Prometheus-3.13-E6522C?style=flat-square&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-13.1-F46800?style=flat-square&logo=grafana&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-optional-2496ED?style=flat-square&logo=docker&logoColor=white)
![Node.js](https://img.shields.io/badge/npm-managed-339933?style=flat-square&logo=nodedotjs&logoColor=white)

A turnkey [Prometheus](https://prometheus.io/) + [Grafana](https://grafana.com/)
stack that scrapes the dashboard's [`GET /api/metrics`](../docs/API.md#metrics)
endpoint and renders **four auto-provisioned Grafana dashboards** (default home:
**CCAM — Overview**). Use it to watch live
sessions, agent states, event throughput, and token burn from the same
observability stack as the rest of your infra.

**No Homebrew, apt, or global installs required.** There is no official `prometheus` or
`grafana` server package on npm (only client libraries and UI components) — the
stack uses npm's own install lifecycle instead: `npm run monitoring:install`
runs `postinstall` in this folder and pulls official release binaries into
`monitoring/.bin/` (same pattern as Playwright browsers or Electron).

### Supported platforms (npm path)

| OS | Architectures |
| --- | --- |
| macOS | Apple Silicon (`arm64`), Intel (`x64`) |
| Linux | `arm64`, `amd64` (`x64`) |
| Windows | `x64` |

Node.js 22.22+ is the only prerequisite. Node 24 LTS is recommended. On Windows, run the npm commands from
PowerShell or Command Prompt in the repo root (same as the rest of CCAM).

## Grafana login

Open <http://localhost:3000> after `monitoring:up` or `monitoring:docker:up`.
The admin account is **auto-created on first start** — no manual signup:

| Field | Value |
| --- | --- |
| Username | `admin` |
| Password | `admin` for the npm-only local stack; secret file for containers |

The npm-only local stack uses the development credential in
[`grafana.defaults.env`](./grafana.defaults.env). Container stacks read the
password from `deployments/secrets/grafana-admin-password`; they never use the
development default. **CCAM — Overview** is the default
home dashboard (`GF_DASHBOARDS_DEFAULT_HOME_DASHBOARD_UID=ccam-overview`) with
PromQL queries against your live `/api/metrics` scrape — no sample or synthetic
data. The Prometheus datasource is pre-provisioned, so you land straight in the
UI after login.

> If login fails after an earlier Grafana run, reset local state:
> `rm -rf monitoring/.data/grafana` (npm) or recreate the `grafana-data` Docker
> volume, then start the stack again.

```
monitoring/
├── package.json                           # npm install downloads binaries (postinstall)
├── grafana.defaults.env                   # npm-managed local defaults only
├── scripts/                               # lifecycle helpers (setup / up / down)
├── prometheus/
│   ├── prometheus-native.yml              # scrape config for npm-managed stack
│   ├── prometheus.yml                     # scrape config for Docker stack
│   ├── prometheus-docker.yml              # all-Docker stack (docker-compose.full.yml)
│   ├── ccam-rules.yml                     # recording rules (derived from live scrapes)
│   └── consoles/index.html                # Prometheus CCAM console (pre-built graphs)
├── grafana/
│   ├── provisioning/…                     # Docker datasource + dashboard provider
│   ├── provisioning-native/…              # npm-managed datasource template
│   └── dashboards/                        # ccam-overview + 3 focused boards
└── docker-compose.yml                     # optional Docker path
```

## Quick start (npm — no Docker)

1. **Start the dashboard** on loopback (default `npm start` on port 4820). No
   `DASHBOARD_ALLOWED_HOSTS` override is needed — Prometheus scrapes
   `127.0.0.1:4820`, which the server's Host guard already accepts.

   ```bash
   npm start
   ```

2. **One-time install** — uses npm's `postinstall` to download official
   Prometheus + Grafana OSS binaries into `monitoring/.bin/` (~150 MB total):

   ```bash
   npm run monitoring:install
   ```

   (`monitoring:setup` is an alias for the same command.)

3. **Bring up the stack:**

   ```bash
   npm run monitoring:up
   ```

4. **Open Grafana** at <http://localhost:3000> (the npm-only local login is
   `admin` / `admin`). The
   **CCAM — Overview** dashboard is already there — no import step. For
   Prometheus, open the pre-built **CCAM console** at
   <http://localhost:9090/consoles/index.html> (live graphs + tables), or
   <http://localhost:9090> → **Consoles** → `index.html` (`Status → Targets`:
   `ccam` should be **UP**).

Stop with `npm run monitoring:down`. For a foreground session with logs on the
terminal, use `npm run monitoring:start` instead (Ctrl+C stops both).

## Quick start (Docker / Podman)

Use this when you prefer containers or when the dashboard itself runs in Docker.

1. **Create the secret files** used by Prometheus and Grafana:

   ```bash
   umask 077
   openssl rand -hex 32 > deployments/secrets/dashboard-token
   openssl rand -base64 32 > deployments/secrets/grafana-admin-password
   ```

2. **Start the dashboard** with the same dashboard token, and allow the
   container Host name when Prometheus reaches a host-native server:

   ```bash
   DASHBOARD_TOKEN_FILE="$PWD/deployments/secrets/dashboard-token" \
   DASHBOARD_ALLOWED_HOSTS=host.docker.internal \
   npm start
   ```

3. **Bring up the pinned Prometheus 3.13.2 and Grafana 13.1.2 stack:**

   ```bash
   npm run monitoring:docker:up
   ```

4. **Open Grafana** at <http://localhost:3000>. The user defaults to `admin`;
   the password is `deployments/secrets/grafana-admin-password`.

Tear down with `npm run monitoring:docker:down`.

### All-in-one Docker or Podman

Runs dashboard, authenticated MCP, rootless Nginx, Prometheus, and Grafana on
one private network:

```bash
npm run docker:full:up
npm run monitoring:verify
```

Stop with `npm run docker:full:down`.

## Deployment options

| Dashboard | Monitoring | Commands |
| --- | --- | --- |
| **npm** (`npm start`) | **npm** | `monitoring:install` → `monitoring:up` |
| **npm** | **Docker** | `DASHBOARD_ALLOWED_HOSTS=host.docker.internal npm start` → `monitoring:docker:up` |
| **Docker** (`docker:up`) | **Docker** | `DASHBOARD_ALLOWED_HOSTS=host.docker.internal docker compose up -d` → `monitoring:docker:up` |
| **Docker** | **npm** | `docker:up` + `monitoring:up` (scrapes host `127.0.0.1:4820`) |
| **Docker/Podman full stack** | **included** | create secrets → `docker:full:up` |

Verify any running stack: `npm run monitoring:verify`.

## npm scripts

| Command | Description |
| --- | --- |
| `npm run monitoring:install` | `npm install` in `monitoring/` — downloads binaries via `postinstall` |
| `npm run monitoring:setup` | Alias for `monitoring:install` |
| `npm run monitoring:up` | Start Prometheus (:9090) + Grafana (:3000) in the background |
| `npm run monitoring:down` | Stop the npm-managed stack |
| `npm run monitoring:start` | Foreground start (Ctrl+C stops both) |
| `npm run monitoring:docker:up` | `docker compose` Prometheus + Grafana |
| `npm run monitoring:docker:down` | Tear down the Docker monitoring stack |
| `npm run monitoring:verify` | Health-check dashboard + Prometheus + Grafana + scrape target |
| `npm run docker:up` | Start the dashboard container only |
| `npm run docker:down` | Stop the dashboard container |
| `npm run docker:full:up` | Dashboard + authenticated MCP + Nginx + Prometheus + Grafana |
| `npm run docker:full:down` | Tear down the full Docker stack |

## Bundled Grafana dashboards

Four dashboards are auto-provisioned from `grafana/dashboards/` — all query live
`/api/metrics` data (no sample or synthetic series):

| Dashboard | UID | Focus |
| --- | --- | --- |
| **CCAM — Overview** | `ccam-overview` | Default home — fleet snapshot, totals, breakdowns, rates |
| **CCAM — Sessions & Agents** | `ccam-sessions-agents` | Session lifecycle, agent states, WebSocket clients |
| **CCAM — Tokens & Events** | `ccam-tokens-events` | Cumulative tokens/events, throughput rates, cache efficiency |
| **CCAM — Platform Health** | `ccam-platform` | Scrape/API uptime, process memory, remote sources, build info |

Each board links to the others in the header. After `monitoring:up`, open
http://localhost:3000/dashboards or land on **Overview** as the home dashboard.

## What's on the Overview dashboard

The bundled **CCAM — Overview** board uses only metrics from your database.
**Cumulative stat panels** (total sessions, events, tokens) show substantial
numbers on the first scrape; **rate panels** need a few minutes of scrape
history before lines appear.

| Section | Example queries |
| --- | --- |
| Live fleet | `ccam_sessions{status="active"}`, `ccam_agents{status="working"}`, `ccam_websocket_clients`, `sum(ccam_sessions)` |
| Database totals | `ccam_sessions{status="completed"}`, `ccam_events_total`, `ccam_tokens_total`, `sum(ccam_tokens_total)` |
| Breakdown | `ccam_sessions` (pie), `ccam_tokens_total` (bar gauge) |
| Over time | `ccam_sessions`, `ccam_events_total`, `ccam_tokens_total` |
| Rates | `rate(ccam_events_total[5m])`, `rate(ccam_tokens_total[5m])` |
| Process | `ccam_process_uptime_seconds`, `ccam_process_resident_memory_bytes`, `ccam_build_info` |

See [`docs/API.md` → Metrics](../docs/API.md#metrics) for the full metric list.

## Prometheus quick start

**Open the CCAM console first** — static HTML that queries Prometheus directly
(Prometheus 3.x compatible; no deprecated console template libraries):

**http://localhost:9090/consoles/index.html**

Also reachable from the Prometheus UI menu: **Consoles → index.html**.

The console runs real PromQL against your scraped metrics: session totals,
cumulative events/tokens, working agents, and drill-down links into the Graph UI.
If the page warns about a missing scrape target, start CCAM on port 4820 and
wait ~15s for the first poll.

### Graph tab bookmarks

Open [http://localhost:9090](http://localhost:9090) and paste any of these into
the **Graph** tab (all read live scraped data — never seeded):

| Query | What it shows |
| --- | --- |
| `sum(ccam_sessions)` | Total sessions across all statuses |
| `ccam_events_total` | Cumulative hook events in the database |
| `sum(ccam_tokens_total)` | All token kinds combined |
| `ccam:sessions:total` | Same as above via [recording rule](./prometheus/ccam-rules.yml) |
| `ccam:events:rate5m` | Events per second (5m window) |

Pre-filled graph links (bookmark these):

- [Total sessions](http://localhost:9090/graph?g0.expr=sum(ccam_sessions)&g0.tab=0)
- [Total events](http://localhost:9090/graph?g0.expr=ccam_events_total&g0.tab=0)
- [Token totals by kind](http://localhost:9090/graph?g0.expr=ccam_tokens_total&g0.tab=0)

## Configuration

- **npm-managed stack.** Scrape target lives in
  [`prometheus/prometheus-native.yml`](./prometheus/prometheus-native.yml)
  (default `127.0.0.1:4820`). Binary versions are pinned in
  [`scripts/paths.js`](./scripts/paths.js).
- **Docker stack.** Host-native dashboard: [`prometheus/prometheus.yml`](./prometheus/prometheus.yml)
  (`host.docker.internal:4820`). All-Docker stack: [`prometheus/prometheus-docker.yml`](./prometheus/prometheus-docker.yml)
  (`agent-monitor:4820`, used by `docker-compose.full.yml`).
- **<a id="auth"></a>Auth (`DASHBOARD_TOKEN`).** If the server requires a token,
  uncomment the `authorization` block in the relevant prometheus config and set
  `credentials` to your `DASHBOARD_TOKEN`. (The `DASHBOARD_ALLOWED_HOSTS` step is
  still required for Docker scrapes — the Host guard runs independently of the
  token.)
- **Scrape interval** lives in the prometheus config (`global.scrape_interval`).
- **Grafana admin password.** The npm-only local stack uses `admin` / `admin`
  via [`grafana.defaults.env`](./grafana.defaults.env) and
  `grafanaAdminEnv()` in [`scripts/paths.js`](./scripts/paths.js). Docker and
  Podman stacks read `deployments/secrets/grafana-admin-password`. Each value is
  applied on **first start** only; wipe `monitoring/.data/grafana` or recreate
  the `grafana-data` volume to re-seed.

## Security note

`/api/metrics` exposes aggregate operational counts (session/agent tallies, event
and token totals, uptime) — no prompts, transcripts, costs, or secrets. It sits
behind the same loopback/Host guard and optional `DASHBOARD_TOKEN` as the rest of
the API; scraping is only possible once you explicitly allow the scraper's Host
(and token, if set). Keep Grafana/Prometheus on a trusted network or behind your
own reverse proxy.
