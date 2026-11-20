@echo off
cd /d "%~dp0"
start "" "http://localhost:5173"
call npm.cmd run dev -- --port 5173 --host
