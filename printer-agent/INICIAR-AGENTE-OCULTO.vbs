' ============================================================
' MyeCommerce POS - Iniciar Agente de Impresion en modo oculto
' No abre ninguna ventana CMD
' ============================================================

Set WshShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")
WshShell.CurrentDirectory = objFSO.GetParentFolderName(WScript.ScriptFullName)

' Matar agente anterior si existe
On Error Resume Next
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
Set colProcs = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE CommandLine LIKE '%printer-agent\agent.js%' AND Name='node.exe'")
For Each p In colProcs
    p.Terminate()
Next
On Error GoTo 0
WScript.Sleep 500

' Iniciar el agente en modo oculto (ventana 0 = invisible)
' NOTA: agent.js NO necesita node_modules, usa solo modulos built-in
WshShell.Run "cmd /c node agent.js > agent-startup.log 2>&1", 0, False
