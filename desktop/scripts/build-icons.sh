#!/bin/bash
# Generate icon.icns + tray-icon-Template.png{,@2x.png} from the SVG sources.
#
# Uses macOS-built-in tools only — no Homebrew or npm dependencies:
#   * qlmanage : SVG → PNG via Quick Look (always present on macOS)
#   * sips     : PNG resize/format
#   * iconutil : .iconset directory → .icns
#
# This script is idempotent. Run from desktop/ or from anywhere.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS="$(cd "$HERE/../assets" && pwd)"

require() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "error: required tool '$1' not found. This script only runs on macOS." >&2
        exit 1
    }
}
require qlmanage
require sips
require iconutil

cd "$ASSETS"

echo ">>> rendering icon.svg → icon.png (1024)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
qlmanage -t -s 1024 -o "$TMP" icon.svg >/dev/null 2>&1
mv "$TMP/icon.svg.png" icon.png

echo ">>> building icon.iconset"
rm -rf icon.iconset
mkdir -p icon.iconset
for s in 16 32 64 128 256 512 1024; do
    sips -z "$s" "$s" icon.png --out "icon.iconset/icon_${s}x${s}.png" >/dev/null
done
# Apple's @2x naming convention.
cp icon.iconset/icon_32x32.png   icon.iconset/icon_16x16@2x.png
cp icon.iconset/icon_64x64.png   icon.iconset/icon_32x32@2x.png
cp icon.iconset/icon_256x256.png icon.iconset/icon_128x128@2x.png
cp icon.iconset/icon_512x512.png icon.iconset/icon_256x256@2x.png
cp icon.iconset/icon_1024x1024.png icon.iconset/icon_512x512@2x.png
# Drop the 64-only file; iconutil dislikes unknown sizes.
rm -f icon.iconset/icon_64x64.png

echo ">>> compiling icon.icns"
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset

echo ">>> rendering tray-icon.svg → tray-icon-Template.png (22, 44)"
qlmanage -t -s 88 -o "$TMP" tray-icon.svg >/dev/null 2>&1
mv "$TMP/tray-icon.svg.png" "$TMP/tray-44.png"
sips -z 22 22 "$TMP/tray-44.png" --out tray-icon-Template.png >/dev/null
sips -z 44 44 "$TMP/tray-44.png" --out tray-icon-Template@2x.png >/dev/null

echo ">>> done."
ls -la icon.icns tray-icon-Template.png tray-icon-Template@2x.png
