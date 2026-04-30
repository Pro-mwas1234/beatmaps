# BeatMaps - Rhythmic GPS Navigation

Navigate to the rhythm! BeatMaps synchronizes your turn-by-turn directions with the BPM of your music, ensuring you never miss a beat while driving.

## 🎯 Key Features

- **🗺️ OpenStreetMap + Leaflet**: Completely free, open-source mapping with no API keys required
- **🎵 Spotify Integration**: Legal, ad-free music streaming for Premium users
- **🥁 Real-time BPM Detection**: Fetches actual tempo data from Spotify's audio features API
- **🎤 Beat-Synced Voice Directions**: Navigation instructions timed to hit exactly on the beat
- **📊 Dynamic Visualizer**: Animated bars that pulse to your music's tempo
- **🚗 Car-Optimized UI**: Large controls, dark mode, and minimal distractions

## 🛠️ Tech Stack

### Frontend
- **React** (v18) - Modern UI framework
- **Vite** - Fast build tool and dev server
- **Leaflet** - Open-source mapping library
- **OpenStreetMap** - Free, community-driven map data
- **CartoDB Dark Matter** - Beautiful dark theme tiles
- **Spotify Web Playback SDK** - Official Spotify integration

### Backend (Optional)
- **Express.js** - Lightweight Node.js server
- **Axios** - HTTP client for API requests

## 📋 Prerequisites

1. **Node.js** (v16 or higher)
2. **Spotify Developer Account** (free)
3. **Spotify Premium Account** (for playback features)

## 🔑 Setup Instructions

### Step 1: Get Your Spotify API Key

#### Spotify
1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Click "Create App"
3. Fill in app details:
   - **Name**: BeatMaps
   - **Description**: Rhythmic GPS Navigation
   - **Redirect URI**: `http://localhost:3000` (for development)
4. Save and copy your **Client ID**

#### OpenStreetMap
No API key needed! OpenStreetMap is completely free and open-source.

### Step 2: Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Spotify Client ID:

```env
VITE_SPOTIFY_CLIENT_ID=your_actual_spotify_client_id_here
# OpenStreetMap requires no API key!
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Run the Application

#### Development Mode (Frontend Only)
```bash
npm run dev
```

This starts the Vite dev server at `http://localhost:3000`

#### With Backend Server (Optional - for production)
```bash
# Terminal 1 - Start frontend
npm run dev

# Terminal 2 - Start backend
npm run server
```

## 🎮 How to Use

1. **Open the App**: Navigate to `http://localhost:3000`

2. **Connect Spotify**: 
   - Click "Connect Spotify & Start"
   - Log in with your Spotify Premium account
   - Authorize the app

3. **Start Playing Music**:
   - Click "Play" to start playback
   - Your current track will appear with album art

4. **Enable Beat Sync**:
   - Click "Enable Beat Sync"
   - The app fetches the BPM of your current track
   - Visualizer bars pulse to the beat

5. **Navigate**:
   - A demo route is automatically loaded
   - Turn instructions will speak ON THE BEAT
   - Watch the visualizer sync to your music!

## 🎵 Why Spotify Over YouTube?

| Feature | Spotify | YouTube |
|---------|---------|---------|
| **Legal Compliance** | ✅ Official API, ToS compliant | ❌ Ad-blocking violates ToS |
| **Ad-Free** | ✅ Yes (Premium) | ❌ Requires ad-blocker |
| **BPM Data** | ✅ Direct API access | ❌ Requires audio analysis |
| **Audio Quality** | ✅ Up to 320kbps | ⚠️ Variable |
| **Offline Support** | ✅ Possible with Premium | ❌ Limited |
| **Car Integration** | ✅ Spotify Connect | ❌ Limited |

## 🗺️ Why OpenStreetMap Over Google Maps?

| Feature | OpenStreetMap | Google Maps |
|---------|---------------|-------------|
| **Cost** | ✅ 100% Free, no limits | ❌ Requires credit card, pay-per-use |
| **Privacy** | ✅ No tracking, community-driven | ⚠️ Data collection concerns |
| **Customization** | ✅ Full control via Leaflet | ⚠️ Limited customization |
| **Setup Complexity** | ✅ Zero configuration | ⚠️ Complex billing setup |
| **API Key Required** | ✅ None! | ❌ Required |
| **Offline Support** | ✅ Possible with self-hosting | ❌ Limited |

## 🏗️ Project Structure

```
beatmaps/
├── public/
│   └── beat.svg              # App icon
├── src/
│   ├── App.jsx               # Main React component
│   ├── App.css               # Component styles
│   ├── index.css             # Global styles
│   └── main.jsx              # Entry point
├── server/
│   └── index.js              # Express backend (optional)
├── .env                      # Environment variables (create this)
├── .env.example              # Template for .env
├── index.html                # HTML entry point
├── package.json              # Dependencies
├── vite.config.js            # Vite configuration
└── README.md                 # This file
```

## 🔧 Customization

