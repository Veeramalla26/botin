@echo off
echo Running MySQL password reset...
powershell -ExecutionPolicy Bypass -File "%~dp0reset-mysql-password.ps1"
pause
