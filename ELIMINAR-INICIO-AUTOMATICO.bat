@echo off
chcp 65001 >nul 2>&1
title Eliminar Inicio Automatico - MyeCommerce POS
echo ============================================================
echo    Eliminar Inicio Automatico con Windows
echo ============================================================
echo.

reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "MyeCommercePOS" >nul 2>&1
del /f /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MyeCommerce-Startup.vbs" >nul 2>&1

echo [OK] Inicio automatico eliminado.
echo.
pause
