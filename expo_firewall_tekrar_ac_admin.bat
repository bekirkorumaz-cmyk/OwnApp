@echo off
setlocal

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Yonetici izni gerekiyor. UAC penceresi acilacak.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Windows Firewall tekrar aciliyor...
netsh advfirewall set allprofiles state on

echo.
echo Firewall tekrar acildi.
pause
endlocal
