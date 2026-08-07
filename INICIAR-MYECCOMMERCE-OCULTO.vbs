Set WshShell = CreateObject("WScript.Shell")
' Usar el directorio donde esta este VBS (no depende de ruta fija)
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)

' Matar proceso en puerto 3000 si existe
On Error Resume Next
Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
Set colProcesses = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE CommandLine LIKE '%next dev%'")
For Each objProcess In colProcesses
    objProcess.Terminate()
Next
On Error GoTo 0

WScript.Sleep 2000
WshShell.Run "cmd /c npx next dev -p 3000", 0, False
WScript.Sleep 4000
WshShell.Run "http://localhost:3000"
