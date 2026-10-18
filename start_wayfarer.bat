@echo off
setlocal
cd /d "%~dp0"
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0wayfarer_server.ps1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8000/index.html"
exit /b 0
