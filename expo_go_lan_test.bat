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
  pause
  exit /b 1
)

cd /d "%PROJECT_ROOT%"

set "REACT_NATIVE_PACKAGER_HOSTNAME=%WIFI_IP%"
set "__UNSAFE_EXPO_HOME_DIRECTORY=%PROJECT_ROOT%\.expo-home"
set "EXPO_NO_DEPENDENCY_VALIDATION=1"
set "EXPO_NO_TELEMETRY=1"

echo Expo Go LAN test basliyor.
echo.
echo Telefonda Expo Go acilmazsa su adresi dene:
echo exp://%WIFI_IP%:8082
echo.
echo Durum kontrolu:
echo http://%WIFI_IP%:8082/status
echo.

npx expo start --lan --clear --max-workers 1 --port 8082

pause
endlocal
