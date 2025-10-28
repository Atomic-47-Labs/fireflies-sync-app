import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: ['http://localhost:5174', 'http://127.0.0.1:5174'],
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

// Proxy endpoint for audio downloads
app.get('/proxy/audio', async (req, res) => {
  const audioUrl = req.query.url;

  if (!audioUrl) {
    console.error('❌ Missing audio URL parameter');
    return res.status(400).json({ error: 'Missing audio URL parameter' });
  }

  console.log('📥 Proxying audio download from:', audioUrl.substring(0, 100) + '...');

  try {
    // Fetch the audio file from Fireflies CDN
    const response = await fetch(audioUrl);

    console.log('📡 Fireflies response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });

    if (!response.ok) {
      console.error('❌ Failed to fetch audio:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error body:', errorText.substring(0, 500));
      return res.status(response.status).json({ 
        error: `Failed to fetch audio: ${response.statusText}`,
        details: errorText.substring(0, 200)
      });
    }

    // Get content type and length
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const contentLength = response.headers.get('content-length');

    console.log('✅ Starting stream - Content-Length:', contentLength, 'bytes');

    // Set appropriate headers for audio download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'attachment; filename="audio.mp3"');
    
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Enable CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

    let bytesTransferred = 0;

    // Pipe the audio stream to the response
    response.body.on('data', (chunk) => {
      bytesTransferred += chunk.length;
    });

    response.body.on('end', () => {
      console.log('✅ Stream completed - Total bytes:', bytesTransferred);
    });

    response.body.on('error', (error) => {
      console.error('❌ Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error', details: error.message });
      }
    });

    response.body.pipe(res);

  } catch (error) {
    console.error('❌ Proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to proxy audio download',
        details: error.message 
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to proxy audio downloads from Fireflies CDN`);
});

