$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path -LiteralPath '.env')) { throw '请先运行 ./scripts/setup.ps1 -DatabaseOnly。' }
if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) { py -3.12 -m venv .venv }
& .venv/Scripts/python.exe -m pip install --require-hashes -r backend/requirements-dev.lock.txt
if ($LASTEXITCODE -ne 0) { throw '依赖安装失败' }
Push-Location backend
& ../.venv/Scripts/python.exe -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw '数据库迁移失败' }
& ../.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
Pop-Location
