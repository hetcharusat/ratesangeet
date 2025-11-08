# Start both server and Expo mobile in separate new windows
$rootPath = $PSScriptRoot

Write-Host "🚀 Starting server and Expo mobile in separate windows..."

# Start server
$serverPath = Join-Path $rootPath "server"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverPath'; npm run dev"

# Wait a moment for server to initialize
Start-Sleep -Seconds 2

# Start Expo
$mobilePath = Join-Path $rootPath "mobile"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$mobilePath'; npm run start"

Write-Host "✅ Server and Expo started in separate windows"
Write-Host "   - Focus the Expo window and press 'w' for web, 'a' for Android, etc."
Write-Host "   - Press Ctrl+C in each window to stop"
