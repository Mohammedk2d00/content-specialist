; Runs finish-setup.cmd with no console window after the files are copied, while the wizard shows its own Arabic status.
; A failure is reported in a message box and the Finish page then offers no "Launch", so a half-ready app is never started.
[Code]
var
  SetupOk: Boolean;

function SetupSucceeded: Boolean;
begin
  Result := SetupOk;
end;

procedure RunFinishSetup;
var
  App, Log: String;
  Code: Integer;
begin
  App := ExpandConstant('{app}');
  Log := App + '\installer\setup.log';
  WizardForm.StatusLabel.Caption := 'جارٍ تنزيل مكوّنات البرنامج وتجهيزه، قد يستغرق عدة دقائق...';
  WizardForm.ProgressGauge.Style := npbstMarquee;
  // cmd strips the outer quotes, leaving: "<app>\installer\finish-setup.cmd" > "<log>" 2>&1
  SetupOk := Exec(ExpandConstant('{cmd}'), '/c ""' + App + '\installer\finish-setup.cmd" > "' + Log + '" 2>&1"',
    App, SW_HIDE, ewWaitUntilTerminated, Code) and (Code = 0) and FileExists(App + '\installer\setup-ok');
  WizardForm.ProgressGauge.Style := npbstNormal;
  if not SetupOk then
    MsgBox('تعذّر إكمال تجهيز البرنامج. تحقق من الاتصال بالإنترنت ثم شغّل المثبّت مرة أخرى.' + #13#10#13#10 +
      'التفاصيل في الملف:' + #13#10 + Log, mbError, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then RunFinishSetup;
end;
