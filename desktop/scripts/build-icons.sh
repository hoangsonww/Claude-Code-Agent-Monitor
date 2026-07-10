#!/bin/bash
# Generate icon.icns + tray-icon-Template.png{,@2x.png} from the SVG sources.
#
# Uses macOS-built-in tools only — no Homebrew or npm dependencies:
#   * qlmanage : SVG → PNG via Quick Look (always present on macOS)
#   * sips     : PNG resize/format
#   * iconutil : .iconset directory → .icns
#
# This script is idempotent. Run from desktop/ or from anywhere.
# Author: Son Nguyen <hoangson091104@gmail.com>
# @author Son Nguyen <hoangson091104@gmail.com>
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

echo ">>> rendering tray-icon-Template.png{,@2x.png} via Python"
# qlmanage flattens SVG against an opaque white background — the tray PNG
# ends up with alpha=255 everywhere and macOS template tinting turns the
# whole 22x22 bounding box white in the menu bar. Generate the RGBA PNG
# pixel-by-pixel instead. Geometry mirrors tray-icon.svg (22-unit viewBox).
require python3
python3 - <<'PY'
import struct, zlib

def make_png(width, height, pixels):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y*width*4:(y+1)*width*4])
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')

def draw(w, h, s):
    px = bytearray(w * h * 4)  # alpha=0 -> transparent
    def rect(x, y, rw, rh):
        for j in range(y, min(y+rh, h)):
            for i in range(x, min(x+rw, w)):
                o = (j*w + i) * 4
                px[o:o+4] = b'\x00\x00\x00\xff'   # opaque black
    rect(2*s,  14*s, 4*s, 7*s)
    rect(9*s,  11*s, 4*s, 10*s)
    rect(16*s, 5*s,  4*s, 16*s)
    return px

with open('tray-icon-Template.png',    'wb') as f: f.write(make_png(22, 22, draw(22, 22, 1)))
with open('tray-icon-Template@2x.png', 'wb') as f: f.write(make_png(44, 44, draw(44, 44, 2)))
PY

echo ">>> done."
ls -la icon.icns tray-icon-Template.png tray-icon-Template@2x.png
