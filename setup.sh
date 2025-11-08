#!/bin/bash

echo "🎵 Spotify Music Tracker Setup"
echo "================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check MongoDB
if ! command -v mongod &> /dev/null; then
    echo "⚠️  MongoDB not found. Make sure MongoDB is installed and running."
    echo "   Or use MongoDB Atlas (cloud) by updating MONGODB_URI in server/.env"
else
    echo "✅ MongoDB detected"
fi

echo ""
echo "📦 Installing dependencies..."
npm run install:all

echo ""
echo "⚙️  Setting up environment files..."

# Create .env if it doesn't exist
if [ ! -f server/.env ]; then
    cp server/.env.example server/.env
    echo "✅ Created server/.env - Please update with your Spotify credentials"
else
    echo "ℹ️  server/.env already exists"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update server/.env with your Spotify Client ID and Secret"
echo "2. Update mobile/src/config/index.ts with your local IP address"
echo "3. Run 'npm run dev' to start both server and mobile app"
echo ""
echo "📖 See README.md for detailed instructions"
echo "🚀 See QUICKSTART.md for a quick guide"
