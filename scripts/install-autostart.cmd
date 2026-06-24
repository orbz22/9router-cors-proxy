@echo off
REM Register the 9router CORS proxy to start hidden at every user logon.
REM Run by double-click or from a normal (non-admin) command prompt.
setlocal
set "TASK=9routerCorsProxy"
set "VBS=%~dp0run-hidden.vbs"

schtasks /Create /TN "%TASK%" /TR "wscript.exe \"%VBS%\"" /SC ONLOGON /F
if errorlevel 1 (
  echo Failed to create scheduled task.
  exit /b 1
)

schtasks /Run /TN "%TASK%" >nul 2>&1
echo Installed scheduled task "%TASK%" (starts hidden at logon) and launched it now.
echo Verify: curl http://127.0.0.1:20129/__proxy_health
endlocal
