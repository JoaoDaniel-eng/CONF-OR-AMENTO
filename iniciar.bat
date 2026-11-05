@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.9 ou superior nao encontrado. Instale em https://www.python.org/downloads/ ^(marque "Add Python to PATH"^).
  pause
  exit /b 1
)
python backend\server.py
pause
