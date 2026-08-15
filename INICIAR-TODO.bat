@echo off
setlocal enabledelayedexpansion
title MyeCommerce POS v2.9.49 - Iniciar Todo
color 0A
echo.
echo ============================================================
echo     MyeCommerce POS v2.9.49 - Iniciando todos los servicios
echo ============================================================
echo.
cd /d "%~dp0"

:: Verificar Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descarguelo de https://nodejs.org (version 20 LTS)
    pause
    exit /b 1
)

:: Matar procesos anteriores
echo [1/5] Cerrando procesos anteriores...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM caddy.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo     OK
echo.

:: Detectar IP local para movil
echo [2/5] Detectando IP local...
powershell -NoProfile -Command "$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object -First 1 -ExpandProperty IPAddress); if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { -not $_.Loopback -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress) }; Write-Output $ip" > "%~dp0caddy\local-ip.txt" 2>nul
for /f "tokens=*" %%i in (%~dp0caddy\local-ip.txt) do echo     IP local: %%i
echo.

:: Iniciar Printer-Agent
echo [3/5] Iniciando Agente de Impresion...
start "Printer-Agent" /min cmd /c "cd /d %~dp0printer-agent && node agent.js > agent-startup.log 2>&1"
echo     OK - Puerto 9100
echo.

:: Abrir puerto 8443 en firewall
echo [3b/5] Abriendo puerto 8443 en firewall para acceso movil...
netsh advfirewall firewall delete rule name="MyeCommerce POS Mobile 8443" >nul 2>&1
netsh advfirewall firewall add rule name="MyeCommerce POS Mobile 8443" dir=in action=allow protocol=TCP localport=8443 profile=private,public description="MyeCommerce POS - Acceso movil HTTPS para camara del telefono" >nul 2>&1
echo     OK
echo.

:: Iniciar Caddy Dominio (HTTPS myecommerce.ve)
echo [4/5] Iniciando Caddy (HTTPS dominio local)...
if exist "caddy\caddy.exe" (
    start "Caddy-Domain" /min cmd /c "cd /d %~dp0caddy && caddy.exe run --config Caddyfile > caddy-domain.log 2>&1"
    echo     OK - Dominio: https://myecommerce.ve (puerto 443)
) else (
    echo     OMITIDO - caddy.exe no encontrado
    echo     Ejecute INSTALAR-LIMPIO.vbs para instalarlo
)
echo.

:: Iniciar Caddy Movil (HTTPS :8443) - PROCESO INDEPENDIENTE
echo [4b/5] Iniciando Caddy Movil (HTTPS :8443 para telefono)...
if exist "caddy\caddy.exe" (
    if exist "caddy\Caddyfile-mobile" (
        start "Caddy-Mobile" /min cmd /c "cd /d %~dp0caddy && caddy.exe run --config Caddyfile-mobile --data-dir mobile-data > caddy-mobile.log 2>&1"
        echo     OK - Movil: https://IP_LOCAL:8443 (puerto 8443)
    ) else (
        echo     OMITIDO - Caddyfile-mobile no encontrado
    )
) else (
    echo     OMITIDO - caddy.exe no encontrado
)
echo.

:: Iniciar Next.js
echo [5/5] Iniciando Next.js...
call npx prisma generate >nul 2>&1
if not exist "prisma\dev.db" (
    call npx prisma db push --skip-generate >nul 2>&1
)

echo.
timeout /t 2 /nobreak >nul

:: Compilar si no existe build
if not exist ".next\server" (
    echo     Compilando para produccion (primera vez, espera 1-2 min)...
    call npx next build
    if %ERRORLEVEL% NEQ 0 (
        echo     [WARN] Build fallo, iniciando en modo desarrollo...
        call npx next dev -p 3000
        goto :fin
    )
)

echo.
echo     Abriendo navegador...
if exist "caddy\caddy.exe" (
    start https://myecommerce.ve
) else (
    start http://localhost:3000
)
call npx next start -p 3000

:fin
echo.
echo El servidor se detuvo. Cerrando servicios...
taskkill /F /IM caddy.exe >nul 2>&1
pause
