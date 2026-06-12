# 上游生图偶发返回 JPEG 字节（扩展名仍 .png）——用 .NET 自带解码转成真 PNG
# 用法：powershell -ExecutionPolicy Bypass -File scripts/jpg2png.ps1 -Path <文件>
param([string]$Path)
Add-Type -AssemblyName System.Drawing
$tmp = "$Path.tmp.png"
$img = [System.Drawing.Image]::FromFile($Path)
$img.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
Move-Item -Force $tmp $Path
Write-Output "jpg2png: $Path"
