# Setup Instructions

## Quick Start

Follow these steps to set up the Fireflies Downloader with proxy server:

### 1. Install Proxy Server Dependencies

```bash
cd /Users/davidolsson/ATOMIC47/fireflies-downloader/proxy-server
npm install
```

### 2. Install App Dependencies (if not already done)

```bash
cd /Users/davidolsson/ATOMIC47/fireflies-downloader/app
npm install
```

### 3. Make Start Script Executable

```bash
chmod +x /Users/davidolsson/ATOMIC47/fireflies-downloader/start.sh
```

## Running the Application

You have two options:

### Option A: Use the Startup Script (Recommended)

This starts both the proxy server and frontend app together:

```bash
cd /Users/davidolsson/ATOMIC47/fireflies-downloader
./start.sh
```

### Option B: Start Services Manually

**Terminal 1 - Proxy Server:**
```bash
cd /Users/davidolsson/ATOMIC47/fireflies-downloader/proxy-server
npm start
```

**Terminal 2 - Frontend App:**
```bash
cd /Users/davidolsson/ATOMIC47/fireflies-downloader/app
npm run dev
```

## Access the Application

Once running:
- **Frontend:** http://localhost:5174
- **Proxy Server:** http://localhost:3001

## How It Works

1. **Proxy Server (Port 3001)** - Bypasses CORS restrictions by fetching audio files from Fireflies CDN server-side
2. **Frontend App (Port 5174)** - Your React application that manages meetings and downloads

The proxy server is essential for downloading audio files automatically. Without it, audio downloads will fall back to creating download link text files.

## Stopping the Services

If using the startup script, press `Ctrl+C` to stop both services.

If running manually, press `Ctrl+C` in each terminal window.

## Troubleshooting

### Port Already in Use

If port 3001 or 5174 is already in use:

**For Proxy Server:**
```bash
PORT=3002 npm start
```
Then update the port in `app/src/components/EnhancedDashboard.tsx` line 152.

**For Frontend:**
Edit `app/vite.config.ts` and change the port number.

### Proxy Not Connecting

1. Verify proxy server is running: http://localhost:3001/health
2. Check for any error messages in the proxy server terminal
3. Ensure no firewall is blocking localhost connections

### Audio Downloads Still Failing

1. Check browser console for error messages
2. Verify proxy server is running on port 3001
3. Check proxy server logs for any errors
4. Try manually accessing: http://localhost:3001/health

