@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*wayfarer_server.ps1*' } | Invoke-CimMethod -MethodName Terminate | Out-Null"
echo Wayfarer server stopped.
pause
