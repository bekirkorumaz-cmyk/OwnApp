@echo off
setlocal

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Yonetici izni gerekiyor. UAC penceresi acilacak.
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ===========================================
echo THE RHYTHM - Expo Go ag izinleri
echo ===========================================
echo.

echo Windows guvenlik duvari kurallari ekleniyor...
netsh advfirewall firewall delete rule name="THE_RHYTHM Expo Go Ports" >nul 2>&1
netsh advfirewall firewall delete rule name="THE_RHYTHM Node Expo" >nul 2>&1
netsh advfirewall firewall add rule name="THE_RHYTHM Expo Go Ports" dir=in action=allow protocol=TCP localport=8081-8084 profile=any
netsh advfirewall firewall add rule name="THE_RHYTHM Node Expo" dir=in action=allow program="C:\Program Files\nodejs\node.exe" enable=yes profile=any

echo.
echo Aktif ag profili Private yapiliyor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetConnectionProfile | Where-Object { $_.IPv4Connectivity -ne 'Disconnected' } | ForEach-Object { Set-NetConnectionProfile -InterfaceIndex $_.InterfaceIndex -NetworkCategory Private }"

echo.
echo Kontrol:
netsh advfirewall firewall show rule name="THE_RHYTHM Expo Go Ports"

echo.
echo Bitti. Simdi expo_go_lan_test.bat dosyasini yeniden calistirin.
pause
endlocal
