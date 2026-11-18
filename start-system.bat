@echo off
title Attendance Management System Launcher
echo ========================================================
echo  Checking & Starting Attendance Management System Services
echo ========================================================

echo [1/3] Ensuring PostgreSQL 18 is running...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-postgres.ps1"

echo.
echo [2/3] Checking Backend API on port 5000...
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo Starting Backend API...
    start "Attendance Backend" cmd /k "cd /d %~dp0backend && npm run dev"
) else (
    echo Backend is already running on http://localhost:5000.
)

echo.
echo [3/3] Checking Frontend Dev Server on port 5173...
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul
if %errorlevel% neq 0 (
    echo Starting Frontend...
    start "Attendance Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
) else (
    echo Frontend is already running on http://localhost:5173.
)

echo.
echo ========================================================
echo  System is Ready!
echo  Open http://localhost:5173 in your browser to sign in.
echo ========================================================
pause
