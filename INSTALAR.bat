@echo off
chcp 65001 >nul 2>&1
title MyeCommerce POS v2.9.57 - Instalacion Limpia desde 0
color 0A
echo ============================================================
echo          MyeCommerce POS v2.9.57 - Instalador LIMPIO
echo          Sistema Punto de Venta Venezuela
echo          Doble Moneda USD / Bs con tasa BCV
echo          Impresion Termica ESC/POS (agente v3.1)
echo          Acceso movil HTTPS :8443
echo ============================================================
echo.
echo  ESTE INSTALADOR BORRARA TODA INSTALACION ANTERIOR
echo  incluyendo base de datos, configuracion y licencia.
echo.
pause
echo.

:: Usar el directorio donde esta este .bat (no depende de ruta fija)
cd /d "%~dp0"

:: ============================================================
:: PASO 0: CERRAR PROCESOS ANTERIORES
:: ============================================================
echo [PREPARACION] Cerrando procesos Node.js anteriores...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM caddy.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo [OK] Procesos cerrados
echo.

:: ============================================================
:: PASO 1: LIMPIEZA TOTAL DE RASTROS
:: ============================================================
echo [PASO 1/6] LIMPIEZA TOTAL de instalacion anterior...

:: Archivos y carpetas del proyecto
if exist node_modules rd /s /q node_modules
if exist .next rd /s /q .next
if exist package-lock.json del package-lock.json
if exist .prisma rd /s /q .prisma
if exist .env del .env

:: Base de datos y archivos WAL (todos los posibles)
if exist prisma\dev.db del prisma\dev.db
if exist prisma\dev.db-journal del prisma\dev.db-journal
if exist prisma\dev.db-wal del prisma\dev.db-wal
if exist prisma\dev.db-shm del prisma\dev.db-shm

:: Carpeta de respaldos anteriores
if exist respaldos rd /s /q respaldos

:: Caddy data movil
if exist caddy\mobile-data rd /s /q caddy\mobile-data

:: Spool del agente de impresion
if exist printer-agent\spool rd /s /q printer-agent\spool

echo [OK] Archivos del proyecto limpiados
echo.

:: Eliminar claves del registro de inicio automatico
echo [INFO] Eliminando rastros del registro...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MyeCommercePOS" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MyeCommerceHidden" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MyeCommerceAgente" /f >nul 2>&1
echo [OK] Registro limpiado
echo.

:: Eliminar acceso directo anterior del escritorio
echo [INFO] Eliminando acceso directo anterior...
if exist "%USERPROFILE%\Desktop\MyeCommerce POS.lnk" del "%USERPROFILE%\Desktop\MyeCommerce POS.lnk"
if exist "%USERPROFILE%\Desktop\MyeCommerce.lnk" del "%USERPROFILE%\Desktop\MyeCommerce.lnk"
echo [OK] Escritorio limpiado
echo.

:: ============================================================
:: PASO 2: VERIFICAR Node.js
:: ============================================================
echo [PASO 2/6] Verificando Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    echo.
    echo Descarguelo de https://nodejs.org y reinicie este instalador.
    echo Version recomendada: Node.js 20 LTS o superior.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODEVER=%%i
echo [OK] Node.js detectado: %NODEVER%

:: Verificar version minima (v18+)
set MAJOR=0
for /f "tokens=1 delims=v." %%a in ("%NODEVER%") do set MAJOR=%%a
if %MAJOR% LSS 18 (
    echo [ERROR] Node.js %NODEVER% es demasiado antiguo.
    echo Se requiere Node.js 18+ (recomendado: 20 LTS).
    echo Descargue de https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo [OK] Version %NODEVER% es compatible
echo.

:: Verificar conexion a internet (ping rapido)
echo [INFO] Verificando conexion a internet...
ping -n 1 -w 3000 registry.npmjs.org >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] No se pudo conectar a registry.npmjs.org
    echo La instalacion puede fallar sin conexion a internet.
    echo.
    echo Presione ENTER para continuar de todas formas o Ctrl+C para cancelar...
    pause >nul
) else (
    echo [OK] Conexion a internet verificada
)
echo.

:: ============================================================
:: PASO 3: VERIFICAR ESTRUCTURA DEL PROYECTO
:: ============================================================
echo [PASO 3/6] Verificando estructura del proyecto...
if not exist "package.json" (
    echo [ERROR] No se encontro package.json
    echo Directorio actual: %~dp0
    echo Asegurese de que descomprimio todos los archivos del ZIP.
    echo.
    pause
    exit /b 1
)
if not exist "prisma\schema.prisma" (
    echo [ERROR] No se encontro prisma\schema.prisma
    echo Asegurese de que descomprimio todos los archivos del ZIP.
    echo.
    pause
    exit /b 1
)
echo [OK] Estructura del proyecto verificada
echo.

:: ============================================================
:: PASO 4: INSTALAR DEPENDENCIAS (3 intentos)
:: ============================================================
echo [PASO 4/6] Instalando dependencias npm...
echo [INFO] Esto puede tardar unos minutos, por favor espere...
echo.

