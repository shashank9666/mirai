# PowerShell script to kill stray node and electron processes and free ports 3000,3001,4000
# Kill all node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
# Kill all electron processes
Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force
# Ensure ports are free
npx kill-port 3000 3001 4000
