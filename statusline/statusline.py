"""
statusline.py — Claude Code custom statusline renderer.

Reads a JSON event payload from stdin (emitted by Claude Code on every turn)
and prints a single ANSI-colored status line to stdout. Renders the model
display name, current user, working directory (with home collapsed to ``~``),
active git branch, a color-coded context window usage bar (green / yellow /
red thresholds), and token counts. Always exits 0 so it can never block
Claude Code — missing fields are silently skipped.

Intended to be referenced from Claude Code's ``statusLine`` setting (see
``statusline-command.sh`` for the wrapper) or installed to
``~/.claude/statusline.py``.

:file: statusline/statusline.py
:module: Claude-Code-Agent-Monitor.statusline
:author: Son Nguyen <hoangson091104@gmail.com>
:maintainer: Son Nguyen (a.k.a. David Nguyen, hoangsonww)
:copyright: (c) 2026 Son Nguyen
:license: MIT
:repository: https://github.com/hoangsonww/Claude-Code-Agent-Monitor
:requires: Python 3.6+
:encoding: utf-8

@author Son Nguyen <hoangson091104@gmail.com>
"""

__file_name__ = "statusline.py"
__module__ = "Claude-Code-Agent-Monitor.statusline"
__author__ = "Son Nguyen"
__email__ = "hoangson091104@gmail.com"
__maintainer__ = "Son Nguyen"
__copyright__ = "Copyright (c) 2026 Son Nguyen"
__license__ = "MIT"
__version__ = "1.0.0"
__status__ = "Production"
__repository__ = "https://github.com/hoangsonww/Claude-Code-Agent-Monitor"

import sys
import json
import os
import subprocess

sys.stdout.reconfigure(encoding='utf-8')

CYAN    = '\033[0;36m'
GREEN   = '\033[0;32m'
YELLOW  = '\033[0;33m'
MAGENTA = '\033[0;35m'
RED     = '\033[0;31m'
DIM     = '\033[2m'
RESET   = '\033[0m'

raw = sys.stdin.read().strip()
if not raw:
    sys.exit(0)

try:
    data = json.loads(raw)
except Exception:
    sys.exit(0)

parts = []

# Model
model = (data.get('model') or {}).get('display_name', '')
if model:
    parts.append(f"{CYAN}{model}{RESET}")

# User
user = os.environ.get('USERNAME') or os.environ.get('USER', '')
if user:
    parts.append(f"{GREEN}{user}{RESET}")

# CWD — strip home prefix
cwd = (data.get('workspace') or {}).get('current_dir') or data.get('cwd', '')
if cwd:
    home = os.path.expanduser('~')  # C:\Users\nguyens6
    if cwd.startswith(home):
        cwd = '~' + cwd[len(home):].replace('\\', '/')
    else:
        cwd = cwd.replace('\\', '/')
    parts.append(f"{YELLOW}{cwd}{RESET}")

# Git branch
git_dir = (data.get('workspace') or {}).get('current_dir') or data.get('cwd', '')
if git_dir:
    try:
        branch = subprocess.check_output(
            ['git', '-C', git_dir, '--no-optional-locks', 'symbolic-ref', '--short', 'HEAD'],
            stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        try:
            branch = subprocess.check_output(
                ['git', '-C', git_dir, '--no-optional-locks', 'rev-parse', '--short', 'HEAD'],
                stderr=subprocess.DEVNULL
            ).decode().strip()
        except Exception:
            branch = ''
    if branch:
        parts.append(f"{MAGENTA}{branch}{RESET}")

# Context bar
ctx = data.get('context_window') or {}
used_pct = ctx.get('used_percentage')
if used_pct is not None:
    bar_len = 10
    filled = round(bar_len * used_pct / 100)
    bar = '█' * filled + '░' * (bar_len - filled)
    color = RED if used_pct >= 80 else YELLOW if used_pct >= 50 else GREEN
    parts.append(f"{color}{bar} {used_pct}%{RESET}")

# Tokens
usage = ctx.get('current_usage') or {}
in_tok  = usage.get('input_tokens')
out_tok = usage.get('output_tokens')
cache   = usage.get('cache_read_input_tokens')
if in_tok is not None and out_tok is not None:
    tok_parts = [f"{GREEN}{in_tok}↑{RESET}", f"{CYAN}{out_tok}↓{RESET}"]
    if cache:
        tok_parts.append(f"{DIM}{cache}c{RESET}")
    parts.append(' '.join(tok_parts))

# Session cost (USD) — shown on both API and subscription plans
cost = (data.get('cost') or {}).get('total_cost_usd')
if cost is not None:
    try:
        cost_f = float(cost)
        cost_color = RED if cost_f >= 20 else YELLOW if cost_f >= 5 else GREEN
        parts.append(f"{cost_color}${cost_f:.4f}{RESET}")
    except (TypeError, ValueError):
        pass

sep = f"{DIM} | {RESET}"
print(sep.join(parts))
