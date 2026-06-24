' Launches the proxy with no visible console window.
' Used by the scheduled task so the proxy runs silently at logon.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projDir   = fso.GetParentFolderName(scriptDir)

nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then
  ' Fall back to PATH lookup.
  nodeExe = "node.exe"
End If

entry = projDir & "\src\index.js"
sh.CurrentDirectory = projDir
' 0 = hidden window, False = don't wait.
sh.Run """" & nodeExe & """ """ & entry & """", 0, False
