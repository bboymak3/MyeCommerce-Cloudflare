@echo off
chcp 65001 >nul 2>&1
title MyeCommerce POS v2.7.7
echo.
echo ============================================================
echo          MyeCommerce POS v2.7.7
echo          Iniciando servidor...
echo ============================================================
echo.

cd /d "%~dp0"

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    echo Ejecute INSTALAR.bat primero.
    echo.
    pause
    exit /b 1
)

if not exist "package.json" (
    echo [ERROR] No se encontro package.json
    echo Ejecute INSTALAR.bat primero.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\next" (
    echo [ERROR] Dependencias no instaladas.
    echo Ejecute INSTALAR.bat primero.
    echo.
    pause
    exit /b 1
)

echo [INFO] Sincronizando base de datos con el esquema...
call npx prisma db push --skip-generate >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Error al sincronizar BD. Reintentando...
    call npx prisma db push --skip-generate
)

echo Regenerando cliente Prisma...
call npx prisma generate >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Error al regenerar Prisma client. Reintentando...
    call npx prisma generate
)

echo Cerrando instancia anterior...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Listo.
echo.

echo ============================================================
echo   Abriendo navegador en: http://localhost:3000
echo   NO cierre esta ventana mientras use el sistema.
echo ============================================================
echo.

timeout /t 2 /nobreak >nul
start http://localhost:3000
call npx next dev -p 3000
echo.
echo El servidor se ha detenido.
pause
