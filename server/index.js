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

// Last.fm API configuration (NO OAuth needed!)
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

/**
 * Last.fm Endpoints - Much simpler than Spotify!
 * No OAuth flow required for public data. Just pass the API key.
 */

// Get user info
app.get('/api/lastfm/user', async (req, res) => {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'user.getInfo',
        user: username,
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });

    if (response.data.error) {
      return res.status(400).json({ error: response.data.message });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Last.fm user info error:', error.message);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// Get user's top artists
app.get('/api/lastfm/top-artists', async (req, res) => {
  const { username, limit = 50, page = 1, period = 'overall' } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'user.getTopArtists',
        user: username,
        api_key: LASTFM_API_KEY,
        limit: limit,
        page: page,
        period: period,
        format: 'json'
      }
    });

    if (response.data.error) {
      return res.status(400).json({ error: response.data.message });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Last.fm top artists error:', error.message);
    res.status(500).json({ error: 'Failed to fetch top artists' });
  }
});

// Get user's top tracks
app.get('/api/lastfm/top-tracks', async (req, res) => {
  const { username, limit = 50, page = 1, period = 'overall' } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'user.getTopTracks',
        user: username,
        api_key: LASTFM_API_KEY,
        limit: limit,
        page: page,
        period: period,
        format: 'json'
      }
    });

    if (response.data.error) {
      return res.status(400).json({ error: response.data.message });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Last.fm top tracks error:', error.message);
    res.status(500).json({ error: 'Failed to fetch top tracks' });
  }
});

// Get artist info (includes tags, similar artists, etc.)
app.get('/api/lastfm/artist', async (req, res) => {
  const { artist } = req.query;
  
  if (!artist) {
    return res.status(400).json({ error: 'Artist name is required' });
  }

  try {
    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'artist.getInfo',
        artist: artist,
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });

    if (response.data.error) {
      return res.status(400).json({ error: response.data.message });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Last.fm artist info error:', error.message);
    res.status(500).json({ error: 'Failed to fetch artist info' });
  }
});

// Get artist's top tags (for genre mapping)
app.get('/api/lastfm/artist-top-tags', async (req, res) => {
  const { artist } = req.query;
  
  if (!artist) {
    return res.status(400).json({ error: 'Artist name is required' });
  }

  try {
    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'artist.getTopTags',
        artist: artist,
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });

    if (response.data.error) {
      return res.status(400).json({ error: response.data.message });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Last.fm artist tags error:', error.message);
    res.status(500).json({ error: 'Failed to fetch artist tags' });
  }
});

// Search tracks
app.get('/api/lastfm/search-tracks', async (req, res) => {
  const { track, artist, limit = 30 } = req.query;
  
  if (!track) {
    return res.status(400).json({ error: 'Track name is required' });
  }

  try {
    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'track.search',
        track: track,
        artist: artist || '',
        api_key: LASTFM_API_KEY,
        limit: limit,
        format: 'json'
      }
    });

    if (response.data.error) {
      return res.status(400).json({ error: response.data.message });
    }

    res.json(response.data);
  } catch (error) {
    console.error('Last.fm track search error:', error.message);
    res.status(500).json({ error: 'Failed to search tracks' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'BeatMaps server is running',
    provider: 'Last.fm (No OAuth required!)'
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
