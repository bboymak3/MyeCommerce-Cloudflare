' ============================================================
' MyeCommerce POS - Iniciar Caddy en modo oculto
' No abre ninguna ventana CMD
' Requiere ejecucion como Administrador (puerto 80)
' ============================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
WshShell.CurrentDirectory = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Matar Caddy anterior si existe
On Error Resume Next
Set colProcs = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE Name='caddy.exe'")
For Each p In colProcs
    p.Terminate()
Next
On Error GoTo 0
WScript.Sleep 500

' Detectar IP local para acceso movil
strLocalIP = ""
On Error Resume Next
Set colAdapters = objWMI.ExecQuery("SELECT * FROM Win32_NetworkAdapterConfiguration WHERE IPEnabled=True")
For Each adap In colAdapters
    If Not IsNull(adap.IPAddress) Then
        For i = 0 To UBound(adap.IPAddress)
            ip = adap.IPAddress(i)
            ' Tomar la primera IP que no sea 127.0.0.1
            If ip <> "127.0.0.1" And Left(ip, 4) <> "169." And InStr(ip, ":") = 0 Then
                strLocalIP = ip
                Exit For
            End If
        Next
        If strLocalIP <> "" Then Exit For
    End If
Next
On Error GoTo 0

' Guardar IP en archivo para uso posterior
If strLocalIP <> "" Then
    Set f = objFSO.CreateTextFile(WshShell.CurrentDirectory & "\caddy\local-ip.txt", True)
    f.WriteLine strLocalIP
    f.Close
End If

' Iniciar Caddy en modo oculto
WshShell.Run "cmd /c caddy.exe run --config Caddyfile", 0, False
