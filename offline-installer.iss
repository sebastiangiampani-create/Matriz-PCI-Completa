[Setup]
AppId={{8D322CD7-765D-44A7-A2C8-46F6C2A52AD2}
AppName=Matriz PCI Offline
AppVersion=1.0.0
AppPublisher=Escuela de Maestros
DefaultDirName={localappdata}\Programs\Matriz PCI Offline
DefaultGroupName=Matriz PCI Offline
DisableProgramGroupPage=yes
OutputDir=release
OutputBaseFilename=Matriz-PCI-Offline-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=Matriz PCI Offline
WizardStyle=modern

[Files]
Source: "dist\Matriz-PCI-Offline.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Matriz PCI Offline"; Filename: "{app}\Matriz-PCI-Offline.exe"
Name: "{userdesktop}\Matriz PCI Offline"; Filename: "{app}\Matriz-PCI-Offline.exe"

[Run]
Filename: "{app}\Matriz-PCI-Offline.exe"; Description: "Abrir Matriz PCI Offline"; Flags: nowait postinstall skipifsilent
