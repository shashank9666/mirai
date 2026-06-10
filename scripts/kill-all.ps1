# PowerShell script to kill stray node and electron processes and free ports
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'main.py' } | Stop-Process -Force
npx kill-port 3000 3001 4000 8000
