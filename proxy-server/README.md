# A47L - Fireflies Transcript Sync App - Audio Proxy Server

**made with heart by [Atomic 47 Labs Inc](https://atomic47.co)**

A simple Express.js proxy server to bypass CORS restrictions when downloading audio files from Fireflies CDN.

## Why This Server?

Fireflies CDN uses signed URLs with CORS restrictions that block browser-based downloads. This proxy server runs locally and:
- Fetches audio files from Fireflies CDN on your behalf
- Streams them to your browser without CORS issues
- Enables automatic downloads directly to your organized meeting folders

## Installation

```bash
cd proxy-server
npm install
```

## Usage

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on **http://localhost:3001**

## API Endpoints

### `GET /health`
Health check endpoint to verify server is running.

**Response:**
```json
{
  "status": "ok",
  "message": "Proxy server is running"
}
```

### `GET /proxy/audio?url=<fireflies_audio_url>`
Proxy endpoint for downloading audio files.

**Parameters:**
- `url` (required) - The Fireflies CDN audio URL to proxy

**Example:**
```
http://localhost:3001/proxy/audio?url=https://cdn.fireflies.ai/.../audio.mp3?...
```

## How It Works

1. Frontend makes request to proxy server with Fireflies audio URL
2. Proxy server fetches the audio from Fireflies CDN (no CORS restrictions server-side)
3. Proxy server streams the audio back to the frontend
4. Frontend saves the audio file to your selected directory using File System Access API

## Troubleshooting

### Port Already in Use
If port 3001 is already in use, you can change it:

```bash
PORT=3002 npm start
```

Then update the frontend proxy URL in `EnhancedDashboard.tsx`:
```typescript
const proxyUrl = `http://localhost:3002/proxy/audio?url=${encodeURIComponent(meeting.audio_url)}`;
```

### CORS Errors
The proxy server is configured to allow requests from:
- http://localhost:5174 (Vite dev server)
- http://127.0.0.1:5174

If you change your frontend port, update the CORS configuration in `server.js`.

## Dependencies

- **express** - Web server framework
- **cors** - CORS middleware
- **node-fetch** - Fetch API for Node.js

## Security Notes

⚠️ This proxy server is designed for **local development only**. Do not deploy it to production or expose it to the internet as it:
- Has no authentication
- Allows proxying any URL passed to it
- Is intended for personal use with Fireflies API

For production use, implement proper authentication and URL validation.

