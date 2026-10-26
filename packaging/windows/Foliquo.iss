#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef SourceDir
  #error SourceDir is required
#endif
#ifndef OutputPath
  #error OutputPath is required
#endif
[Setup]
AppId={{71E40B4D-1908-4B10-B2E7-4BA734955E32}
AppName=Foliquo Community
AppVersion={#AppVersion}
AppPublisher=Maximilian Auer
AppPublisherURL=https://maximilianauer.at/projects/foliquo/
AppSupportURL=https://github.com/gitmaximilian/Foliquo/issues
AppUpdatesURL=https://github.com/gitmaximilian/Foliquo/releases
DefaultDirName={localappdata}\Programs\Foliquo
DefaultGroupName=Foliquo Community
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
UninstallDisplayName=Foliquo Community
UninstallDisplayIcon={app}\Foliquo.exe
LicenseFile={#SourceDir}\LICENSE
InfoAfterFile={#SourceDir}\WINDOWS-INSTALL.txt
SetupIconFile=..\..\dist\brand\community\favicons\favicon.ico
WizardStyle=modern
OutputDir={#OutputPath}
OutputBaseFilename=Foliquo-Community-{#AppVersion}-Windows-x64-Setup
Compression=lzma2
SolidCompression=yes
AppMutex=Local\FoliquoCommunity
CloseApplications=yes
RestartApplications=no
Uninstallable=yes
DisableProgramGroupPage=yes
; No service, scheduled task, startup entry, firewall exception or data removal is installed.

[Tasks]
Name: desktopicon; Description: "Create a desktop shortcut"; Flags: unchecked

[InstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
Type: filesandordirs; Name: "{app}\lib"
Type: filesandordirs; Name: "{app}\dist"
Type: filesandordirs; Name: "{app}\bin"
Type: filesandordirs; Name: "{app}\scripts"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Foliquo Community"; Filename: "{app}\Foliquo.exe"; WorkingDir: "{app}"
Name: "{group}\Stop Foliquo"; Filename: "{app}\Foliquo.exe"; Parameters: "stop"; WorkingDir: "{app}"
Name: "{group}\Uninstall Foliquo Community"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Foliquo Community"; Filename: "{app}\Foliquo.exe"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\App Paths\Foliquo.exe"; ValueType: string; ValueData: "{app}\Foliquo.exe"; Flags: uninsdeletekey

[Run]
Filename: "{app}\Foliquo.exe"; Description: "Open Foliquo Community"; Flags: nowait postinstall skipifsilent

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var Code: Integer;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\Foliquo.exe')) then
  begin
    if not Exec(ExpandConstant('{app}\Foliquo.exe'), 'stop', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, Code) then
      Log('Existing service could not be contacted; AppMutex and Restart Manager remain active.');
  end;
end;

function InitializeUninstall(): Boolean;
var Code: Integer;
begin
  Exec(ExpandConstant('{app}\Foliquo.exe'), 'stop', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, Code);
  Result := True;
end;
