; Downloads and installs Node.js before the files are copied, only when the PC does not have it.
; The SHA-256 pins the exact file, so a tampered download is rejected.
[Code]
const
  NodeUrl = 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi';
  NodeSha256 = '9eea480bd30c98ae11a97cb89a9278235cbbbd03c171ee5e5198bd86b7965b4b';

function NodeInstalled: Boolean;
begin
  Result := FileExists(ExpandConstant('{commonpf64}\nodejs\node.exe'));
end;

function InstallNode: String;
var
  Msi: String;
  Code: Integer;
begin
  Result := '';
  if NodeInstalled then Exit;
  try
    DownloadTemporaryFile(NodeUrl, 'node.msi', NodeSha256, nil);
  except
    Result := 'تعذّر تنزيل Node.js. تحقق من الإنترنت ثم أعد المحاولة.';
    Exit;
  end;
  Msi := ExpandConstant('{tmp}\node.msi');
  // runas shows the Windows admin prompt; the installer itself stays per-user.
  if not ShellExec('runas', 'msiexec.exe', '/i "' + Msi + '" /passive /norestart', '', SW_SHOW, ewWaitUntilTerminated, Code)
     or ((Code <> 0) and (Code <> 3010)) or not NodeInstalled then
    Result := 'لم يكتمل تثبيت Node.js.';
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := InstallNode;
end;
