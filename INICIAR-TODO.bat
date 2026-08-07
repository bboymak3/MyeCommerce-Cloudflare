@echo off
setlocal enabledelayedexpansion
title MyeCommerce POS v2.9.16 - Iniciar Todo
color 0A
echo.
echo ============================================================
echo     MyeCommerce POS v2.9.16 - Iniciando todos los servicios
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
echo [1/4] Cerrando procesos anteriores...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM caddy.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo     OK
echo.

:: Iniciar Printer-Agent
:: NOTA: agent.js NO necesita node_modules (usa modulos built-in de Node)
echo [2/4] Iniciando Agente de Impresion...
start "Printer-Agent" /min cmd /c "cd /d %~dp0printer-agent && node agent.js > agent-startup.log 2>&1"
echo     OK - Puerto 9100
echo.

:: Iniciar Caddy (HTTPS)
echo [3/4] Iniciando Caddy (HTTPS dominio local)...
if exist "caddy\caddy.exe" (
    start "Caddy Proxy" /min cmd /c "cd /d %~dp0caddy && caddy.exe run --config Caddyfile"
    echo     OK - https://myecommerce.ve
) else (
    echo     OMITIDO - caddy.exe no encontrado
    echo     Ejecute INSTALAR-LIMPIO.vbs para instalarlo
)
echo.

:: Iniciar Next.js
echo [4/4] Iniciando Next.js...
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
