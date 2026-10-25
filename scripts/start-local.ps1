param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location $taskRoot
if (-not (Test-Path -LiteralPath '.env')) { throw '请先运行 ./scripts/setup.ps1 -ConfigureOnly 并配置 MySQL。' }
$taskPython = Join-Path $taskRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { throw '请先按 README 创建 Python 虚拟环境并安装依赖。' }
$taskDbPort = Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue
if (-not $taskDbPort -and (Test-Path -LiteralPath '.runtime/my.ini')) {
    $taskMySQL = Get-ChildItem -LiteralPath '.runtime' -Directory -Filter 'mysql-*-winx64' | Select-Object -First 1
    if ($taskMySQL) {
        # MySQL on Windows needs an ASCII short path when the workspace contains Chinese.
        $taskPortableBase = ((Get-Content -LiteralPath '.runtime/my.ini' | Where-Object { $_.StartsWith('basedir=') }) -replace '^basedir=', '')
        $taskDefaults = '--defaults-file="' + ((Split-Path $taskPortableBase -Parent) + '/my.ini') + '"'
        $taskMySQLProcess = Start-Process -FilePath ($taskPortableBase + '/bin/mysqld.exe') -ArgumentList $taskDefaults -WindowStyle Hidden -PassThru
        $taskMySQLProcess.Id | Set-Content -LiteralPath '.runtime/mysql.pid'
    }
}
if (-not $SkipBuild) {
    Push-Location frontend
    if (-not (Test-Path -LiteralPath 'node_modules')) { npm ci; if ($LASTEXITCODE -ne 0) { throw '依赖安装失败' } }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw '前端构建失败' }
    Pop-Location
    New-Item -ItemType Directory -Path 'backend/static' -Force | Out-Null
    Copy-Item -Path 'frontend/dist/*' -Destination 'backend/static' -Recurse -Force
}
Push-Location backend
& $taskPython -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw '数据库迁移失败，请确认 DATABASE_URL 和 MySQL 服务。' }
Pop-Location
if (-not (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)) {
    New-Item -ItemType Directory -Path '.runtime' -Force | Out-Null
    $taskAppProcess = Start-Process -FilePath $taskPython -ArgumentList '-m uvicorn app.main:app --host 127.0.0.1 --port 8000' -WorkingDirectory (Join-Path $taskRoot 'backend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRoot '.runtime/app.log') -RedirectStandardError (Join-Path $taskRoot '.runtime/app-error.log') -PassThru
    $taskAppProcess.Id | Set-Content -LiteralPath '.runtime/app.pid'
}
$taskReady = $false
for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
    try {
        $taskHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2
        if ($taskHealth.service -ne 'partsbox') { throw '端口 8000 被其他服务占用' }
        if ($taskHealth.status -eq 'ok') { $taskReady = $true; break }
    } catch {
        Start-Sleep -Milliseconds 500
    }
}
if (-not $taskReady) { throw '工作台未能启动，请检查 .runtime/app-error.log 和数据库连接。' }
Write-Host 'PartsBox 已启动：http://127.0.0.1:8000'
Write-Host '登录账号与密码请查看 .env 文件。'
