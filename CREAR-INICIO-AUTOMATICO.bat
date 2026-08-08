@echo off
chcp 65001 >nul 2>&1
title Crear Inicio Automatico - MyeCommerce POS
echo ============================================================
echo    Configurar Inicio Automatico con Windows
echo ============================================================
echo.

cd /d "%~dp0"

:: Primero eliminar inicio automatico anterior si existe
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MyeCommercePOS" >nul 2>&1
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyeCommerce-Startup.vbs" >nul 2>&1

:: Crear nuevo script VBS con la ruta dinamica del proyecto
echo Set WshShell = CreateObject("WScript.Shell") > "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyeCommerce-Startup.vbs"
echo WshShell.Run """%~dp0INICIAR-MYECCOMMERCE-OCULTO.vbs""", 0, False >> "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyeCommerce-Startup.vbs"

echo [OK] Inicio automatico configurado.
echo.
echo MyeCommerce POS se iniciara automaticamente
echo cada vez que encienda la computadora.
echo.
echo Para desactivar, ejecute: ELIMINAR-INICIO-AUTOMATICO.bat
echo.
pause
