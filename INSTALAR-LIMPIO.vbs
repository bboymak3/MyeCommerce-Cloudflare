' ==========================================================
' MyeCommerce POS v2.9.47.4 - Instalador con Progreso Visible
'
' Ejecutar como Administrador.
' Ventana de progreso se mantiene abierta durante toda la instalacion.
' ==========================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

strDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strDir
logFile = strDir & "\install-log.txt"
statusFile = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\mepos_status.txt"
htaSrc = strDir & "\PROGRESS.hta"
htaPath = WshShell.ExpandEnvironmentStrings("%TEMP%") & "\mepos_progress.hta"

Sub LogWrite(msg)
    On Error Resume Next
    Set f = objFSO.OpenTextFile(logFile, 8, True)
    f.WriteLine Now() & " | " & msg
    f.Close
    On Error GoTo 0
End Sub

Sub WriteStatus(stepN, totalN, msg, detail, pct, doneFlag, errMsg)
    On Error Resume Next
    Set f = objFSO.CreateTextFile(statusFile, True)
    f.Write stepN & "|" & totalN & "|" & msg & "|" & detail & "|" & pct & "|" & doneFlag & "|" & errMsg
    f.Close
    On Error GoTo 0
End Sub

Function RunHidden(cmd)
    WshShell.CurrentDirectory = strDir
    tmpOut = strDir & "\__cmd_out.tmp"
    npmLog = strDir & "\npm-debug-output.txt"
    On Error Resume Next
    objFSO.DeleteFile tmpOut
    On Error GoTo 0
    cmdFull = "cmd /c " & cmd & " > " & Chr(34) & tmpOut & Chr(34) & " 2>&1"
    ret = WshShell.Run(cmdFull, 0, True)
    RunHidden = ret
    On Error Resume Next
    If objFSO.FileExists(tmpOut) Then
        Set f = objFSO.OpenTextFile(tmpOut, 1)
        If Not f.AtEndOfStream Then
            output = f.ReadAll
        Else
            output = ""
        End If
        f.Close
        ' Si el comando fallo, guardar output completo para debug
        If ret <> 0 And Len(output) > 0 Then
            Set dbg = objFSO.CreateTextFile(npmLog, True)
            dbg.Write output
            dbg.Close
        End If
        objFSO.DeleteFile tmpOut
        If Len(output) > 2000 Then output = "..." & Right(output, 2000)
        If Len(output) > 0 Then LogWrite "  >> " & Replace(output, vbCrLf, " | ")
    End If
    On Error GoTo 0
End Function

On Error Resume Next
objFSO.DeleteFile statusFile
If objFSO.FileExists(htaSrc) Then
    objFSO.CopyFile htaSrc, htaPath, True
    WshShell.Run htaPath, 1, False
End If
On Error GoTo 0

Dim bienvenida
bienvenida = "MyeCommerce POS v2.9.47.4" & vbCrLf & vbCrLf & _
  "Sistema Punto de Venta - Venezuela" & vbCrLf & _
  "Doble Moneda USD/Bs con tasa BCV" & vbCrLf & _
  "Impresion Termica ESC/POS (agente v3.1 winspool)" & vbCrLf & _
  "Dominio local https://myecommerce.ve" & vbCrLf & vbCrLf & _
  "REQUISITOS:" & vbCrLf & _
  "  - Node.js 20+ instalado" & vbCrLf & _
  "  - Conexion a internet (solo para instalar deps)" & vbCrLf & _
  "  - Ejecutar como Administrador" & vbCrLf & vbCrLf & _
  "NOTA: Instalacion LIMPIA (se borran datos anteriores)." & vbCrLf & vbCrLf & _
  "El proceso muestra una ventana de progreso." & vbCrLf & _
  "NO cierre esa ventana hasta que termine." & vbCrLf & vbCrLf & _
  "Desea continuar?"

resultado = MsgBox(bienvenida, vbYesNo + vbQuestion, "MyeCommerce POS - Instalacion")
If resultado <> vbYes Then WScript.Quit

On Error Resume Next
objFSO.DeleteFile logFile
On Error GoTo 0
LogWrite "=== INSTALACION LIMPIA v2.9.47.4 ==="
LogWrite "Carpeta: " & strDir

WriteStatus 1, 8, "Verificando permisos...", "", 0, "", ""
LogWrite "PASO 1: Verificando permisos..."

On Error Resume Next
WshShell.Run "cmd /c net session >nul 2>&1", 0, True
isAdmin = (Err.Number = 0)
On Error GoTo 0

