@echo off
setlocal enabledelayedexpansion
title MyeCommerce POS - Respaldar Base de Datos
color 0B
echo ============================================================
echo     MyeCommerce POS - RESPALDO DE BASE DE DATOS
echo ============================================================
echo.

cd /d "%~dp0"

:: Verificar que la base de datos existe
if not exist "prisma\dev.db" (
    echo [ERROR] No se encontro la base de datos.
    echo Asegurese de que el sistema esta instalado correctamente.
    echo.
    pause
    exit /b 1
)

:: Crear carpeta de respaldos si no existe
if not exist "respaldos" mkdir respaldos

:: Generar nombre con fecha y hora
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value ^| find "="') do set datetime=%%a
set FECHA=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%
set HORA=%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%
set ARCHIVO=respaldos\MyeCommerce-RESPALDO-%FECHA%_%HORA%.zip

echo [INFO] Creando respaldo de la base de datos...
echo.

:: Cerrar procesos Node para evitar bloqueo de SQLite
echo [INFO] Cerrando procesos Node.js para desbloquear SQLite...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Crear carpeta temporal para el respaldo
set TEMP_DIR=respaldos\temp_backup_%FECHA%_%HORA%
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

:: Copiar archivos de la base de datos SQLite
echo [INFO] Copiando base de datos SQLite...
copy "prisma\dev.db" "%TEMP_DIR%\dev.db" >nul
if exist "prisma\dev.db-wal" copy "prisma\dev.db-wal" "%TEMP_DIR%\dev.db-wal" >nul
if exist "prisma\dev.db-shm" copy "prisma\dev.db-shm" "%TEMP_DIR%\dev.db-shm" >nul
if exist "prisma\dev.db-journal" copy "prisma\dev.db-journal" "%TEMP_DIR%\dev.db-journal" >nul

:: Copiar schema
copy "prisma\schema.prisma" "%TEMP_DIR%\schema.prisma" >nul

echo [INFO] Datos respaldados:
echo    - Base de datos SQLite completa
echo    - Productos, Categorias, Clientes
echo    - Usuarios y Roles
echo    - Ventas, Devoluciones, Cierres de Caja
echo    - Configuracion y Licencia
echo.

:: Intentar comprimir con PowerShell
echo [INFO] Comprimiendo respaldo...
powershell -NoProfile -Command "Compress-Archive -Path '%TEMP_DIR%\*' -DestinationPath '%ARCHIVO%' -Force" >nul 2>&1

if exist "%ARCHIVO%" (
    echo.
    echo ============================================================
echo   RESPALDO CREADO EXITOSAMENTE!
echo.
echo   Archivo: %ARCHIVO%
echo.
echo   Para restaurar en otro equipo:
echo   1. Descomprima el ZIP
    echo   2. Copie dev.db a la carpeta prisma\
echo   3. Inicie el sistema
    echo ============================================================
echo.
    
    :: Limpiar temporal
    rd /s /q "%TEMP_DIR%" >nul 2>&1
) else (
    echo [INFO] No se pudo comprimir. Respaldo en: %TEMP_DIR%
)

echo.
pause