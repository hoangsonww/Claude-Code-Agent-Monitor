#!/usr/bin/env bash
#
# @file statusline-command.sh — wrapper that Claude Code invokes for its custom statusline;
# pipes the JSON event payload into statusline.py (update the path to match your install).
# @author Son Nguyen <hoangson091104@gmail.com>
#
PYTHONUTF8=1 python3 "C:/Users/nguyens6/.claude/statusline.py"
# IMPORTANT:
# Put the statusline.py file in the .claude folder in your user directory (e.g. C:/Users/nguyens6/.claude/statusline.py) and make sure to update the path in the above command if you place it somewhere else.
# Change the above path to the location of your statusline.py file. You can also change the command to run a different script if you want to display something else in your status line.
