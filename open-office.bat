@echo off
REM Buka Nexus Hermes Office (VPS) lewat SSH tunnel.
setlocal
set KEY=%USERPROFILE%\.ssh\id_ed25519_vps
set HOST=root@103.253.245.50
set PORT=21045
set URL=http://127.0.0.1:8765

curl -s -m 3 -o NUL %URL%/api/session
if errorlevel 1 (
  echo [1/2] Membuka tunnel SSH ke VPS...
  start "nexus-tunnel" /min ssh -i "%KEY%" -p %PORT% -N -L 8765:127.0.0.1:8765 -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes %HOST%
  timeout /t 5 /nobreak >NUL
) else (
  echo [1/2] Tunnel sudah aktif.
)
echo [2/2] Membuka %URL%
start "" %URL%
endlocal
