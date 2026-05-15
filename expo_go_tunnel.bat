@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

cd /d "%PROJECT_ROOT%"

echo Expo Go tunnel modu basliyor.
echo Bu modda telefon ve bilgisayar ayni Wi-Fi aginda olmak zorunda degil.
echo.

set "REACT_NATIVE_PACKAGER_HOSTNAME="
set "__UNSAFE_EXPO_HOME_DIRECTORY=%PROJECT_ROOT%\.expo-home"
set "EXPO_NO_DEPENDENCY_VALIDATION=1"
set "EXPO_NO_TELEMETRY=1"
npx expo start --tunnel --max-workers 1

pause
endlocal
