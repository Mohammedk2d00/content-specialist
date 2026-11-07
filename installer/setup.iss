; Arabic setup wizard for UOWA Content Specialist. Compiled by GitHub Actions (see .github/workflows/installer.yml).
; One Setup.exe: app files inside, Node.js downloaded only when missing, Gemini CLI and the app engine fetched by finish-setup.cmd.
#define AppName "UOWA Content Specialist"
#define AppVersion GetEnv("APP_VERSION")

[Setup]
AppName={#AppName}
AppVersion={#AppVersion}
; Per-user folder: the app writes drafts, model.txt and settings next to itself, so it must not live in Program Files.
DefaultDirName={localappdata}\{#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=out
OutputBaseFilename=UOWA-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\launcher\uowa.ico
UninstallDisplayIcon={app}\launcher\uowa.ico

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"

[Files]
Source: "stage\*"; DestDir: "{app}"; Excludes: "style-guide.md,model.txt"; Flags: recursesubdirs createallsubdirs ignoreversion
; Defaults only on a first install: a reinstall must not erase the learned style guide.
Source: "stage\style-guide.md"; DestDir: "{app}"; Flags: onlyifdoesntexist
Source: "stage\model.txt"; DestDir: "{app}"; Flags: onlyifdoesntexist
Source: "finish-setup.cmd"; DestDir: "{app}\installer"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\UOWA Content Specialist.exe"; WorkingDir: "{app}"; IconFilename: "{app}\launcher\uowa.ico"
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\UOWA Content Specialist.exe"; WorkingDir: "{app}"; IconFilename: "{app}\launcher\uowa.ico"

; finish-setup.cmd runs hidden from finish-setup.iss. These Finish-page options appear only if it succeeded.
; The Gemini sign-in keeps a window on purpose: the user must answer its prompts.
[Run]
Filename: "{cmd}"; Parameters: "/c ""set ""PATH=%APPDATA%\npm;%PATH%"" && gemini"""; WorkingDir: "{app}"; Description: "تسجيل الدخول إلى Gemini (مرة واحدة)"; Flags: postinstall nowait skipifsilent unchecked; Check: SetupSucceeded
Filename: "{app}\UOWA Content Specialist.exe"; WorkingDir: "{app}"; Description: "تشغيل البرنامج الآن"; Flags: postinstall nowait skipifsilent; Check: SetupSucceeded

; Downloaded after install, so the uninstaller would not know them. Never list {app} itself: drafts is a link to Documents.
[UninstallDelete]
Type: filesandordirs; Name: "{app}\app\node_modules"
Type: filesandordirs; Name: "{app}\.patch-backup"
Type: files; Name: "{app}\installer\setup.log"
Type: files; Name: "{app}\installer\setup-ok"

#include "node-download.iss"
#include "finish-setup.iss"
