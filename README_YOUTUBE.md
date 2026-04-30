# 🎵 BeatMaps - YouTube Music Navigation

Navigate to the rhythm with beat-synchronized voice navigation!

## ✨ Features

- **YouTube Music Integration** - Search and play music directly from YouTube
- **Beat-Sync Navigation** - Voice instructions timed to your music's BPM
- **Real-time Visualizer** - Animated bars that pulse with the beat
- **Playlist Management** - Create and manage your navigation soundtrack
- **Offline Support** - Works without API keys (uses demo tracks)

## 🚀 Quick Start

### No Configuration Required!

The app works out of the box with demo tracks. Just:

```bash
npm run build
node server/index.js
```

Then open http://localhost:3001

### Optional: Enable Real YouTube Search

To enable real YouTube search (instead of demo tracks):

1. Get a free YouTube Data API key from [Google Cloud Console](https://console.cloud.google.com/)
2. Create `.env` file:
   ```bash
   YOUTUBE_API_KEY=your_api_key_here
   PORT=3001
   ```
3. Restart the server

## 🎮 How to Use

1. **Search for Music** - Type a song name and click Search
2. **Add to Playlist** - Click on search results to add them
3. **Play Music** - Click Play to start your playlist
4. **Enable Beat Sync** - Toggle sync to match navigation to the beat
5. **Set Destination** - Enter coordinates for your route
6. **Navigate!** - Voice instructions will announce on the beat

## 🛠️ Tech Stack

- **Frontend**: React + Vite
- **Music**: YouTube IFrame API (no OAuth!)
- **Maps**: Leaflet + OpenStreetMap
- **Navigation**: OSRM routing service
- **Backend**: Express.js

## 📝 Notes

- **No OAuth complexity** - Unlike Spotify, YouTube search doesn't require user authentication
- **Demo mode available** - App works without API key using built-in demo tracks
- **BPM estimation** - Currently simulated based on genre; can be enhanced with audio analysis

## 🔧 Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
node server/index.js
```

## 🌐 Deployment

### Vercel

The app is configured for Vercel deployment:

1. Push to GitHub
2. Import project in Vercel
3. Add `YOUTUBE_API_KEY` environment variable (optional)
4. Deploy!

### Docker

```bash
docker-compose up --build
```

## 📄 License

MIT
