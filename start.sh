#!/bin/bash

# Fireflies Downloader Startup Script
# Starts both the proxy server and the frontend app

echo "🚀 Starting Fireflies Downloader..."
echo ""

# Check if proxy-server node_modules exists
if [ ! -d "proxy-server/node_modules" ]; then
  echo "📦 Installing proxy server dependencies..."
  cd proxy-server
  npm install
  cd ..
  echo ""
fi

# Check if app node_modules exists
if [ ! -d "app/node_modules" ]; then
  echo "📦 Installing app dependencies..."
  cd app
  npm install
  cd ..
  echo ""
fi

echo "Starting services..."
echo ""

# Start proxy server in background
echo "🔧 Starting proxy server on http://localhost:3001..."
cd proxy-server
npm start &
PROXY_PID=$!
cd ..

# Wait a moment for proxy to start
sleep 2

# Start frontend app
echo "🌐 Starting frontend app on http://localhost:5174..."
cd app
npm run dev &
APP_PID=$!
cd ..

echo ""
echo "✅ All services started!"
echo ""
echo "📡 Proxy Server: http://localhost:3001"
echo "🌐 Frontend App: http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for user to stop
wait $PROXY_PID $APP_PID