:: Intento 1
echo [INFO] Intento 1 de 3: npm install --legacy-peer-deps --ignore-scripts...
call npm install --legacy-peer-deps --ignore-scripts
if %ERRORLEVEL% EQU 0 goto DEPS_OK

echo.
echo [WARN] Intento 1 fallo. Limpiando cache e intentando de nuevo...
call npm cache clean --force >nul 2>&1
if exist node_modules rd /s /q node_modules
if exist package-lock.json del package-lock.json

:: Intento 2
echo [INFO] Intento 2 de 3: npm install --legacy-peer-deps...
call npm install --legacy-peer-deps
if %ERRORLEVEL% EQU 0 goto DEPS_OK

echo.
echo [WARN] Intento 2 fallo. Intentando con --force...
if exist node_modules rd /s /q node_modules
if exist package-lock.json del package-lock.json

:: Intento 3
echo [INFO] Intento 3 de 3: npm install --force...
call npm install --force
if %ERRORLEVEL% EQU 0 goto DEPS_OK

echo.
echo [ERROR] Los 3 intentos de npm install fallaron.
echo.
echo Posibles soluciones:
echo   1. Ejecute manualmente en esta carpeta:
echo      npm cache clean --force
echo      rmdir /s /q node_modules
echo      del package-lock.json
echo      npm install --legacy-peer-deps --ignore-scripts
echo.
echo   2. Actualice Node.js a la version 20 LTS desde nodejs.org
echo.
echo   3. Verifique que tiene conexion a internet estable.
echo   4. Descomprima el ZIP en otra carpeta (no en Downloads).
echo.
pause
exit /b 1

:DEPS_OK
echo.
echo [OK] Dependencias instaladas correctamente
echo.

:: ============================================================
:: PASO 5: GENERAR PRISMA + BASE DE DATOS
:: ============================================================
echo [PASO 5/6] Generando cliente Prisma y base de datos...
echo.

echo [INFO] Generando cliente Prisma...
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Fallo la generacion de Prisma, reintentando...
    call npx prisma generate
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Fallo la generacion de Prisma.
        echo.
        pause
        exit /b 1
    )
)
echo [OK] Cliente Prisma generado
echo.

echo [INFO] Creando base de datos SQLite...
call npx prisma db push
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Fallo la creacion de la base de datos, reintentando...
    call npx prisma db push
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Fallo la creacion de la base de datos.
        echo.
        pause
        exit /b 1
    )
)
echo [OK] Base de datos creada correctamente
echo.

:: ============================================================
:: PASO 6: CREAR ACCESO DIRECTO + RESPALDOS
:: ============================================================
echo [PASO 6/6] Creando acceso directo y carpetas...

:: Crear carpeta de respaldos
if not exist respaldos mkdir respaldos

:: Crear acceso directo en el escritorio
echo Set WshShell = WScript.CreateObject("WScript.Shell") > "%TEMP%\crea_acc.vbs"
echo strDesktop = WshShell.SpecialFolders("Desktop") >> "%TEMP%\crea_acc.vbs"
echo Set oShellLink = WshShell.CreateShortcut(strDesktop ^& "\MyeCommerce POS.lnk") >> "%TEMP%\crea_acc.vbs"
echo oShellLink.TargetPath = "%~dp0INICIAR-MYECCOMMERCE.bat" >> "%TEMP%\crea_acc.vbs"
echo oShellLink.WorkingDirectory = "%~dp0" >> "%TEMP%\crea_acc.vbs"
echo oShellLink.Description = "MyeCommerce POS v2.9.57" >> "%TEMP%\crea_acc.vbs"
echo oShellLink.IconLocation = "shell32.dll,14" >> "%TEMP%\crea_acc.vbs"
echo oShellLink.Save >> "%TEMP%\crea_acc.vbs"
cscript //nologo "%TEMP%\crea_acc.vbs"
del "%TEMP%\crea_acc.vbs" >nul 2>&1
echo [OK] Acceso directo creado en el Escritorio
echo.

:: ============================================================
:: INSTALACION COMPLETADA
:: ============================================================
echo ============================================================
echo.
echo    INSTALACION LIMPIA COMPLETADA EXITOSAMENTE!
echo.
echo    Para iniciar el sistema haga doble clic en:
echo    - El acceso directo del Escritorio "MyeCommerce POS"
echo    - O ejecute: INICIAR-TODO.bat
echo.
echo    El sistema abrira automaticamente en su navegador:
echo    http://localhost:3000
echo.
echo    USUARIO POR DEFECTO: admin / admin
echo    (Se crea automaticamente al primer inicio de sesion)
echo.
echo    v2.9.57 - Impresion desde movil corregida
echo    - Gran Mayor (GM) con precios por tasa
echo    - Temas Dark/Profesional
echo    - HTTP movil en puerto 8443
echo    - Nombres completos en inventario
echo.
echo ============================================================
echo.
pause