### Change Map Location
Edit `src/App.jsx`, find the `simulateRoute` function:

```javascript
const start = L.current.latLng(37.7749, -122.4194); // San Francisco
const end = L.current.latLng(37.8049, -122.3694);
```

Replace with your city's coordinates.

### Adjust Visualizer
Modify the number of bars in `renderVisualizer()`:

```javascript
useState(Array(12).fill(10)) // Change 12 to any number
```

### Customize Colors
Edit CSS variables in `src/index.css`:

```css
:root {
  --primary: #1DB954;      /* Spotify green */
  --accent: #ff4757;       /* Beat highlight */
  --dark: #121212;         /* Background */
}
```

## 🚀 One-Click Deployment

Deploy BeatMaps to your favorite platform with a single click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/pro-mwas1234/beatmaps&env=SPOTIFY_CLIENT_ID&envDescription=Spotify%20Client%20ID%20from%20developer%20dashboard&envLink=https://developer.spotify.com/dashboard)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?repository=https://github.com/pro-mwas1234/beatmaps&envs=SPOTIFY_CLIENT_ID&SPOTIFY_CLIENT_IDDesc=Spotify%20Client%20ID%20from%20developer%20dashboard)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/pro-mwas1234/beatmaps)

[![Deploy to Koyeb](https://www.koyeb.com/static/images/deploy/button.svg)](https://app.koyeb.com/deploy?type=git&repository=github.com/pro-mwas1234/beatmaps&branch=main&name=beatmaps)

### Platform-Specific Instructions

#### Vercel
1. Click the "Deploy with Vercel" button above
2. Connect your GitHub account
3. Set environment variable: `SPOTIFY_CLIENT_ID`
4. Deploy! Your app will be live at `https://your-app.vercel.app`

**Important**: After deployment, update your Spotify Dashboard Redirect URI to include your new Vercel URL (e.g., `https://your-app.vercel.app`)

#### Railway
1. Click the "Deploy on Railway" button above
2. Connect your GitHub repository
3. Add environment variable: `SPOTIFY_CLIENT_ID`
4. Deploy! Railway will provide you with a public URL

**Important**: Update your Spotify Dashboard Redirect URI with your Railway URL

#### Render
1. Click the "Deploy to Render" button above
2. Sign in or create a Render account
3. Configure environment variables: `SPOTIFY_CLIENT_ID`
4. Deploy! Get your public URL from the Render dashboard

**Important**: Add your Render URL to Spotify Dashboard Redirect URIs

#### Koyeb
1. Click the "Deploy to Koyeb" button above
2. Authorize Koyeb to access your GitHub
3. Select your repository and branch
4. Add environment variable: `SPOTIFY_CLIENT_ID`
5. Deploy! Koyeb will automatically detect and configure your app

**Important**: Update Spotify Dashboard with your Koyeb app URL as Redirect URI

### Setting Up Spotify Redirect URIs

After deploying to any platform, you **must** update your Spotify Developer Dashboard:

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Select your BeatMaps app
3. Click "Edit Settings"
4. Add your deployment URL to **Redirect URIs**:
   - Vercel: `https://your-app.vercel.app`
   - Railway: `https://your-app.railway.app`
   - Render: `https://your-app.onrender.com`
   - Koyeb: `https://your-app.koyeb.app`
5. Click "Save"

## 🏗️ Manual Deployment

## ⚠️ Important Notes

1. **Spotify Premium Required**: The Web Playback SDK only works with Premium accounts
2. **HTTPS Required in Production**: Spotify requires HTTPS for callback URLs
3. **CORS Limitations**: Some features work best with the backend proxy
4. **Browser Support**: Works best in Chrome, Firefox, and Edge

## 🐛 Troubleshooting

### "Device ID has gone offline"
- Make sure you're logged into Spotify Premium
- Try refreshing the page
- Check browser console for errors

### Map not loading
- Check your internet connection
- OpenStreetMap tiles are served by CartoDB - ensure no firewall blocking
- Try a different browser

### BPM not showing
- Make sure a track is actually playing
- Check that your Spotify token hasn't expired
- Try re-authenticating

## 📝 Future Enhancements

- [ ] Real-time location tracking with Geolocation API
- [ ] Route calculation based on user's actual position
- [ ] Audio ducking (lower music volume during instructions)
- [ ] Multiple routing options (fastest, scenic, etc.)
- [ ] Playlist integration with BPM-based song suggestions
- [ ] Offline mode with cached maps
- [ ] Apple Music integration
- [ ] Android/iOS native apps

## 📄 License

MIT License - Feel free to use this for personal or commercial projects!

## 🙏 Acknowledgments

- [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk/)
- [Leaflet](https://leafletjs.com/)
- [OpenStreetMap](https://www.openstreetmap.org/)
- [CartoDB Dark Matter Tiles](https://carto.com/help/carto-basemaps/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)

---

**Built with ❤️ and 🎵** | Navigate to the rhythm!
