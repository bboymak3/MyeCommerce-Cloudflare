@echo off
chcp 65001 >nul 2>&1
title MyeCommerce POS v2.7.7 - Instalacion Limpia desde 0
color 0A
echo ============================================================
echo          MyeCommerce POS v2.7.7 - Instalador LIMPIO
echo          Sistema Punto de Venta Venezuela
echo          Doble Moneda USD / Bs con tasa BCV
echo          Modulo de Clientes + Scanner QR/Barras
echo          Modos de pago con referencia + Pago Mixto
echo          Modulo de Credito, Proveedores, Compras
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

echo [OK] Archivos del proyecto limpiados
echo.

:: Eliminar claves del registro de inicio automatico
echo [INFO] Eliminando rastros del registro...
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MyeCommercePOS" /f >nul 2>&1
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MyeCommerceHidden" /f >nul 2>&1
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
    echo Version recomendada: Node.js 20 LTS o superior
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODEVER=%%i
echo [OK] Node.js detectado: %NODEVER%
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
:: PASO 4: INSTALAR DEPENDENCIAS
:: ============================================================
echo [PASO 4/6] Instalando dependencias npm...
echo [INFO] Esto puede tardar unos minutos, por favor espere...
echo.
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Fallo la instalacion de dependencias.
    echo Intente ejecutar manualmente: npm install --legacy-peer-deps
    echo.
    pause
    exit /b 1
)
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
    echo [ERROR] Fallo la generacion de Prisma.
    echo.
    pause
    exit /b 1
)
echo [OK] Cliente Prisma generado
echo.

echo [INFO] Creando base de datos SQLite...
call npx prisma db push
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo la creacion de la base de datos.
    echo.
    pause
    exit /b 1
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
echo oShellLink.Description = "MyeCommerce POS v2.7.7" >> "%TEMP%\crea_acc.vbs"
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
echo    - O ejecute: INICIAR-MYECCOMMERCE.bat
echo.
echo    El sistema abrira automaticamente en su navegador:
echo    http://localhost:3000
echo.
echo    USUARIO POR DEFECTO: admin / admin
echo    (Se crea automaticamente al primer inicio de sesion)
echo    NO PIERDE ningun dato existente.
echo.
echo    NOVEDADES v2.7.7:
echo    - Efectivo (Bs) y Efectivo ($) como metodos separados
echo    - Modulo de Credito con abonos y metodos de pago completos
echo    - Cuentas por Cobrar con historial de pagos
echo    - Proveedores y Compras con auto-actualizacion stock/costo
echo    - Informes con credito correctamente etiquetado
echo.
echo ============================================================
echo.
pause