If isAdmin Then
    LogWrite "  OK: Tiene permisos de administrador"
    WriteStatus 1, 8, "Permisos verificados", "Administrador: SI", 12, "", ""
Else
    LogWrite "  AVISO: No es administrador"
    WriteStatus 1, 8, "Permisos verificados", "Administrador: NO (se saltara hosts/SSL)", 12, "", ""
End If

WriteStatus 2, 8, "Cerrando procesos anteriores...", "", 12, "", ""
LogWrite "PASO 2: Cerrando procesos anteriores..."
WshShell.Run "cmd /c taskkill /F /IM node.exe >nul 2>&1", 0, True
WshShell.Run "cmd /c taskkill /F /IM caddy.exe >nul 2>&1", 0, True
WScript.Sleep 2000
LogWrite "  OK: Procesos cerrados"
WriteStatus 2, 8, "Procesos cerrados", "node.exe y caddy.exe detenidos", 25, "", ""

WriteStatus 3, 8, "Limpiando instalacion anterior...", "", 25, "", ""
LogWrite "PASO 3: Limpiando..."
Call RunHidden("if exist node_modules rmdir /s /q node_modules")
Call RunHidden("if exist .next rmdir /s /q .next")
Call RunHidden("if exist .prisma rmdir /s /q .prisma")
On Error Resume Next
objFSO.DeleteFile strDir & "\package-lock.json"
objFSO.DeleteFile strDir & "\prisma\dev.db"
objFSO.DeleteFile strDir & "\prisma\dev.db-journal"
objFSO.DeleteFile strDir & "\prisma\dev.db-wal"
objFSO.DeleteFile strDir & "\prisma\dev.db-shm"
Call RunHidden("if exist printer-agent\spool rmdir /s /q printer-agent\spool")
On Error GoTo 0
LogWrite "  OK: Limpieza completada"

On Error Resume Next
WshShell.RegDelete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run\MyeCommercePOS"
WshShell.RegDelete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run\MyeCommerceAgente"
objFSO.DeleteFile WshShell.SpecialFolders("Desktop") & "\MyeCommerce POS.lnk"
On Error GoTo 0

If Not objFSO.FolderExists(strDir & "\espaldos") Then
    objFSO.CreateFolder strDir & "\espaldos"
End If
WriteStatus 3, 8, "Limpieza completada", "node_modules, .next, DB eliminados", 37, "", ""

WriteStatus 4, 8, "Verificando Node.js...", "", 37, "", ""
LogWrite "PASO 4: Verificando Node.js..."

On Error Resume Next
Set objExec = WshShell.Exec("cmd /c node -v 2>nul")
Do While objExec.Status = 0
    WScript.Sleep 100
Loop
nodeVer = ""
If Not objExec.StdOut.AtEndOfStream Then
    nodeVer = objExec.StdOut.ReadAll
End If
On Error GoTo 0

If nodeVer = "" Then
    LogWrite "  ERROR: Node.js no encontrado"
    WriteStatus 0, 8, "ERROR", "Node.js no esta instalado. Descargue de nodejs.org e instale.", 0, "FAIL", "Falta Node.js. Descargue de https://nodejs.org (version 20 LTS) e instale."
    MsgBox "Node.js no esta instalado." & vbCrLf & "Descargue de https://nodejs.org (version 20 LTS) e intente de nuevo.", vbCritical, "ERROR"
    WScript.Quit
End If

LogWrite "  OK: Node.js " & Trim(nodeVer)
WriteStatus 4, 8, "Node.js encontrado", Trim(nodeVer), 50, "", ""

WriteStatus 5, 8, "Instalando dependencias npm...", "Este paso tarda 1-3 minutos...", 50, "", ""
LogWrite "PASO 5: npm install --legacy-peer-deps --ignore-scripts..."
ret = RunHidden("npm install --legacy-peer-deps --ignore-scripts")

If ret <> 0 Then
    LogWrite "  WARN: Primer intento fallo (codigo " & ret & "), reintentando..."
    WriteStatus 5, 8, "Reintentando npm install...", "Segundo intento...", 50, "", ""
    WScript.Sleep 2000
    ret = RunHidden("npm install --legacy-peer-deps --ignore-scripts")
End If

