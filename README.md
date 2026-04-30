# BeatMaps - GPS Navigation with Beat-Synchronized Directions

## Overview
BeatMaps is a GPS navigation app that synchronizes turn-by-turn directions to your music's BPM using Spotify.

## Deployment on Vercel

### Prerequisites
1. A Vercel account
2. A Spotify Developer account

### Setup Steps

#### 1. Configure Spotify Dashboard
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new application
3. Add the following Redirect URI:
   ```
   https://beatsmap.vercel.app/api/spotify/callback
   ```
4. Copy your **Client ID** and **Client Secret**

#### 2. Set Environment Variables in Vercel
In your Vercel project settings, add these environment variables:
- `SPOTIFY_CLIENT_ID` - Your Spotify Client ID
- `SPOTIFY_CLIENT_SECRET` - Your Spotify Client Secret
- `SPOTIFY_REDIRECT_URI` - `https://beatsmap.vercel.app/api/spotify/callback`

#### 3. Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Build the frontend
npm run build

# Deploy
vercel --prod
```

### Local Development

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Create `.env` file
Copy `.env.example` to `.env` and fill in your Spotify credentials:
```bash
cp .env.example .env
```

#### 3. Run Development Server
```bash
# Terminal 1: Start backend server
npm run server

# Terminal 2: Start frontend (in another terminal)
npm run dev
```

The app will be available at `http://localhost:5173` (frontend) and `http://localhost:3001` (backend).

## How It Works

### OAuth Flow
1. User clicks "Connect Spotify"
2. Frontend calls `/api/spotify/login` endpoint
3. Backend generates auth URL with `response_type=code` (Authorization Code Flow)
4. User authorizes on Spotify
5. Spotify redirects to `/api/spotify/callback` with authorization code
6. Backend exchanges code for access token
7. Token is passed to frontend via URL hash
8. Frontend stores token and initializes Spotify Web Playback SDK

### Features
- **Beat Sync**: Visualizer pulses to your music's BPM
- **Voice Navigation**: Turn-by-turn directions synchronized with beats
- **Real-time Tracking**: Live location updates
- **Spotify Integration**: Full playback control

## Project Structure
```
/workspace
├── api/                  # Vercel serverless functions
│   └── index.js         # Express app for API routes
├── server/              # Local development server
│   └── index.js
├── src/                 # React frontend source
│   ├── App.jsx
│   ├── services/
│   └── hooks/
├── dist/                # Built frontend (for Vercel static hosting)
├── vercel.json          # Vercel configuration
└── package.json
```

## Troubleshooting

### 404 Error on /api/spotify/login
- Ensure environment variables are set in Vercel
- Check that `api/index.js` exists and is properly configured
- Verify `vercel.json` rewrites are correct

### "response_type must be code" Error
- This app uses Authorization Code Flow (required for production)
- Ensure your Spotify Dashboard has the correct Redirect URI
- The backend handles the OAuth flow, not the frontend

### CORS Issues
- The backend includes CORS headers
- For local development, ensure both frontend and backend are running

## License
MIT
