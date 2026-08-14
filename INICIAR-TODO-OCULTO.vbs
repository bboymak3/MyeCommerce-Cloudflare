' ============================================================
' MyeCommerce POS v2.9.48.2 - Iniciar TODO en modo oculto
' Inicia 3 servicios SIN abrir ventanas CMD:
'   1. Printer-Agent (puerto 9100) - impresion termica
'   2. Caddy (puerto 443 + 8443) - HTTPS dominio + acceso movil
'   3. Next.js (puerto 3000) - aplicacion web
'
' Uso: doble clic, o acceso directo en el escritorio
' ============================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = objFSO.GetParentFolderName(WScript.ScriptFullName)
strDir = WshShell.CurrentDirectory

' -- PASO 1: Matar procesos anteriores --
On Error Resume Next
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")

Set colProcs = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE Name='node.exe'")
For Each p In colProcs
    p.Terminate()
Next

Set colProcs = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE Name='caddy.exe'")
For Each p In colProcs
    p.Terminate()
Next
On Error GoTo 0
WScript.Sleep 2000

' -- PASO 2: Iniciar Printer-Agent (oculto) --
' NOTA: agent.js SOLO usa modulos built-in de Node (http, fs, path).
' NO necesita node_modules para arrancar. serialport es opcional.
' Se agrega log para depuracion.
WshShell.CurrentDirectory = strDir & "\printer-agent"
WshShell.Run "cmd /c node agent.js > agent-startup.log 2>&1", 0, False
WshShell.CurrentDirectory = strDir

' -- PASO 3: Esperar agente (verificar puerto 9100) --
agentOk = False
For i = 1 To 10
    WScript.Sleep 1000
    On Error Resume Next
    Set objHTTP = CreateObject("MSXML2.XMLHTTP")
    objHTTP.Open "GET", "http://localhost:9100/status", False
    objHTTP.send ""
    If objHTTP.Status = 200 Then
        agentOk = True
        Exit For
    End If
    On Error GoTo 0
Next

' -- PASO 4: Abrir puerto 8443 en firewall (acceso movil telefono/camara) --
On Error Resume Next
WshShell.Run "cmd /c netsh advfirewall firewall delete rule name=""MyeCommerce POS Mobile 8443"" >nul 2>&1", 0, True
WshShell.Run "cmd /c netsh advfirewall firewall add rule name=""MyeCommerce POS Mobile 8443"" dir=in action=allow protocol=TCP localport=8443 profile=private,public description=""MyeCommerce POS - Acceso movil HTTPS para camara del telefono""", 0, True
On Error GoTo 0

' -- PASO 5: Iniciar Caddy (oculto, HTTPS) --
If objFSO.FileExists(strDir & "\caddy\caddy.exe") Then
    WshShell.CurrentDirectory = strDir & "\caddy"
    WshShell.Run "cmd /c caddy.exe run --config Caddyfile", 0, False
    WshShell.CurrentDirectory = strDir
    caddyIniciado = True
Else
    caddyIniciado = False
End If

WScript.Sleep 1000

' -- PASO 6: Copiar static a standalone (si existe) --
On Error Resume Next
If objFSO.FolderExists(strDir & "\.next\standalone") Then
    If Not objFSO.FolderExists(strDir & "\.next\standalone\.next\static") Then
        WshShell.Run "cmd /c xcopy /E /I /Q /Y .next\static .next\standalone\.next\static", 0, True
    End If
    If Not objFSO.FolderExists(strDir & "\.next\standalone\public") Then
        WshShell.Run "cmd /c xcopy /E /I /Q /Y public .next\standalone\public", 0, True
    End If
End If
On Error GoTo 0

' -- PASO 7: Iniciar Next.js (oculto) --
WshShell.CurrentDirectory = strDir
WshShell.Run "cmd /c npx next start -p 3000", 0, False

' -- PASO 8: Esperar a que Next.js responda --
Set objHTTP = CreateObject("MSXML2.XMLHTTP")
maxWait = 60
waited = 0
ready = False

Do While waited < maxWait And Not ready
    WScript.Sleep 1000
    waited = waited + 1
    On Error Resume Next
    objHTTP.Open "GET", "http://localhost:3000", False
    objHTTP.setRequestHeader "If-None-Match", Chr(34) & "skip" & Chr(34)
    objHTTP.send ""
    If objHTTP.Status = 200 Then
        ready = True
    End If
    On Error GoTo 0
Loop

' -- PASO 9: Abrir navegador --
If caddyIniciado Then
    WshShell.Run "https://myecommerce.ve"
Else
    WshShell.Run "http://localhost:3000"
End If
