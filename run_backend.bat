@echo off
echo Iniciando backend...
cd backend
uvicorn main:app --reload --host 0.0.0.0
pause
