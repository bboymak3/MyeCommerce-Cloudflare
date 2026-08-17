' ============================================================
' MyeCommerce POS - ACTUALIZAR VERSION (modo silencioso)
' Migrar de version actual a version mas reciente
' SIN PERDER PRODUCTOS, VENTAS NI CONFIGURACION
'
' Uso: El usuario debe colocar el ZIP de la nueva version
'      como "temp_update.zip" en la carpeta del sistema
'      y luego ejecutar este script.
'
' Alternativa: Ejecutar ACTUALIZAR.bat directamente
'              e ingresar el link de descarga alli.
' ============================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = objFSO.GetParentFolderName(WScript.ScriptFullName)
strDir = WshShell.CurrentDirectory

' Verificar que existe temp_update.zip
If Not objFSO.FileExists(strDir & "\temp_update.zip") Then
    MsgBox "Para actualizar silenciosamente:" & vbCrLf & vbCrLf & _
           "1. Descargue el ZIP de la nueva version desde GitHub" & vbCrLf & _
           "2. Guardelo en la carpeta del sistema como 'temp_update.zip'" & vbCrLf & _
           "3. Ejecute este script de nuevo" & vbCrLf & vbCrLf & _
           "O ejecute ACTUALIZAR.bat para ingresar el link directamente.", _
           vbInformation, "MyeCommerce POS - Actualizar"
    WScript.Quit
End If

' Verificar DB existe
If Not objFSO.FileExists(strDir & "\prisma\dev.db") Then
    MsgBox "No se encontro la base de datos (prisma\dev.db)." & vbCrLf & _
           "Este script debe ejecutarse dentro de una instalacion existente.", _
           vbCritical, "MyeCommerce POS - Error"
    WScript.Quit
End If

' Preguntar confirmacion
result = MsgBox("Se va a actualizar el sistema con temp_update.zip" & vbCrLf & vbCrLf & _
    "Se realizara un respaldo completo antes de actualizar." & vbCrLf & _
    "Despues de la actualizacion se reiniciaran los servicios." & vbCrLf & vbCrLf & _
    "Desea continuar?", _
    vbYesNo + vbQuestion, "MyeCommerce POS - Confirmar Actualizacion")

If result <> vbYes Then WScript.Quit

' Leer version actual
currentVersion = "desconocida"
If objFSO.FileExists(strDir & "\package.json") Then
    Set f = objFSO.OpenTextFile(strDir & "\package.json", 1)
    content = f.ReadAll()
    f.Close()
    Set matches = CreateObject("VBScript.RegExp")
    matches.Global = False
    matches.Pattern = """version"":\s*""([^""]+)"""
    Set m = matches.Execute(content)
    If m.Count > 0 Then currentVersion = m(0).SubMatches(0)
End If

' Generar nombre de respaldo
backupName = "BACKUP_PRE-ACTUALIZACION_" & currentVersion & "_" & Year(Now) & "-" & Right("0" & Month(Now), 2) & "-" & Right("0" & Day(Now), 2) & "_" & Right("0" & Hour(Now), 2) & Right("0" & Minute(Now), 2) & Right("0" & Second(Now), 2)

