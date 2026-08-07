@echo off
title MyeCommerce POS v2.9.16 - Generador de Licencias
color 0B
echo.
echo ============================================================
echo          MyeCommerce POS v2.9.16
echo          Generador de Licencias
echo ============================================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Descarguelo de https://nodejs.org
    echo.
    pause
    exit /b 1
)

if not exist "generar-licencia.js" (
    echo [ERROR] No se encontro generar-licencia.js
    echo Este archivo .bat debe estar en la carpeta del proyecto.
    echo.
    pause
    exit /b 1
)

echo [INFO] Generador de licencias listo.
echo.
node generar-licencia.js
echo.
pause
