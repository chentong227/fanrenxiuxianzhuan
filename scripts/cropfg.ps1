# 前景条带裁角：把 fg_*.png 裁成左/右两角图（_l/_r）——
# 前景=两角各一丛探入画框，中央完全留空（觅长生式角落草）
param([string]$Path)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Path)
$w = $img.Width; $h = $img.Height
$cut = [int]($w * 0.34)
$dir = Split-Path $Path
$base = [System.IO.Path]::GetFileNameWithoutExtension($Path)

# 左角
$bmpL = New-Object System.Drawing.Bitmap($cut, $h)
$gL = [System.Drawing.Graphics]::FromImage($bmpL)
$gL.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $cut, $h)), (New-Object System.Drawing.Rectangle(0, 0, $cut, $h)), [System.Drawing.GraphicsUnit]::Pixel)
$gL.Dispose()
$outL = Join-Path $dir ($base + "_l.png")
$bmpL.Save($outL, [System.Drawing.Imaging.ImageFormat]::Png)
$bmpL.Dispose()

# 右角
$bmpR = New-Object System.Drawing.Bitmap($cut, $h)
$gR = [System.Drawing.Graphics]::FromImage($bmpR)
$gR.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $cut, $h)), (New-Object System.Drawing.Rectangle(($w - $cut), 0, $cut, $h)), [System.Drawing.GraphicsUnit]::Pixel)
$gR.Dispose()
$outR = Join-Path $dir ($base + "_r.png")
$bmpR.Save($outR, [System.Drawing.Imaging.ImageFormat]::Png)
$bmpR.Dispose()

$img.Dispose()
Write-Output "cropfg: $outL + $outR"
