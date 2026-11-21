@echo off
echo ========================================
echo   UniStock - Uniform Shop Inventory
echo ========================================
echo.
echo Starting backend server on port 5000...
start "UniStock Backend" cmd /k "cd /d D:\INVENTERY\server && node index.js"

timeout /t 3 /nobreak >nul

echo Starting frontend on port 3000 (network accessible)...
start "UniStock Frontend" cmd /k "cd /d D:\INVENTERY\client && npx vite --host"

timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo  App running at:
echo  Local:   http://localhost:3000
echo  Network: check frontend terminal for IP
echo  (Other devices use the Network address)
echo ========================================
start http://localhost:3000
