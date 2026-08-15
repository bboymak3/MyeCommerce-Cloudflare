' ============================================================
' MyeCommerce POS v2.9.55 - Iniciar TODO en modo oculto
' Inicia 4 servicios SIN abrir ventanas CMD:
'   1. Printer-Agent (puerto 9100) - impresion termica
'   2. Caddy Dominio (puerto 443) - HTTPS myecommerce.ve (PC)
'   3. Caddy Movil (puerto 8443) - HTTPS IP local (telefono/camara)
'   4. Next.js (puerto 3000) - aplicacion web
'
' IMPORTANTE: Caddy Movil es INDEPENDIENTE del Caddy Dominio.
' Si el Caddy del dominio falla (puerto 80/443 en uso), el movil
' sigue funcionando en :8443 para la camara del telefono.
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

' -- PASO 2: Detectar IP local y guardarla --
WshShell.Run "cmd /c powershell -NoProfile -Command ""$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } | Select-Object -First 1 -ExpandProperty IPAddress); if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { -not $_.Loopback -and $_.PrefixOrigin -ne 'WellKnown' } | Select-Object -First 1 -ExpandProperty IPAddress) }; Write-Output $ip"" > """ & strDir & "\caddy\local-ip.txt"" 2>nul", 0, True

' -- PASO 3: Iniciar Printer-Agent (oculto) --
' NOTA: agent.js SOLO usa modulos built-in de Node (http, fs, path).
' NO necesita node_modules para arrancar. serialport es opcional.
WshShell.CurrentDirectory = strDir & "\printer-agent"
WshShell.Run "cmd /c node agent.js > agent-startup.log 2>&1", 0, False
WshShell.CurrentDirectory = strDir

' -- PASO 4: Esperar agente (verificar puerto 9100) --
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

' -- PASO 5: Abrir puerto 8443 en firewall (acceso movil telefono/camara) --
On Error Resume Next
WshShell.Run "cmd /c netsh advfirewall firewall delete rule name=""MyeCommerce POS Mobile 8443"" >nul 2>&1", 0, True
WshShell.Run "cmd /c netsh advfirewall firewall add rule name=""MyeCommerce POS Mobile 8443"" dir=in action=allow protocol=TCP localport=8443 profile=private,public description=""MyeCommerce POS - Acceso movil HTTPS para camara del telefono""", 0, True
On Error GoTo 0

' -- PASO 6: Iniciar Caddy Dominio (oculto, HTTPS myecommerce.ve) --
' Este puede fallar si puerto 80 o 443 estan en uso - NO es critico
caddyDir = strDir & "\caddy"
caddyIniciado = False
If objFSO.FileExists(caddyDir & "\caddy.exe") Then
    ' Intentar iniciar Caddy del dominio (puede fallar silenciosamente)
    WshShell.CurrentDirectory = caddyDir
    WshShell.Run "cmd /c caddy.exe run --config Caddyfile > caddy-domain.log 2>&1", 0, False
    WshShell.CurrentDirectory = strDir
    caddyIniciado = True
End If

' -- PASO 7: Iniciar Caddy Movil (oculto, HTTPS :8443) --
' PROCESO INDEPENDIENTE - este ES critico para la camara del telefono
' Usa su propio Caddyfile-mobile y su propio data-dir para certificados
caddyMovilIniciado = False
If objFSO.FileExists(caddyDir & "\caddy.exe") Then
    If objFSO.FileExists(caddyDir & "\Caddyfile-mobile") Then
        WshShell.CurrentDirectory = caddyDir
        WshShell.Run "cmd /c caddy.exe run --config Caddyfile-mobile > caddy-mobile.log 2>&1", 0, False
        WshShell.CurrentDirectory = strDir
        caddyMovilIniciado = True
        
        ' Esperar 3 segundos y verificar que Caddy movil esta escuchando en 8443
        WScript.Sleep 3000
        caddyMovilOk = False
        For i = 1 To 10
            WScript.Sleep 1000
            On Error Resume Next
            Set objHTTP2 = CreateObject("MSXML2.XMLHTTP")
            ' Intentar conexion HTTPS (esperamos error de certificado, NO de conexion)
            objHTTP2.Open "GET", "https://localhost:8443", False
            On Error Resume Next
            objHTTP2.send ""
            ' Si el status es algo (incluso error TLS), significa que Caddy esta escuchando
            If Err.Number = 0 Or InStr(1, Err.Description, "certificate") > 0 Or InStr(1, Err.Description, "certificado") > 0 Then
                caddyMovilOk = True
                Exit For
            End If
            ' Si el error es de conexion rechazada, Caddy no esta escuchando
            On Error GoTo 0
        Next
    Else
        ' Caddyfile-mobile no existe, usar el Caddyfile principal como fallback
        WshShell.CurrentDirectory = caddyDir
        WshShell.Run "cmd /c caddy.exe run --config Caddyfile > caddy-mobile.log 2>&1", 0, False
        WshShell.CurrentDirectory = strDir
        caddyMovilIniciado = True
    End If
End If

' -- PASO 8: Copiar static a standalone (si existe) --
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

' -- PASO 9: Iniciar Next.js (oculto) --
WshShell.CurrentDirectory = strDir
WshShell.Run "cmd /c npx next start -p 3000", 0, False

' -- PASO 10: Esperar a que Next.js responda --
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

' -- PASO 11: Abrir navegador --
If caddyIniciado Then
    WshShell.Run "https://myecommerce.ve"
Else
    WshShell.Run "http://localhost:3000"
End If
