@echo off
cd /d "%~dp0"
echo Starting SIH AI Detection FastAPI Backend on port 8000...

if exist "..\rgb_survivor\.venv\Scripts\python.exe" (
    "..\rgb_survivor\.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000
) else if exist "D:\SIH\rgb_survivor\.venv\Scripts\python.exe" (
    "D:\SIH\rgb_survivor\.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000
) else (
    python -m uvicorn main:app --host 0.0.0.0 --port 8000
)
pause
