import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory store for auth codes (in production, use a database)
const authCodes = new Map();

// Spotify OAuth configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'https://beatsmap.vercel.app/api/spotify/callback';

// Generate random string for state parameter
function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Spotify login endpoint - generates auth URL with response_type=code
app.get('/api/spotify/login', (req, res) => {
  const state = generateRandomString(16);
  const scope = 'user-modify-playback-state user-read-playback-state streaming user-read-currently-playing';
  
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('client_id', SPOTIFY_CLIENT_ID);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', SPOTIFY_REDIRECT_URI);
  authUrl.searchParams.append('scope', scope);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('show_dialog', 'false');
  
  // Store state for validation later (in production, use sessions or Redis)
  authCodes.set(state, { timestamp: Date.now() });
  
  res.json({ authUrl: authUrl.toString() });
});

// Spotify callback endpoint - exchanges code for access token
app.get('/api/spotify/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }
  
  if (!state || !authCodes.has(state)) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }
  
  // Clean up used state
  authCodes.delete(state);
  
  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // Redirect back to app with token in hash (for frontend to pick up)
    res.redirect(`/#access_token=${access_token}&refresh_token=${refresh_token}&expires_in=${expires_in}`);
  } catch (error) {
    console.error('Error exchanging code for token:', error.response?.data || error.message);
    res.redirect(`/?error=${encodeURIComponent('Failed to get access token')}`);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BeatMaps server is running' });
});

// Vercel serverless function handler
export default async function handler(req, res) {
  // Pass the request to Express app
  app(req, res);
}

export const config = {
  api: {
    bodyParser: true,
  },
};