' Ejecutar ACTUALIZAR.bat con el archivo local (pasandole que el ZIP ya existe)
' Para hacerlo silencioso, creamos un bat temporal que use el ZIP local
Set batFile = objFSO.CreateTextFile(strDir & "\temp_update_silent.bat", True)
batFile.WriteLine "@echo off"
batFile.WriteLine "chcp 65001 >nul 2>&1"
batFile.WriteLine "cd /d """ & strDir & """"
batFile.WriteLine ""
batFile.WriteLine "echo [1/5] Cerrando procesos..."
batFile.WriteLine "taskkill /F /IM node.exe >nul 2>&1"
batFile.WriteLine "taskkill /F /IM caddy.exe >nul 2>&1"
batFile.WriteLine "timeout /t 3 /nobreak >nul"
batFile.WriteLine ""
batFile.WriteLine "echo [2/5] Creando respaldo..."
batFile.WriteLine "mkdir """ & backupName & """ 2>nul"
batFile.WriteLine "copy prisma\dev.db """ & backupName & "\dev.db"" >nul"
batFile.WriteLine "copy prisma\dev.db-wal """ & backupName & "\dev.db-wal"" >nul 2>&1"
batFile.WriteLine "copy prisma\dev.db-shm """ & backupName & "\dev.db-shm"" >nul 2>&1"
batFile.WriteLine "copy prisma\dev.db-journal """ & backupName & "\dev.db-journal"" >nul 2>&1"
batFile.WriteLine "copy prisma\schema.prisma """ & backupName & "\schema.prisma"" >nul"
batFile.WriteLine "if exist data\uploads xcopy /E /I /Q /Y data\uploads """ & backupName & "\uploads"" >nul 2>&1"
batFile.WriteLine "if exist BACKUPS xcopy /E /I /Q /Y BACKUPS """ & backupName & "\BACKUPS"" >nul 2>&1"
batFile.WriteLine "powershell -NoProfile -Command ""Compress-Archive -Path '" & backupName & "\*' -DestinationPath '" & backupName & ".zip' -Force"" >nul 2>&1"
batFile.WriteLine "if exist """ & backupName & ".zip"" rd /s /q """ & backupName & """ >nul 2>&1"
batFile.WriteLine ""
batFile.WriteLine "echo [3/5] Extrayendo nueva version..."
batFile.WriteLine "if exist temp_extract rd /s /q temp_extract"
batFile.WriteLine "mkdir temp_extract"
batFile.WriteLine "powershell -NoProfile -Command ""Expand-Archive -Path 'temp_update.zip' -DestinationPath 'temp_extract' -Force"" >nul 2>&1"
batFile.WriteLine ""
batFile.WriteLine "echo [4/5] Actualizando archivos..."
batFile.WriteLine "for /d %%D in (temp_extract\*) do set SRC=%%D"
batFile.WriteLine ""
batFile.WriteLine "if exist ""!SRC!\src"" (if exist src rd /s /q src & xcopy /E /I /Q /Y ""!SRC!\src"" src >nul 2>&1)"
batFile.WriteLine "if exist ""!SRC!\public"" (if exist public rd /s /q public & xcopy /E /I /Q /Y ""!SRC!\public"" public >nul 2>&1)"
batFile.WriteLine "if exist ""!SRC!\prisma\schema.prisma"" copy /Y ""!SRC!\prisma\schema.prisma"" prisma\schema.prisma >nul"
batFile.WriteLine "if exist ""!SRC!\prisma\migrations"" (xcopy /E /I /Q /Y ""!SRC!\prisma\migrations"" prisma\migrations >nul 2>&1)"
batFile.WriteLine "if exist ""!SRC!\package.json"" copy /Y ""!SRC!\package.json"" package.json >nul"
batFile.WriteLine "if exist ""!SRC!\package-lock.json"" copy /Y ""!SRC!\package-lock.json"" package-lock.json >nul"
batFile.WriteLine "if exist ""!SRC!\next.config.mjs"" copy /Y ""!SRC!\next.config.mjs"" next.config.mjs >nul 2>&1"
batFile.WriteLine "if exist ""!SRC!\next.config.js"" copy /Y ""!SRC!\next.config.js"" next.config.js >nul 2>&1"
batFile.WriteLine "if exist ""!SRC!\next.config.ts"" copy /Y ""!SRC!\next.config.ts"" next.config.ts >nul 2>&1"
batFile.WriteLine "if exist ""!SRC!\tsconfig.json"" copy /Y ""!SRC!\tsconfig.json"" tsconfig.json >nul 2>&1"
batFile.WriteLine "if exist ""!SRC!\middleware.ts"" copy /Y ""!SRC!\middleware.ts"" middleware.ts >nul 2>&1"
batFile.WriteLine "for %%F in (INSTALAR.bat INSTALAR-LIMPIO.vbs INICIAR-TODO.bat INICIAR-TODO-OCULTO.vbs DETENER-TODO.bat RESPALDAR-BD.bat CREAR-ADMIN.bat ACTUALIZAR.bat ACTUALIZAR.vbs) do if exist ""!SRC!\%%F"" copy /Y ""!SRC!\%%F"" %%F >nul 2>&1"
batFile.WriteLine "if exist ""!SRC!\caddy\Caddyfile"" copy /Y ""!SRC!\caddy\Caddyfile"" caddy\Caddyfile >nul 2>&1"
batFile.WriteLine "if exist ""!SRC!\caddy\Caddyfile-mobile"" copy /Y ""!SRC!\caddy\Caddyfile-mobile"" caddy\Caddyfile-mobile >nul 2>&1"
batFile.WriteLine "if exist ""!SRC!\printer-agent\agent.js"" copy /Y ""!SRC!\printer-agent\agent.js"" printer-agent\agent.js >nul 2>&1"
batFile.WriteLine ""
batFile.WriteLine "rd /s /q temp_extract >nul 2>&1"
batFile.WriteLine "del temp_update.zip >nul 2>&1"
batFile.WriteLine "del temp_update_silent.bat >nul 2>&1"
batFile.WriteLine ""
batFile.WriteLine "echo [5/5] Instalando dependencias..."
batFile.WriteLine "call npm install --no-audit --no-fund 2>nul"
batFile.WriteLine "call npx prisma generate >nul 2>&1"
batFile.WriteLine "call npx prisma db push --accept-data-loss 2>nul"
batFile.WriteLine ""
batFile.WriteLine "echo ACTUALIZACION COMPLETADA"
batFile.Close

' Ejecutar el bat temporal (visible para ver progreso)
WshShell.Run "cmd /c temp_update_silent.bat", 1, True

' Mostrar resultado
MsgBox "Actualizacion completada." & vbCrLf & vbCrLf & _
    "Respaldo: " & backupName & ".zip" & vbCrLf & vbCrLf & _
    "Para iniciar el sistema:" & vbCrLf & _
    "1. Ejecute INICIAR-TODO-OCULTO.vbs" & vbCrLf & _
    "2. Espere 10-15 segundos" & vbCrLf & _
    "3. Abra el navegador", _
    vbInformation, "MyeCommerce POS - Actualizado"
