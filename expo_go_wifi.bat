@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /C:"IPv4 Address" /C:"IPv4 Adresi"') do (
  if not defined WIFI_IP set "WIFI_IP=%%I"
)
set "WIFI_IP=%WIFI_IP: =%"

if "%WIFI_IP%"=="" (
  echo Wi-Fi IP adresi bulunamadi.
  echo Telefon ve bilgisayarin ayni Wi-Fi aginda oldugundan emin ol.
  pause
  exit /b 1
)

echo Expo Go icin kullanilacak IP: %WIFI_IP%
echo Telefon ayni Wi-Fi aginda olmali.
echo Windows guvenlik duvari node.exe icin izin sorarsa izin ver.
echo.
echo Telefondan kontrol: http://%WIFI_IP%:8081/status
echo Bu adres telefonda acilmiyorsa bu Wi-Fi agi cihazlari birbirinden izole ediyor olabilir.
echo.

cd /d "%PROJECT_ROOT%"

set "__UNSAFE_EXPO_HOME_DIRECTORY=%PROJECT_ROOT%\.expo-home"
set "EXPO_NO_DEPENDENCY_VALIDATION=1"
set "EXPO_NO_TELEMETRY=1"

echo Baslatma modu sec:
echo   1 - LAN / Wi-Fi (hizli, ayni ag gerekir)
echo   2 - LAN / Wi-Fi + cache temizle
echo   3 - Tunnel (bu ag LAN'i engelliyorsa kullan)
echo.
if not "%~1"=="" (
  set "MODE=%~1"
) else (
  set /p "MODE=Secim [1]: "
)
if "%MODE%"=="" set "MODE=1"

if "%MODE%"=="2" (
  set "REACT_NATIVE_PACKAGER_HOSTNAME=%WIFI_IP%"
  npx expo start --lan --clear --max-workers 1
) else if "%MODE%"=="3" (
  set "REACT_NATIVE_PACKAGER_HOSTNAME="
  set "EXPO_OFFLINE="
  npx expo start --tunnel --max-workers 1
) else (
  set "REACT_NATIVE_PACKAGER_HOSTNAME=%WIFI_IP%"
  npx expo start --lan --max-workers 1
)

pause
endlocal
