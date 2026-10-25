param([switch]$Demo, [switch]$DatabaseOnly, [switch]$ConfigureOnly)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path -LiteralPath '.env')) {
    function New-RandomSecret([int]$Length = 32) {
        $bytes = [byte[]]::new($Length)
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes)
        $rng.Dispose()
        return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    }
    $dbPassword = New-RandomSecret
    $rootPassword = New-RandomSecret
    $sessionSecret = New-RandomSecret
    $adminPassword = New-RandomSecret 10
    $content = @"
MYSQL_DATABASE=partsbox
MYSQL_USER=partsbox
MYSQL_PASSWORD=$dbPassword
MYSQL_ROOT_PASSWORD=$rootPassword
DATABASE_URL=mysql+pymysql://partsbox:${dbPassword}@127.0.0.1:3307/partsbox?charset=utf8mb4
SECRET_KEY=$sessionSecret
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$adminPassword
APP_PORT=8000
"@
    [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $content, [Text.UTF8Encoding]::new($false))
    Write-Host '随机凭据已保存在本机 .env 文件中，请妥善保管。'
}
if ($ConfigureOnly) { return }
if ($DatabaseOnly) {
    docker compose up -d --wait mysql
} else {
    docker compose up -d --build --wait
    if ($LASTEXITCODE -ne 0) { throw 'Docker 启动失败，请查看 docker compose logs。' }
    if ($Demo) { docker compose exec app python -m app.seed }
    Write-Host 'PartsBox: http://localhost:8000'
    Write-Host '登录账号和密码请查看 .env 的 ADMIN_USERNAME 与 ADMIN_PASSWORD。'
}
if ($LASTEXITCODE -ne 0) { throw '启动失败，请确认 Docker Desktop 正在运行。' }
