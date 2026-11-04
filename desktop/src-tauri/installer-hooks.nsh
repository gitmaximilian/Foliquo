; Older desktop updaters can exit without stopping their bundled Node child.
; Authenticate the service and wait for its process before replacing locked files.
!define FOLIQUO_UPGRADE_HELPER "${__FILEDIR__}\..\..\lib\service-upgrade.mjs"
!macro NSIS_HOOK_PREINSTALL
  Push $R0
  Push $R1
  Push $R2
  StrCpy $R2 "$INSTDIR\service\runtime\node.exe"
  IfFileExists "$R2" foliquo_stop_service 0
  StrCpy $R2 "$INSTDIR\resources\service\runtime\node.exe"
  IfFileExists "$R2" foliquo_stop_service foliquo_service_stopped
  foliquo_stop_service:
    InitPluginsDir
    File /oname=$PLUGINSDIR\foliquo-service-upgrade.mjs "${FOLIQUO_UPGRADE_HELPER}"
    nsExec::ExecToStack /TIMEOUT=30000 '"$R2" "$PLUGINSDIR\foliquo-service-upgrade.mjs"'
    Pop $R0
    Pop $R1
    StrCmp $R0 "0" foliquo_service_stopped
    MessageBox MB_OK|MB_ICONSTOP "Close all Foliquo windows and its browser service, then run the installer again. Your saved data is retained." /SD IDOK
    SetErrorLevel 1
    Quit
  foliquo_service_stopped:
  Pop $R2
  Pop $R1
  Pop $R0
!macroend
