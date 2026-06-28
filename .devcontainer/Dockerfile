# Optional dev-container image for Claude Code Agent Monitor.
# Node 22 to match the production Dockerfile and the project's engines.
# Adds the native-addon toolchain (better-sqlite3 builds via node-gyp) plus
# Python 3 (statusline.py and helper scripts) and the sqlite3 CLI.
#
# This image is ONLY used by Dev Containers / Codespaces. Host-based development
# (npm run dev / npm start) is unaffected.
#
# Author: Son Nguyen <hoangson091104@gmail.com>
FROM mcr.microsoft.com/devcontainers/javascript-node:22

# node-gyp needs python3 + a C/C++ toolchain to compile better-sqlite3.
# python-is-python3 makes `python` resolve to python3 for node-gyp.
# sqlite3 is handy for inspecting the dashboard DB during development.
RUN export DEBIAN_FRONTEND=noninteractive \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
  build-essential \
  python3 \
  python-is-python3 \
  sqlite3 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*
