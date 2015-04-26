Const FOF_SILENT = &H4  ' don't create progress/report

'The location of the zip file.
ZipFilePath=WScript.Arguments.Item(0)
'The folder the contents should be extracted to.
DirectoryToZip=WScript.Arguments.Item(1)

' 'Get command-line arguments.
' ' Set objArgs = WScript.Arguments
' ' InputFolder = objArgs(0)
' ' ZipFile = objArgs(1)

' 'Create empty ZIP file.
' CreateObject("Scripting.FileSystemObject").CreateTextFile(ZipFilePath, True).Write "PK" & Chr(5) & Chr(6) & String(18, vbNullChar)

' Set objShell = CreateObject("Shell.Application")

' Set source = objShell.NameSpace(DirectoryToZip).Items

' objShell.NameSpace(ZipFilePath).CopyHere(source), FOF_SILENT

' 'Required!
' wScript.Sleep 2000

ArchiveFolder ZipFilePath, DirectoryToZip

Sub ArchiveFolder (zipFile, sFolder)

    With CreateObject("Scripting.FileSystemObject")
        zipFile = .GetAbsolutePathName(zipFile)
        sFolder = .GetAbsolutePathName(sFolder)

        With .CreateTextFile(zipFile, True)
            .Write Chr(80) & Chr(75) & Chr(5) & Chr(6) & String(18, chr(0))
        End With
    End With

    With CreateObject("Shell.Application")
        .NameSpace(zipFile).CopyHere .NameSpace(sFolder).Items

        Do Until .NameSpace(zipFile).Items.Count = _
                 .NameSpace(sFolder).Items.Count
            WScript.Sleep 1000 
        Loop
    End With

End Sub
