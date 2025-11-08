@echo off
echo 🎵 Spotify Music Tracker Setup
echo ================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    exit /b 1
)

echo ✅ Node.js detected
echo.

where mongod >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  MongoDB not found. Make sure MongoDB is installed and running.
    echo    Or use MongoDB Atlas (cloud^) by updating MONGODB_URI in server/.env
) else (
    echo ✅ MongoDB detected
)

echo.
echo 📦 Installing dependencies...
call npm run install:all

echo.
echo ⚙️  Setting up environment files...

if not exist server\.env (
    copy server\.env.example server\.env >nul
    echo ✅ Created server/.env - Please update with your Spotify credentials
) else (
    echo ℹ️  server/.env already exists
)

echo.
echo ✨ Setup complete!
echo.
echo Next steps:
echo 1. Update server/.env with your Spotify Client ID and Secret
echo 2. Update mobile/src/config/index.ts with your local IP address
echo 3. Run 'npm run dev' to start both server and mobile app
echo.
echo 📖 See README.md for detailed instructions
echo 🚀 See QUICKSTART.md for a quick guide
pause
