# 🎵 BeatMaps - Last.fm Integration

## Why Last.fm Instead of Spotify?

**Last.fm is MUCH easier to configure!** No OAuth complexity, no redirect URIs, no token expiration issues.

### Key Benefits:
- ✅ **No OAuth flow required** - Just an API key
- ✅ **No user authentication redirects** - Users just enter their username
- ✅ **No token management** - API key works forever
- ✅ **Free and open** - Generous rate limits for personal projects
- ✅ **Rich music data** - Access listening history, top artists, tracks, and tags

---

## Setup Instructions

### 1. Get Your Last.fm API Key (2 minutes!)

1. Go to: https://www.last.fm/api/account/create
2. Fill in the form:
   - **Application name**: BeatMaps (or your choice)
   - **Description**: A music-based navigation app
   - **Homepage**: Can be `http://localhost:3000` for development
   - **Callback URL**: Leave blank (not needed!)
3. Click "Submit"
4. Copy your **API Key** (also called "Account Number")

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Backend (.env)
LASTFM_API_KEY=your_api_key_here

# Frontend (.env or .env.local for Vite)
VITE_LASTFM_API_KEY=your_api_key_here

PORT=3001
```

### 3. Install Dependencies & Run

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Start backend server
node server/index.js
```

### 4. Use the App!

1. Open http://localhost:3000
2. Click "Connect Last.fm & Start"
3. Enter your Last.fm username
4. Done! No redirects, no popups!

---

## API Endpoints

All endpoints are proxied through the backend to hide your API key:

- `GET /api/lastfm/user?username={username}` - Get user profile
- `GET /api/lastfm/top-artists?username={username}` - Get top artists
- `GET /api/lastfm/top-tracks?username={username}` - Get top tracks
- `GET /api/lastfm/artist?artist={name}` - Get artist info
- `GET /api/lastfm/artist-top-tags?artist={name}` - Get artist tags
- `GET /api/lastfm/search-tracks?track={name}` - Search tracks

---

## Deployment (Vercel)

1. Push code to GitHub
2. Connect repo to Vercel
3. Add environment variable in Vercel dashboard:
   - `LASTFM_API_KEY` = your_api_key_here
4. Deploy!

That's it! No need to configure redirect URIs or callback URLs.

---

## Comparison: Spotify vs Last.fm

| Feature | Spotify | Last.fm |
|---------|---------|---------|
| **Setup Time** | 30+ minutes | 2 minutes |
| **OAuth Required** | ✅ Yes (complex) | ❌ No |
| **Token Management** | ✅ Yes (expires) | ❌ No |
| **Redirect URIs** | ✅ Required | ❌ Not needed |
| **User Login Flow** | Multiple redirects | Simple username input |
| **Playback Control** | ✅ Yes | ❌ Read-only |
| **Listening History** | Limited | ✅ Extensive |

**Trade-off**: Last.fm doesn't allow playback control, but provides richer listening history data and is infinitely easier to set up!

---

## Troubleshooting

### "Invalid API Key" error
- Double-check your API key in `.env`
- Make sure both `LASTFM_API_KEY` and `VITE_LASTFM_API_KEY` are set

### "User not found" error
- Verify the Last.fm username is correct
- User must have a public Last.fm profile

### Rate limiting
- Last.fm allows ~5 requests/second
- For production, consider caching responses

---

## Resources

- [Last.fm API Documentation](https://www.last.fm/api)
- [Get API Account](https://www.last.fm/api/account/create)
- [API Response Examples](https://www.last.fm/api/show/user.getInfo)
