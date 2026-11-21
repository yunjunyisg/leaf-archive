Unicode true
!include "MUI2.nsh"
Name "识植助手"
OutFile "${PLANT_ID_INSTALLER}"
InstallDir "$LOCALAPPDATA\Programs\PlantId"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "..\assets\plant-id.ico"
UninstallIcon "..\assets\plant-id.ico"
VIProductVersion "1.0.0.0"
VIAddVersionKey /LANG=2052 "FileDescription" "识植助手安装程序"
VIAddVersionKey /LANG=2052 "ProductName" "识植助手"
VIAddVersionKey /LANG=2052 "FileVersion" "1.0.0"
VIAddVersionKey /LANG=2052 "LegalCopyright" "识植助手"

Function .onInit
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\PlantId"
FunctionEnd

!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\app\PlantId.exe"
!define MUI_FINISHPAGE_RUN_TEXT "打开识植助手"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "识植助手"
  SetOutPath "$INSTDIR\app"
  File /r "${PLANT_ID_BUILD}\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$SMPROGRAMS\识植助手.lnk" "$INSTDIR\app\PlantId.exe"
  CreateShortcut "$DESKTOP\识植助手.lnk" "$INSTDIR\app\PlantId.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PlantId" "DisplayName" "识植助手"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PlantId" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PlantId" "DisplayIcon" "$INSTDIR\app\PlantId.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PlantId" "UninstallString" '\"$INSTDIR\Uninstall.exe\"'
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\识植助手.lnk"
  Delete "$DESKTOP\识植助手.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\PlantId"
  RMDir /r "$INSTDIR\app"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
SectionEnd
