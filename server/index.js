import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, '../dist')));

// YouTube Data API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_BASE_URL = 'https://www.googleapis.com/youtube/v3';

/**
 * YouTube Endpoints - Simple music search!
 * No OAuth required for search functionality.
 */

// Search for music videos
app.get('/api/youtube/search', async (req, res) => {
  const { q, maxResults = 10 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    // If no API key, return mock results for demo
    if (!YOUTUBE_API_KEY) {
      console.log('No YouTube API key configured, returning mock results');
      return res.json({
        items: [
          {
            id: { videoId: 'dQw4w9WgXcQ' },
            snippet: {
              title: 'Rick Astley - Never Gonna Give You Up',
              thumbnails: { medium: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg' } }
            }
          },
          {
            id: { videoId: '9bZkp7q19f0' },
            snippet: {
              title: 'PSY - GANGNAM STYLE',
              thumbnails: { medium: { url: 'https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg' } }
            }
          },
          {
            id: { videoId: 'kJQP7kiw5Fk' },
            snippet: {
              title: 'Luis Fonsi - Despacito ft. Daddy Yankee',
              thumbnails: { medium: { url: 'https://img.youtube.com/vi/kJQP7kiw5Fk/mqdefault.jpg' } }
            }
          }
        ]
      });
    }

    const response = await axios.get(`${YOUTUBE_BASE_URL}/search`, {
      params: {
        part: 'snippet',
        q: q,
        type: 'video',
        videoCategoryId: '10', // Music category
        maxResults: maxResults,
        key: YOUTUBE_API_KEY
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('YouTube search error:', error.message);
    res.status(500).json({ error: 'Failed to search YouTube' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'BeatMaps server is running',
    provider: 'YouTube (No OAuth required for search!)'
  });
});

// Serve index.html for all non-API routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`🎵 BeatMaps server running on port ${PORT}`);
  console.log(`📍 Using Last.fm API - No OAuth complexity!`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
