' ============================================================
' MyeCommerce POS - Iniciar Caddy en modo oculto
' No abre ninguna ventana CMD
' Requiere ejecucion como Administrador (puerto 80)
' ============================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Matar Caddy anterior si existe
On Error Resume Next
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
Set colProcs = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE Name='caddy.exe'")
For Each p In colProcs
    p.Terminate()
Next
On Error GoTo 0
WScript.Sleep 500

' Iniciar Caddy en modo oculto
WshShell.Run "cmd /c caddy.exe run --config Caddyfile", 0, False
