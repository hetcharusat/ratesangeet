# Start both server and Expo web in separate new windows
$rootPath = $PSScriptRoot

Write-Host "🚀 Starting server and Expo web in separate windows..."

# Start server
$serverPath = Join-Path $rootPath "server"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$serverPath'; npm run dev"

# Wait a moment for server to initialize
Start-Sleep -Seconds 2

# Start Expo Web
$mobilePath = Join-Path $rootPath "mobile"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$mobilePath'; npm run web"

Write-Host "✅ Server and Expo Web started in separate windows"
Write-Host "   - Web will open in browser automatically"
Write-Host "   - Press Ctrl+C in each window to stop"
