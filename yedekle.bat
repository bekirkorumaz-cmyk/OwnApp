@echo off
setlocal enabledelayedexpansion

for /f "usebackq" %%i in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'"`) do set "timestamp=%%i"

set "backupDirName=%timestamp%"
set "targetBaseDir=..\THE_RHYTHM_yedekler"
set "targetFullDir=%targetBaseDir%\%backupDirName%"

echo ===========================================
echo   THE RHYTHM - TEMIZ PROJE YEDEGI
echo ===========================================
echo.
echo Hedef klasor:
echo %targetFullDir%
echo.

if not exist "%targetBaseDir%" mkdir "%targetBaseDir%"
if errorlevel 1 exit /b 1

mkdir "%targetFullDir%"
if errorlevel 1 exit /b 1

if exist "android" robocopy "android" "%targetFullDir%\android" /E /MT:8 /XD build .gradle .cxx
if errorlevel 8 goto :copy_error

if exist "src" robocopy "src" "%targetFullDir%\src" /E /MT:8
if errorlevel 8 goto :copy_error

if exist "assets" robocopy "assets" "%targetFullDir%\assets" /E /MT:8
if errorlevel 8 goto :copy_error

if exist "logo" robocopy "logo" "%targetFullDir%\logo" /E /MT:8
if errorlevel 8 goto :copy_error

if exist "supabase" robocopy "supabase" "%targetFullDir%\supabase" /E /MT:8
if errorlevel 8 goto :copy_error

if exist "HESAPLAR_OZEL" robocopy "HESAPLAR_OZEL" "%targetFullDir%\HESAPLAR_OZEL" /E /MT:8
if errorlevel 8 goto :copy_error

call :copy_if_exists "App.js"
call :copy_if_exists "index.js"
call :copy_if_exists "app.json"
call :copy_if_exists "app.config.js"
call :copy_if_exists "eas.json"
call :copy_if_exists "babel.config.js"
call :copy_if_exists "package.json"
call :copy_if_exists "package-lock.json"
call :copy_if_exists "tsconfig.json"
call :copy_if_exists ".gitignore"
call :copy_if_exists ".easignore"
call :copy_if_exists ".env.example"
call :copy_if_exists "KURULUM_NOTLARI.txt"
call :copy_if_exists "PRIVACY_POLICY_TR.md"
call :copy_if_exists "supabase_schema.sql"
call :copy_if_exists "lokal_apk_debug.bat"
call :copy_if_exists "lokal_apk_release.bat"
call :copy_if_exists "lokal_aab_release.bat"
call :copy_if_exists "lokal_apk_aab_cikar.bat"
call :copy_if_exists "expo_go_tunnel.bat"
call :copy_if_exists "expo_go_wifi.bat"
call :copy_if_exists "yedekle.bat"

echo.
echo Yedekleme tamamlandi.
echo.
if /I not "%~1"=="/nopause" pause
exit /b 0

:copy_if_exists
if exist "%~1" copy /Y "%~1" "%targetFullDir%\" >nul
exit /b 0

:copy_error
echo Kopyalama sirasinda hata olustu.
if /I not "%~1"=="/nopause" pause
exit /b 1