If ret <> 0 Then
    LogWrite "  ERROR: npm install fallo (codigo " & ret & ")"
    WriteStatus 0, 8, "ERROR en npm install", "Revise install-log.txt para detalles", 0, "FAIL", "npm install fallo con codigo " & ret & ". Revise install-log.txt en la carpeta del sistema."
    MsgBox "npm install fallo (codigo " & ret & ")." & vbCrLf & "Posible solucion:" & vbCrLf & "1. Ejecute manualmente en la carpeta: npm install --legacy-peer-deps --ignore-scripts" & vbCrLf & "2. Si falla, actualice Node.js a la version 20 LTS desde nodejs.org" & vbCrLf & "3. Vuelva a ejecutar INSTALAR-LIMPIO.vbs" & vbCrLf & "Carpeta: " & strDir, vbCritical, "Error"
    WScript.Quit
End If
LogWrite "  OK: Dependencias instaladas"
WriteStatus 5, 8, "Dependencias instaladas", "Paquetes OK", 62, "", ""

WriteStatus 6, 8, "Configurando base de datos Prisma...", "Generando cliente + creando DB...", 62, "", ""
LogWrite "PASO 6: Prisma generate..."
ret = RunHidden("npx prisma generate")
If ret <> 0 Then
    LogWrite "  WARN: prisma generate fallo, reintentando..."
    ret = RunHidden("npx prisma generate")
    If ret <> 0 Then
        LogWrite "  ERROR: prisma generate fallo (codigo " & ret & ")"
        MsgBox "prisma generate fallo (codigo " & ret & ")." & vbCrLf & "Ejecute manualmente: npx prisma generate" & vbCrLf & "Carpeta: " & strDir, vbCritical, "Error"
        WScript.Quit
    End If
End If
LogWrite "  OK: Prisma generate OK"
LogWrite "PASO 6b: prisma db push..."
ret = RunHidden("npx prisma db push --skip-generate")
If ret <> 0 Then
    LogWrite "  WARN: db push fallo, reintentando..."
    ret = RunHidden("npx prisma db push --skip-generate")
    If ret <> 0 Then
        LogWrite "  ERROR: db push fallo (codigo " & ret & ")"
        MsgBox "prisma db push fallo (codigo " & ret & ")." & vbCrLf & "Ejecute manualmente: npx prisma db push --skip-generate" & vbCrLf & "Carpeta: " & strDir, vbCritical, "Error"
        WScript.Quit
    End If
End If
LogWrite "  OK: Base de datos lista"
WriteStatus 6, 8, "Base de datos lista", "Prisma generado + DB creada", 75, "", ""

WriteStatus 7, 8, "Configurando Caddy y HTTPS...", "Descargando Caddy si es necesario...", 75, "", ""
LogWrite "PASO 7: Caddy + dominio..."

If isAdmin Then
    hostsFile = WshShell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\drivers\etc\hosts"
    If objFSO.FileExists(hostsFile) Then
        Set f = objFSO.OpenTextFile(hostsFile, 1)
        hostsContent = f.ReadAll
        f.Close
        If InStr(hostsContent, "myecommerce.ve") = 0 Then
            Set f = objFSO.OpenTextFile(hostsFile, 8)
            f.WriteLine vbCrLf & "127.0.0.1    myecommerce.ve"
            f.Close
            LogWrite "  OK: Entrada hosts agregada"
        Else
            LogWrite "  OK: Entrada hosts ya existe"
        End If
    End If
End If

If Not objFSO.FileExists(strDir & "\caddy\caddy.exe") Then
    LogWrite "  Descargando Caddy..."
    WriteStatus 7, 8, "Descargando Caddy...", "Descargando de caddyserver.com...", 80, "", ""
    If Not objFSO.FolderExists(strDir & "\caddy") Then
        objFSO.CreateFolder strDir & "\caddy"
    End If
    caddyUrl = "https://caddyserver.com/api/download?os=windows&arch=amd64"
    caddyDest = strDir & "\caddy\caddy.exe"
    psCmd = "powershell -NoProfile -Command " & Chr(34) & "Invoke-WebRequest -Uri " & Chr(39) & caddyUrl & Chr(39) & " -OutFile " & Chr(39) & caddyDest & Chr(39) & " -UseBasicParsing" & Chr(34)
    WshShell.Run "cmd /c " & psCmd, 0, True
    LogWrite "  OK: Caddy descargado"
End If

