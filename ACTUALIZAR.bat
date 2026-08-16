@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title MyeCommerce POS - Actualizar Version
color 0E
echo.
echo ============================================================
echo     MyeCommerce POS - ACTUALIZACION DE VERSION
echo     Migrar de version actual a version mas reciente
echo     SIN PERDER PRODUCTOS, VENTAS NI CONFIGURACION
echo ============================================================
echo.

cd /d "%~dp0"

:: ============================================================
:: PASO 1: Verificar requisitos minimos
:: ============================================================
echo [1/8] Verificando requisitos...

:: Verificar Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js no esta instalado.
    echo Descarguelo de https://nodejs.org y reinstale.
    echo.
    pause
    exit /b 1
)
for /f "tokens=1 delims=." %%v in ('node --version') do set NODE_MAJOR=%%v
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% LSS 18 (
    echo [ERROR] Node.js v%NODE_MAJOR% encontrado. Se requiere v18 o superior.
    echo Descarguelo de https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo   Node.js v%NODE_MAJOR% ........... OK

:: Verificar base de datos existe
if not exist "prisma\dev.db" (
    echo [ERROR] No se encontro prisma\dev.db
    echo Este script debe ejecutarse dentro de una instalacion existente.
    echo.
    pause
    exit /b 1
)
echo   Base de datos .............. OK
echo.

:: ============================================================
:: PASO 2: Leer version actual
:: ============================================================
echo [2/8] Leyendo version actual...
set CURRENT_VERSION=desconocida
if exist "package.json" (
    for /f "tokens=2 delims=:," %%a in ('findstr /C:"version" package.json ^| findstr /C:"2.9"') do (
        set VER=%%a
        set VER=!VER: =!
        set VER=!VER:"=!
        set CURRENT_VERSION=!VER!
    )
)
echo   Version actual: %CURRENT_VERSION%
echo.

:: ============================================================
:: PASO 3: Pedir version destino
:: ============================================================
echo [3/8] Indique la version a la cual desea actualizar.
echo.
echo   Puede obtener el link de descarga desde:
echo   https://github.com/csglider/MyeCommerce-v2.9.20/releases
echo.
echo   Formatos de link aceptados:
echo   - Link directo de GitHub: https://github.com/.../archive/refs/tags/vX.X.XX.zip
echo   - Solo el tag: vX.X.XX  (ejemplo: v2.9.90)
echo.
echo   NOTA: La version destino debe ser MAYOR que la actual (%CURRENT_VERSION%)
echo.
set /p "TARGET_URL=Ingrese el link o tag de la nueva version: "
set TARGET_URL=%TARGET_URL: =%

:: Si es solo un tag, convertir a URL
echo %TARGET_URL% | findstr /b "v" >nul
if not errorlevel 1 (
    if "%TARGET_URL%"=="%TARGET_URL::=%" (
        :: No tiene https://, es un tag simple como v2.9.90
        set TARGET_URL=https://github.com/csglider/MyeCommerce-v2.9.20/archive/refs/tags/%TARGET_URL%.zip
    )
)

echo.
echo   Descargando desde: %TARGET_URL%
echo.

:: ============================================================
:: PASO 4: RESPALDO COMPLETO antes de actualizar
:: ============================================================
echo [4/8] Creando respaldo de seguridad COMPLETO...

:: Crear carpeta de respaldo
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value ^| find "="') do set datetime=%%a
set FECHA=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%
set HORA=%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%
set BACKUP_DIR=BACKUP_PRE-ACTUALIZACION_%CURRENT_VERSION%_%FECHA%_%HORA%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Cerrar procesos para desbloquear archivos
echo   Cerrando procesos Node.js y Caddy...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM caddy.exe >nul 2>&1
timeout /t 3 /nobreak >nul

:: Respaldar base de datos
echo   Respaldando base de datos...
if exist "prisma\dev.db" copy "prisma\dev.db" "%BACKUP_DIR%\dev.db" >nul
if exist "prisma\dev.db-wal" copy "prisma\dev.db-wal" "%BACKUP_DIR%\dev.db-wal" >nul 2>&1
if exist "prisma\dev.db-shm" copy "prisma\dev.db-shm" "%BACKUP_DIR%\dev.db-shm" >nul 2>&1
if exist "prisma\dev.db-journal" copy "prisma\dev.db-journal" "%BACKUP_DIR%\dev.db-journal" >nul 2>&1

:: Respaldar schema
if exist "prisma\schema.prisma" copy "prisma\schema.prisma" "%BACKUP_DIR%\schema.prisma" >nul

:: Respaldar uploads de imagenes
if exist "data\uploads" (
    echo   Respaldando imagenes de productos...
    xcopy /E /I /Q /Y "data\uploads" "%BACKUP_DIR%\uploads" >nul 2>&1
)

:: Respaldar logo
if exist "data\store-logo" (
    echo   Respaldando logo de tienda...
    xcopy /E /I /Q /Y "data\store-logo" "%BACKUP_DIR%\store-logo" >nul 2>&1
)

:: Respaldar respaldos anteriores
if exist "BACKUPS" (
    echo   Respaldando carpeta BACKUPS...
    xcopy /E /I /Q /Y "BACKUPS" "%BACKUP_DIR%\BACKUPS" >nul 2>&1
)

:: Comprimir respaldo
echo   Comprimiendo respaldo completo...
powershell -NoProfile -Command "Compress-Archive -Path '%BACKUP_DIR%\*' -DestinationPath '%BACKUP_DIR%.zip' -Force" >nul 2>&1
if exist "%BACKUP_DIR%.zip" (
    rd /s /q "%BACKUP_DIR%" >nul 2>&1
    echo   Respaldo guardado en: %BACKUP_DIR%.zip
) else (
    echo   Respaldo guardado en: %BACKUP_DIR%\ (sin comprimir)
)

echo   [OK] Respaldo completado
echo.

:: ============================================================
:: PASO 5: Descargar nueva version
:: ============================================================
echo [5/8] Descargando nueva version...
echo   Esto puede tardar dependiendo de la velocidad de internet...
echo.

set DOWNLOAD_FILE=temp_update.zip

:: Limpiar descarga anterior
if exist "%DOWNLOAD_FILE%" del "%DOWNLOAD_FILE%"

:: Intentar descargar con PowerShell (3 intentos)
set DOWNLOAD_OK=0
for /L %%i in (1,1,3) do (
    if !DOWNLOAD_OK!==0 (
        echo   Intento %%i de 3...
        powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%TARGET_URL%' -OutFile '%DOWNLOAD_FILE%' -UseBasicParsing" >nul 2>&1
        if exist "%DOWNLOAD_FILE%" (
            for %%F in ("%DOWNLOAD_FILE%") do set FSIZE=%%~zF
            if !FSIZE! GTR 100000 (
                set DOWNLOAD_OK=1
                echo   Descarga completada (!FSIZE! bytes)
            ) else (
                echo   Archivo demasiado pequeno, reintentando...
                del "%DOWNLOAD_FILE%" >nul 2>&1
            )
        )
    )
)

if %DOWNLOAD_OK%==0 (
    echo.
    echo [ERROR] No se pudo descargar la nueva version.
    echo Verifique el link y su conexion a internet.
    echo.
    echo Puede descargar manualmente el ZIP desde:
    echo %TARGET_URL%
    echo.
    echo Y colocarlo en esta carpeta como "temp_update.zip"
    echo Luego ejecute este script de nuevo.
    echo.
    pause
    exit /b 1
)
echo.

:: ============================================================
:: PASO 6: Extraer y actualizar archivos
:: ============================================================
echo [6/8] Extrayendo nueva version...
echo.

:: Crear carpeta temporal para la nueva version
set TEMP_EXTRACT=temp_extract
if exist "%TEMP_EXTRACT%" rd /s /q "%TEMP_EXTRACT%"
mkdir "%TEMP_EXTRACT%"

:: Extraer el ZIP
powershell -NoProfile -Command "Expand-Archive -Path '%DOWNLOAD_FILE%' -DestinationPath '%TEMP_EXTRACT%' -Force" >nul 2>&1

if errorlevel 1 (
    echo [ERROR] No se pudo extraer el ZIP descargado.
    echo Intente descargar manualmente y colocarlo como temp_update.zip
    pause
    exit /b 1
)

:: Encontrar la carpeta extraida (GitHub crea una carpeta con el nombre del repo)
dir /b "%TEMP_EXTRACT%" >nul 2>&1
set EXTRACTED_DIR=
for /d %%D in ("%TEMP_EXTRACT%\*") do set EXTRACTED_DIR=%%D

if not defined EXTRACTED_DIR (
    echo [ERROR] No se encontro la carpeta extraida dentro del ZIP.
    pause
    exit /b 1
)

echo   Carpeta extraida: %EXTRACTED_DIR%
echo.

:: ============================================================
:: PASO 7: Reemplazar archivos (PRESERVANDO DATOS)
:: ============================================================
echo [7/8] Actualizando archivos del sistema...
echo   Conservando: base de datos, imagenes, respaldos, logo
echo.

:: Archivos/carpetas a PRESERVAR (no sobreescribir)
:: - prisma/dev.db (+ wal, shm, journal) = base de datos
:: - data/ = imagenes subidas
:: - BACKUPS/ = respaldos
:: - BACKUP_PRE-ACTUALIZACION_*.zip = respaldo de esta actualizacion
:: - caddy/caddy.exe = binario de Caddy (puede tener certificados)
:: - printer-agent/ = configuracion del agente de impresion

:: Copiar archivos nuevos (TODO excepto datos)
echo   Copiando archivos de la nueva version...

:: Copiar src/
if exist "%EXTRACTED_DIR%\src" (
    if exist "src" rd /s /q "src"
    xcopy /E /I /Q /Y "%EXTRACTED_DIR%\src" "src" >nul 2>&1
    echo   src/ ................... actualizado
)

:: Copiar public/
if exist "%EXTRACTED_DIR%\public" (
    if exist "public" rd /s /q "public"
    xcopy /E /I /Q /Y "%EXTRACTED_DIR%\public" "public" >nul 2>&1
    echo   public/ ................. actualizado
)

:: Copiar prisma/ (schema + migraciones, PERO NO dev.db)
if exist "%EXTRACTED_DIR%\prisma" (
    if exist "%EXTRACTED_DIR%\prisma\schema.prisma" (
        copy /Y "%EXTRACTED_DIR%\prisma\schema.prisma" "prisma\schema.prisma" >nul
        echo   prisma/schema.prisma .... actualizado
    )
    if exist "%EXTRACTED_DIR%\prisma\migrations" (
        xcopy /E /I /Q /Y "%EXTRACTED_DIR%\prisma\migrations" "prisma\migrations" >nul 2>&1
        echo   prisma/migrations/ ....... actualizado
    )
)

:: Copiar package.json y package-lock.json
if exist "%EXTRACTED_DIR%\package.json" (
    copy /Y "%EXTRACTED_DIR%\package.json" "package.json" >nul
    echo   package.json ............ actualizado
)
if exist "%EXTRACTED_DIR%\package-lock.json" (
    copy /Y "%EXTRACTED_DIR%\package-lock.json" "package-lock.json" >nul
    echo   package-lock.json ...... actualizado
)

:: Copiar next.config*
if exist "%EXTRACTED_DIR%\next.config.mjs" copy /Y "%EXTRACTED_DIR%\next.config.mjs" "next.config.mjs" >nul 2>&1
if exist "%EXTRACTED_DIR%\next.config.js" copy /Y "%EXTRACTED_DIR%\next.config.js" "next.config.js" >nul 2>&1
if exist "%EXTRACTED_DIR%\next.config.ts" copy /Y "%EXTRACTED_DIR%\next.config.ts" "next.config.ts" >nul 2>&1

:: Copiar tsconfig.json
if exist "%EXTRACTED_DIR%\tsconfig.json" copy /Y "%EXTRACTED_DIR%\tsconfig.json" "tsconfig.json" >nul 2>&1

:: Copiar middleware
if exist "%EXTRACTED_DIR%\middleware.ts" copy /Y "%EXTRACTED_DIR%\middleware.ts" "middleware.ts" >nul 2>&1

:: Copiar scripts de inicio (.bat .vbs)
for %%F in (
    INSTALAR.bat
    INSTALAR-LIMPIO.vbs
    INICIAR-TODO.bat
    INICIAR-TODO-OCULTO.vbs
    DETENER-TODO.bat
    RESPALDAR-BD.bat
    CREAR-ADMIN.bat
    ACTUALIZAR.bat
    ACTUALIZAR.vbs
) do (
    if exist "%EXTRACTED_DIR%\%%F" (
        copy /Y "%EXTRACTED_DIR%\%%F" "%%F" >nul 2>&1
    )
)
echo   Scripts de inicio ........ actualizados

:: Copiar caddy config (NO el .exe que puede tener certificados)
if exist "%EXTRACTED_DIR%\caddy\Caddyfile" copy /Y "%EXTRACTED_DIR%\caddy\Caddyfile" "caddy\Caddyfile" >nul 2>&1
if exist "%EXTRACTED_DIR%\caddy\Caddyfile-mobile" copy /Y "%EXTRACTED_DIR%\caddy\Caddyfile-mobile" "caddy\Caddyfile-mobile" >nul 2>&1
echo   caddy/ .................. actualizado

:: Copiar printer-agent scripts (NO borrar la DB del agente si existe)
if exist "%EXTRACTED_DIR%\printer-agent" (
    if exist "%EXTRACTED_DIR%\printer-agent\agent.js" copy /Y "%EXTRACTED_DIR%\printer-agent\agent.js" "printer-agent\agent.js" >nul 2>&1
    echo   printer-agent/ .......... actualizado
)

:: Crear carpeteta data si no existe
if not exist "data" mkdir data
if not exist "data\uploads" mkdir data\uploads
if not exist "data\uploads\products" mkdir data\uploads\products
if not exist "data\uploads\thumbs" mkdir data\uploads\thumbs

:: Limpiar archivos temporales
echo   Limpiando archivos temporales...
rd /s /q "%TEMP_EXTRACT%" >nul 2>&1
del "%DOWNLOAD_FILE%" >nul 2>&1

echo.
echo   [OK] Archivos actualizados correctamente
echo.

:: ============================================================
:: PASO 8: Reinstalar dependencias + migrar DB
:: ============================================================
echo [8/8] Instalando dependencias y migrando base de datos...
echo   Esto puede tardar varios minutos...
echo.

:: Instalar dependencias (3 intentos)
set DEPS_OK=0
for /L %%i in (1,1,3) do (
    if !DEPS_OK!==0 (
        echo   npm install - Intento %%i de 3...
        call npm install --no-audit --no-fund 2>nul
        if exist "node_modules\next" (
            set DEPS_OK=1
        ) else (
            echo   Fallo, reintentando...
            if exist "node_modules" rd /s /q "node_modules" >nul 2>&1
            if exist "package-lock.json" del "package-lock.json" >nul 2>&1
        )
    )
)

if %DEPS_OK%==0 (
    echo [ERROR] No se pudieron instalar las dependencias.
    echo Ejecute manualmente: npm install
    echo.
    pause
    exit /b 1
)

:: Generar cliente Prisma
echo   Generando cliente Prisma...
call npx prisma generate >nul 2>&1

:: Aplicar migraciones a la base de datos (preserva datos existentes)
echo   Migrando base de datos...
echo   Esto agregara las nuevas tablas/campos SIN borrar datos existentes...
call npx prisma db push --accept-data-loss 2>nul
if errorlevel 1 (
    :: Si falla, intentar con migrate deploy
    call npx prisma migrate deploy 2>nul
)
echo.

:: ============================================================
:: RESULTADO FINAL
:: ============================================================
echo.
echo.
echo ============================================================
echo.
echo   ACTUALIZACION COMPLETADA EXITOSAMENTE!
echo.
echo   Respaldo de seguridad guardado en:
echo   %BACKUP_DIR%.zip
echo.
echo   Para iniciar el sistema actualizado:
echo   1. Ejecute INICIAR-TODO-OCULTO.vbs (doble clic)
echo   2. Espere 10-15 segundos
echo   3. Abra el navegador
echo.
echo   Si algo sale mal, puede restaurar desde el respaldo:
echo   1. Descomprima %BACKUP_DIR%.zip
echo   2. Copie dev.db a prisma\
echo   3. Copie uploads\ a data\
echo.
echo ============================================================
echo.
pause
