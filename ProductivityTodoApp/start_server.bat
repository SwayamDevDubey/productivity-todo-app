@echo off
echo Starting local server for Productivity Todo App...
echo.
echo Your app will be available at:
echo http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
python -m http.server 8000
pause
