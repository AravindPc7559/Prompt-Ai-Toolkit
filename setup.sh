#!/bin/bash

echo "🚀 Setting up Prompt Rewriter Extension..."

# Setup server
echo "📦 Setting up Node.js server..."
cd server
if [ ! -d "node_modules" ]; then
  npm install
  echo "✅ Server dependencies installed"
else
  echo "✅ Server dependencies already installed"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
  if [ -f "env.example" ]; then
    cp env.example .env
    echo "📝 Created .env file from env.example"
    echo "⚠️  Please edit server/.env and add your OPENAI_API_KEY"
  fi
else
  echo "✅ .env file already exists"
fi

cd ..

# Generate icons if they don't exist
if [ ! -f "extension/icons/icon16.png" ]; then
  echo "🎨 Generating extension icons..."
  cd extension
  node create-icons-simple.js
  cd ..
  echo "✅ Icons generated"
else
  echo "✅ Icons already exist"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit server/.env and add your OPENAI_API_KEY"
echo "2. Start the server: cd server && npm start"
echo "3. Load the extension in Chrome/Edge: chrome://extensions/ -> Load unpacked -> Select extension/ folder"
