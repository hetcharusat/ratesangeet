# Start Expo mobile in a new PowerShell window
$mobilePath = Join-Path $PSScriptRoot "mobile"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$mobilePath'; npm run start"
Write-Host "✅ Expo mobile started in a new window (you can press w, a, r, etc.)"
