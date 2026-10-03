$ErrorActionPreference = 'Stop'
$iconFolder = Join-Path $env:LOCALAPPDATA 'LeafArchive'
New-Item -ItemType Directory -Force -Path $iconFolder | Out-Null
$iconPath = Join-Path $iconFolder 'plant.ico'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'plant.ico') -Destination $iconPath -Force
$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath '植藏.url'
$content = "[InternetShortcut]`r`nURL=https://leaf-archive-oct03.giving-rook-4847.chatgpt.site/`r`nIconFile=$iconPath`r`nIconIndex=0`r`n"
[IO.File]::WriteAllText($shortcutPath, $content, [Text.Encoding]::Unicode)
Write-Host '植藏快捷方式已创建在桌面。打开后使用原来的账号登录。'
