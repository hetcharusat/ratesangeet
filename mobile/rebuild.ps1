# Rebuild app with deep link configuration
Write-Host "🔧 Rebuilding app with deep link fix..." -ForegroundColor Green
Write-Host ""

# Navigate to mobile directory
Set-Location "C:\Users\hetp2\OneDrive\Desktop\spotiireate\mobile"

# Clean and rebuild
Write-Host "1. Cleaning previous build..." -ForegroundColor Yellow
npx expo prebuild --clean

Write-Host ""
Write-Host "2. Building for Android..." -ForegroundColor Yellow
npx expo run:android

Write-Host ""
Write-Host "✅ Done! App should open with deep link support." -ForegroundColor Green
Write-Host ""
Write-Host "⚠️ NEXT STEP: Add ratesangeet://callback to Spotify Dashboard" -ForegroundColor Cyan
Write-Host "   https://developer.spotify.com/dashboard" -ForegroundColor Gray
