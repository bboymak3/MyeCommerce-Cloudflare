@echo off
title MyeCommerce POS - Detener Todo
echo.
echo ============================================================
echo     MyeCommerce POS - Deteniendo todos los servicios
echo ============================================================
echo.
echo [1/3] Deteniendo Node.js (Next.js + Printer-Agent)...
taskkill /F /IM node.exe >nul 2>&1
echo     OK
echo.
echo [2/3] Deteniendo Caddy...
taskkill /F /IM caddy.exe >nul 2>&1
echo     OK
echo.
echo [3/3] Listo...
timeout /t 1 /nobreak >nul
echo.
echo ============================================================
echo     Todos los servicios detenidos.
echo ============================================================
echo.
pause