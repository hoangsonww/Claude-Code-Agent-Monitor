<#
.SYNOPSIS
    Generate assets/icon.ico from assets/icon.png — the Windows counterpart to
    scripts/build-icons.sh (which produces icon.icns + the macOS tray PNGs).

.DESCRIPTION
    Uses only the .NET Framework's System.Drawing (always present on Windows) —
    no ImageMagick, no npm dependency. icon.png is the 1024x1024 raster already
    rendered from assets/icon.svg by the macOS icon pipeline; this script
    downscales it to the standard Windows icon sizes and packs them into a
    classic, maximally-compatible BMP-based .ico (32bpp BGRA + AND mask). That
    format is what electron-builder embeds in the .exe and what NSIS uses for
    the installer icon, and it renders correctly on Windows 7 through 11.

    Idempotent. Run from anywhere:
        powershell -ExecutionPolicy Bypass -File desktop/scripts/build-win-icon.ps1

.NOTES
    Author: Son Nguyen <hoangson091104@gmail.com>
#>
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$assets = Join-Path (Split-Path -Parent $here) 'assets'
$srcPng = Join-Path $assets 'icon.png'
$outIco = Join-Path $assets 'icon.ico'

if (-not (Test-Path $srcPng)) {
    throw "icon.png not found at $srcPng. Generate it first (scripts/build-icons.sh renders it from icon.svg)."
}

# Standard Windows icon ladder. 256 is required by electron-builder; the small
# sizes keep the taskbar / Alt-Tab / tray crisp.
$sizes = 16, 24, 32, 48, 64, 128, 256

$src = [System.Drawing.Image]::FromFile($srcPng)
$entries = New-Object System.Collections.ArrayList

try {
    foreach ($s in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($src, 0, 0, $s, $s)
        $g.Dispose()

        # Pull raw pixels: Format32bppArgb is stored little-endian as B,G,R,A —
        # exactly the byte order a 32bpp DIB wants. Rows are top-down here.
        $rect = New-Object System.Drawing.Rectangle(0, 0, $s, $s)
        $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $stride = $data.Stride
        $buf = New-Object byte[] ($stride * $s)
        [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $buf.Length)
        $bmp.UnlockBits($data)
        $bmp.Dispose()

        # Build the DIB: BITMAPINFOHEADER(40) + XOR bitmap (bottom-up BGRA) +
        # 1bpp AND mask (bottom-up, all zeros — alpha channel does the masking).
        $ms = New-Object System.IO.MemoryStream
        $bw = New-Object System.IO.BinaryWriter($ms)
        $bw.Write([int]40)        # biSize
        $bw.Write([int]$s)        # biWidth
        $bw.Write([int]($s * 2))  # biHeight = XOR height + AND height
        $bw.Write([int16]1)       # biPlanes
        $bw.Write([int16]32)      # biBitCount
        $bw.Write([int]0)         # biCompression = BI_RGB
        $bw.Write([int]0)         # biSizeImage
        $bw.Write([int]0)         # biXPelsPerMeter
        $bw.Write([int]0)         # biYPelsPerMeter
        $bw.Write([int]0)         # biClrUsed
        $bw.Write([int]0)         # biClrImportant

        # XOR pixels, bottom-up.
        for ($y = $s - 1; $y -ge 0; $y--) {
            $bw.Write($buf, $y * $stride, 4 * $s)
        }
        # AND mask: 1 bit/pixel, each row padded to a 4-byte boundary, all zero.
        $maskRow = [int]([math]::Floor((($s + 31) / 32)) * 4)
        $zeros = New-Object byte[] ($maskRow)
        for ($y = 0; $y -lt $s; $y++) { $bw.Write($zeros, 0, $maskRow) }

        $bw.Flush()
        [void]$entries.Add([pscustomobject]@{ Size = $s; Data = $ms.ToArray() })
        $bw.Dispose(); $ms.Dispose()
    }
}
finally {
    $src.Dispose()
}

# Assemble the .ico: ICONDIR header, then one ICONDIRENTRY per image, then data.
$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter($out)
$w.Write([int16]0)               # reserved
$w.Write([int16]1)               # type = icon
$w.Write([int16]$entries.Count)  # image count

$offset = 6 + 16 * $entries.Count
foreach ($e in $entries) {
    $dim = if ($e.Size -ge 256) { 0 } else { $e.Size }  # 0 means 256 in the dir
    $w.Write([byte]$dim)             # width
    $w.Write([byte]$dim)             # height
    $w.Write([byte]0)                # palette color count
    $w.Write([byte]0)                # reserved
    $w.Write([int16]1)               # color planes
    $w.Write([int16]32)              # bits per pixel
    $w.Write([int]$e.Data.Length)    # size of image data
    $w.Write([int]$offset)           # offset of image data
    $offset += $e.Data.Length
}
foreach ($e in $entries) { $w.Write($e.Data, 0, $e.Data.Length) }
$w.Flush()
[System.IO.File]::WriteAllBytes($outIco, $out.ToArray())
$w.Dispose(); $out.Dispose()

Write-Output ("Wrote {0} ({1:N0} bytes, sizes: {2})" -f $outIco, (Get-Item $outIco).Length, ($sizes -join ', '))
