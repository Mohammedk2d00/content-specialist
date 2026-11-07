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
Source: "stage\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "finish-setup.cmd"; DestDir: "{app}\installer"; Flags: ignoreversion

[Icons]
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\UOWA Content Specialist.exe"; WorkingDir: "{app}"; IconFilename: "{app}\launcher\uowa.ico"
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\UOWA Content Specialist.exe"; WorkingDir: "{app}"; IconFilename: "{app}\launcher\uowa.ico"

[Run]
Filename: "{app}\installer\finish-setup.cmd"; WorkingDir: "{app}"; StatusMsg: "جارٍ تجهيز البرنامج، قد يستغرق عدة دقائق..."; Flags: waituntilterminated
Filename: "cmd.exe"; Parameters: "/c ""set PATH=%APPDATA%\npm;%PATH% && gemini"""; Description: "تسجيل الدخول إلى Gemini (مرة واحدة)"; Flags: postinstall nowait skipifsilent unchecked
Filename: "{app}\UOWA Content Specialist.exe"; WorkingDir: "{app}"; Description: "تشغيل البرنامج الآن"; Flags: postinstall nowait skipifsilent

#include "node-download.iss"
