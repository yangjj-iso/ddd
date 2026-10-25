@echo off
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1" -SkipBuild
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8000"