If isAdmin And objFSO.FileExists(strDir & "\caddy\caddy.exe") Then
    LogWrite "  Instalando certificado SSL (caddy trust)..."
    WriteStatus 7, 8, "Instalando certificado SSL...", "caddy trust...", 85, "", ""
    WshShell.CurrentDirectory = strDir & "\caddy"
    WshShell.Run "cmd /c caddy.exe trust", 0, True
    WshShell.CurrentDirectory = strDir
    LogWrite "  OK: Certificado SSL instalado"
    
    ' Abrir puerto 8443 en el firewall para acceso movil (telefono -> camara)
    LogWrite "  Abriendo puerto 8443 en firewall para acceso movil..."
    WshShell.Run "cmd /c netsh advfirewall firewall delete rule name=""MyeCommerce POS Mobile 8443"" >nul 2>&1", 0, True
    WshShell.Run "cmd /c netsh advfirewall firewall add rule name=""MyeCommerce POS Mobile 8443"" dir=in action=allow protocol=TCP localport=8443 profile=private,public description=""MyeCommerce POS - Acceso movil HTTPS para camara del telefono""", 0, True
    LogWrite "  OK: Puerto 8443 abierto en firewall"
End If
WriteStatus 7, 8, "Caddy configurado", "HTTPS listo en myecommerce.ve", 87, "", ""

WriteStatus 8, 8, "Compilando para produccion...", "next build (este paso tarda 1-2 min)...", 87, "", ""
LogWrite "PASO 8: next build..."

If objFSO.FileExists(strDir & "\node_modules\.bin\next.cmd") Then
    LogWrite "  Usando next local (node_modules)"
    ret = RunHidden("node_modules\.bin\next build")
Else
    LogWrite "  Usando npx next build"
    ret = RunHidden("npx --no-install next build")
End If

If ret <> 0 Then
    LogWrite "  ERROR: next build fallo (codigo " & ret & ")"
    WriteStatus 0, 8, "ERROR en compilacion", "Revise install-log.txt para detalles del error", 0, "FAIL", "next build fallo con codigo " & ret & ". Revise install-log.txt en la carpeta del sistema."
    MsgBox "La compilacion fallo (codigo " & ret & ")." & vbCrLf & "Revise install-log.txt" & vbCrLf & "Carpeta: " & strDir, vbCritical, "Error"
    WScript.Quit
End If
LogWrite "  OK: Compilacion exitosa"
WriteStatus 8, 8, "Compilacion exitosa", "Copiando archivos estaticos...", 93, "", ""

LogWrite "Copiando estaticos a standalone..."
Call RunHidden("xcopy /E /I /Q /Y .next\static .next\standalone\.next\static")
Call RunHidden("xcopy /E /I /Q /Y public .next\standalone\public")
LogWrite "  OK: Estaticos copiados"
WriteStatus 8, 8, "Estaticos copiados", "Creando acceso directo...", 97, "", ""

On Error Resume Next
strDesktop = WshShell.SpecialFolders("Desktop")
Set oLink = WshShell.CreateShortcut(strDesktop & "\MyeCommerce POS.lnk")
oLink.TargetPath = strDir & "\INICIAR-TODO-OCULTO.vbs"
oLink.WorkingDirectory = strDir
oLink.Description = "MyeCommerce POS v2.9.47.4"
oLink.IconLocation = "shell32.dll,14"
oLink.Save
On Error GoTo 0

LogWrite "=== INSTALACION COMPLETADA EXITOSAMENTE ==="
WriteStatus 8, 8, "INSTALACION COMPLETADA", "Abra MyeCommerce POS desde el escritorio", 100, "OK", ""

Dim finale
finale = "INSTALACION COMPLETADA" & vbCrLf & vbCrLf & _
  "Para iniciar el sistema:" & vbCrLf & _
  "  Doble clic en: MyeCommerce POS (del escritorio)" & vbCrLf & _
  "  O ejecute: INICIAR-TODO-OCULTO.vbs" & vbCrLf & vbCrLf & _
  "El sistema iniciara SIN ventanas CMD." & vbCrLf & _
  "Se abrira el navegador automaticamente." & vbCrLf & vbCrLf & _
  "URLs de acceso:" & vbCrLf & _
  "  https://myecommerce.ve     (con dominio local)" & vbCrLf & _
  "  http://localhost:3000     (alternativa)" & vbCrLf & vbCrLf & _
  "USUARIO: admin   CLAVE: admin" & vbCrLf & vbCrLf & _
  "Archivos importantes:" & vbCrLf & _
  "  INSTALAR-LIMPIO.vbs        - Reinstalar desde cero" & vbCrLf & _
  "  INICIAR-TODO-OCULTO.vbs   - Iniciar sin ventanas" & vbCrLf & _
  "  INICIAR-TODO.bat           - Iniciar con ventanas (debug)" & vbCrLf & _
  "  DETENER-TODO.bat           - Detener servicios" & vbCrLf & _
  "  install-log.txt            - Log de esta instalacion"

MsgBox finale, vbInformation + vbOKOnly, "MyeCommerce POS v2.9.47.4 - Listo"
