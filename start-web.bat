@echo off
echo ===================================================
echo               Starting Mirai IDE (Web)
echo ===================================================
echo.
echo Starting the frontend (Next.js) and backend (Flask)...
echo The application will be available at http://localhost:4000
echo.

:: Open the browser
start http://localhost:4000

:: Run the dev:noel command to start frontend and backend concurrently
call npm run dev:noel

pause
