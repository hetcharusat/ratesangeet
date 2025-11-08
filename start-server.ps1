# Start the Express server in a new PowerShell window
$serverPath = Join-Path $PSScriptRoot "server"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverPath'; npm run dev"
Write-Host "✅ Server started in a new window"
