@echo off
setlocal
cd /d "%~dp0"
echo Atalhos AE - instalador Windows
echo Extraia o ZIP inteiro e feche o After Effects antes de continuar.
echo Pode aparecer uma confirmacao do Windows para instalar na pasta da Adobe.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (
    echo.
    echo A instalacao encontrou um erro.
    pause
    exit /b 1
)
echo.
pause

