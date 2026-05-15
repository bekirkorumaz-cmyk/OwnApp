@echo off
setlocal

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Yonetici izni gerekiyor. UAC penceresi acilacak.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo Windows Firewall gecici olarak kapatiliyor...
netsh advfirewall set allprofiles state off

echo.
echo Firewall kapali. Simdi telefondan tekrar dene:
echo http://192.168.1.104:8082/status
echo exp://192.168.1.104:8082
echo.
echo Test bitince guvenlik duvarini tekrar acmak icin:
echo expo_firewall_tekrar_ac_admin.bat
pause
endlocal
