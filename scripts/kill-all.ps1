# PowerShell script to kill stray electron processes and free ports
Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'main.py' } | Stop-Process -Force
npx kill-port 4000 3000 8000
