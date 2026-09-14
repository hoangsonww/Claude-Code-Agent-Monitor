#!/usr/bin/env bash
# wiki-block-lengths.sh — measure the length of the wiki's fixed-size prose
# blocks so a new entry matches the ones already there instead of blowing up
# the layout. The feature carousel gives every card the same box: a card that
# is far longer than its neighbours overflows or squashes the whole carousel.
#
# Usage (from the repo root):
#   .claude/skills/update-project-docs/scripts/wiki-block-lengths.sh          # both groups
#   .claude/skills/update-project-docs/scripts/wiki-block-lengths.sh cards
#   .claude/skills/update-project-docs/scripts/wiki-block-lengths.sh captions
#
# Prints one line per block (character count of the tag-stripped text) plus the
# min/median/max of the group and flags any block outside the existing range.
# @author Son Nguyen <hoangson091104@gmail.com>

set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)" || exit 1
WHICH="${1:-all}"

python3 - "$WHICH" <<'PY'
import re, statistics, sys
from html import unescape

which = sys.argv[1]
html = open("wiki/index.html", encoding="utf-8").read()
strip = lambda s: unescape(" ".join(re.sub(r"<[^>]+>", "", s).split()))
status = 0


def report(title, items, tolerance):
    """tolerance is the multiple of the group median a block may not exceed.
    Carousel cards share one fixed-height box, so they get the tighter bound."""
    global status
    if not items:
        return
    lengths = [n for _, n in items]
    lo, hi = min(lengths), max(lengths)
    # Keep this arithmetic identical to the gate in client/tests/wiki-i18n.test.ts:
    # statistics median (mean of the two middles when the group is even), then
    # truncate both it and the budget, so the two never disagree on a block.
    med = int(statistics.median(lengths))
    budget = int(med * tolerance)
    print(
        f"\n{title} — {len(items)} blocks | min {lo} · median {med} · max {hi} chars"
        f" | budget {budget}"
    )
    for name, n in items:
        flag = ""
        if n > budget:
            flag = "  <-- TOO LONG: trim toward the median"
            status = 1
        print(f"  {n:5d}  {name}{flag}")


if which in ("all", "cards"):
    # The carousel runs to the end of its section; `.feature-card` is also used
    # in grids elsewhere on the page, so bound the slice instead of scanning all.
    start = html.index('<div class="carousel" id="feature-carousel">')
    seg = html[start : html.index("</section>", start)]
    # Most cards carry an `id` on their <h3> (they are cross-referenced from the
    # nav and from other docs), but plenty do not — match the card container and
    # fall back to the heading text so no card escapes the budget.
    card_re = re.compile(
        r'<div\b[^>]*\bclass="[^"]*\bfeature-card\b[^"]*"[^>]*>'
        r'.*?<h3(?:[^>]*\bid="([^"]+)")?[^>]*>(.*?)</h3>\s*<p>(.*?)</p>',
        re.S,
    )
    cards = [
        (m.group(1) or strip(m.group(2)), len(strip(m.group(3))))
        for m in card_re.finditer(seg)
    ]
    report("Feature carousel cards", cards, 1.5)

if which in ("all", "captions"):
    # Same class-token match as the cards: one caption carries an inline style,
    # and an exact-tag pattern would skip it.
    caption_re = re.compile(
        r'<div\b[^>]*\bclass="[^"]*\bscreenshot-caption\b[^"]*"[^>]*>(.*?)</div>', re.S
    )
    caps = [
        (strip(m.group(1))[:48], len(strip(m.group(1)))) for m in caption_re.finditer(html)
    ]
    report("Screenshot captions", caps, 2.0)

print()
sys.exit(status)
PY
