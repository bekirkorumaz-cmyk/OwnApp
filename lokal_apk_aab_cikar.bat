@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

set "SDK_ROOT=Y:\bekir\Android\Sdk"
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"
set "PORTABLE_NODE=%LOCALAPPDATA%\Temp\node-v20.20.2-win-x64"
set "ASCII_HOME=%PROJECT_ROOT%\.home-user"
set "GRADLE_HOME_LOCAL=%PROJECT_ROOT%\.gradle-user"
set "TMP_LOCAL=%PROJECT_ROOT%\.tmp-build"

if not exist "%ASCII_HOME%" mkdir "%ASCII_HOME%"
if not exist "%GRADLE_HOME_LOCAL%" mkdir "%GRADLE_HOME_LOCAL%"
if not exist "%TMP_LOCAL%" mkdir "%TMP_LOCAL%"

set "ANDROID_HOME=%SDK_ROOT%"
set "ANDROID_SDK_ROOT=%SDK_ROOT%"
set "GRADLE_USER_HOME=%GRADLE_HOME_LOCAL%"
set "HOME=%ASCII_HOME%"
set "USERPROFILE=%ASCII_HOME%"
set "TEMP=%TMP_LOCAL%"
set "TMP=%TMP_LOCAL%"
set "JAVA_TOOL_OPTIONS=-Duser.home=%ASCII_HOME%"
set "NODE_ENV=production"

if exist "%PORTABLE_NODE%\node.exe" (
  set "PATH=%PORTABLE_NODE%;%PORTABLE_NODE%\node_modules\npm\bin;%JAVA_HOME%\bin;%SDK_ROOT%\platform-tools;%SDK_ROOT%\cmdline-tools\latest\bin;%PATH%"
) else (
  set "PATH=%JAVA_HOME%\bin;%SDK_ROOT%\platform-tools;%SDK_ROOT%\cmdline-tools\latest\bin;%PATH%"
)

cd /d "%PROJECT_ROOT%\android"
call gradlew.bat :app:assembleRelease :app:bundleRelease -PnewArchEnabled=true "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64" --console=plain --no-daemon --max-workers=2

if errorlevel 1 (
  echo.
  echo Lokal APK/AAB olusturulamadi. Hata mesaji yukarida.
  pause
  exit /b %errorlevel%
)

echo.
echo Lokal release APK hazir:
echo %PROJECT_ROOT%\android\app\build\outputs\apk\release\app-release.apk
echo.
echo Lokal release AAB hazir:
echo %PROJECT_ROOT%\android\app\build\outputs\bundle\release\app-release.aab

pause
endlocal
