@echo off
REM Remove the 9router CORS proxy scheduled task.
setlocal
set "TASK=9routerCorsProxy"

schtasks /End /TN "%TASK%" >nul 2>&1
schtasks /Delete /TN "%TASK%" /F
if errorlevel 1 (
  echo Task "%TASK%" not found or could not be removed.
  exit /b 1
)
echo Removed scheduled task "%TASK%". Running proxy process ^(if any^) keeps running until reboot or manual kill.
endlocal
