import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import NavigationService from './services/NavigationService';
import { useVoiceNavigation } from './hooks/useVoiceNavigation';

// Configuration - Replace with your actual Spotify Client ID
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'your_spotify_client_id';

// Voice settings
const VOICE_SETTINGS = {
  enabled: true,
  volume: 1.0,
  rate: 1.0,
  pitch: 1.0
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [player, setPlayer] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentBPM, setCurrentBPM] = useState(120);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [nextInstruction, setNextInstruction] = useState(null);
  const [visualizerBars, setVisualizerBars] = useState(Array(12).fill(10));
  const [userLocation, setUserLocation] = useState([37.7749, -122.4194]);
  const [destination, setDestination] = useState(null);
  const [routeActive, setRouteActive] = useState(false);
  
  const beatIntervalRef = useRef(null);
  const mapContainerRef = useRef(null);
  const L = useRef(null);
  const locationWatchId = useRef(null);

  // Initialize voice navigation
  const { speak, stopSpeaking, speaking, currentAnnouncement } = useVoiceNavigation(VOICE_SETTINGS);

  // Handle Spotify Authentication
  useEffect(() => {
    const hash = window.location.hash;
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get('code');
    
    if (code) {
      // Note: In a production app, you should exchange this code for a token on your backend server
      // For demo purposes, we're storing the code and using it directly (not recommended for production)
      window.history.replaceState({}, document.title, window.location.pathname);
      localStorage.setItem('spotify_token', code);
      setSpotifyToken(code);
      setIsAuthenticated(true);
    } else if (hash) {
      const token = hash.substring(1).split('&').find(elem => elem.startsWith('access_token'))?.split('=')[1];
      if (token) {
        window.location.hash = '';
        localStorage.setItem('spotify_token', token);
        setSpotifyToken(token);
        setIsAuthenticated(true);
      }
    } else {
      const storedToken = localStorage.getItem('spotify_token');
      if (storedToken) {
        setSpotifyToken(storedToken);
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Initialize Map and Navigation Service
  useEffect(() => {
    if (!isAuthenticated || !mapContainerRef.current) return;

    const initMap = async () => {
      if (!L.current) {
        const leaflet = await import('leaflet');
        L.current = leaflet.default;
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const map = L.current.map(mapContainerRef.current).setView(userLocation, 13);
      
      L.current.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      // Add user location marker
      const userMarker = L.current.marker(userLocation).addTo(map);
      userMarker.bindPopup('You are here').openPopup();

      setMapInstance(map);
      NavigationService.init(map);

      // Subscribe to navigation updates
      const unsubscribe = NavigationService.subscribe((turn) => {
        if (turn) {
          setNextInstruction(turn);
          // Speak the instruction with beat sync
          if (syncEnabled && isPlaying) {
            setTimeout(() => {
              speak(`In ${Math.round(turn.distance)} meters, ${turn.text}`);
            }, 100);
          }
        }
      });

      return () => unsubscribe();
    };

    initMap();
  }, [isAuthenticated, syncEnabled, isPlaying, speak]);

  // Track user location
  useEffect(() => {
    if (!mapInstance || !routeActive) return;

    const startTracking = () => {
      if ('geolocation' in navigator) {
        locationWatchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const newLocation = [position.coords.latitude, position.coords.longitude];
            setUserLocation(newLocation);
            
            // Update map view
            if (mapInstance) {
              mapInstance.setView(newLocation, mapInstance.getZoom());
              
              // Check proximity to next turn
              const upcomingTurn = NavigationService.checkProximity(newLocation);
              if (upcomingTurn && syncEnabled && isPlaying) {
                speak(`Now, ${upcomingTurn.text}`);
              }
            }
          },
          (error) => console.error('Location error:', error),
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
      }
    };

    startTracking();

    return () => {
      if (locationWatchId.current) {
        navigator.geolocation.clearWatch(locationWatchId.current);
      }
    };
  }, [mapInstance, routeActive, syncEnabled, isPlaying, speak]);

  // Initialize Spotify Player
  useEffect(() => {
    if (!spotifyToken) return;

    const initSpotify = () => {
      window.onSpotifyWebPlaybackSDKReady = () => {
        const spotifyPlayer = new window.Spotify.Player({
          name: 'BeatMaps GPS',
          getOAuthToken: cb => cb(spotifyToken),
          volume: 0.5
        });

        spotifyPlayer.addListener('ready', ({ device_id }) => {
          console.log('Spotify Player Ready:', device_id);
          setDeviceId(device_id);
          fetchCurrentTrack(spotifyToken);
        });

        spotifyPlayer.addListener('not_ready', ({ device_id }) => {
          console.log('Device ID offline:', device_id);
        });

        spotifyPlayer.addListener('player_state_changed', state => {
          if (!state) return;
          const track = state.track_window.current_track;
          setCurrentTrack({
            name: track.name,
            artist: track.artists.map(a => a.name).join(', '),
            albumArt: track.album.images[0]?.url
          });
          setIsPlaying(!state.paused);
          
          if (track.id) {
            fetchTrackBPM(track.id, spotifyToken);
          }
        });

        spotifyPlayer.connect();
        setPlayer(spotifyPlayer);
      };

      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      document.body.appendChild(script);
    };

    initSpotify();
  }, [spotifyToken]);

  // Fetch current playing track
  const fetchCurrentTrack = async (token) => {
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setCurrentTrack({
            name: data.item.name,
            artist: data.item.artists.map(a => a.name).join(', '),
            albumArt: data.item.album.images[0]?.url
          });
          fetchTrackBPM(data.item.id, token);
        }
      }
    } catch (err) {
      console.error('Error fetching track:', err);
    }
  };

  // Fetch track BPM from Spotify
  const fetchTrackBPM = async (trackId, token) => {
    try {
      const res = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const features = await res.json();
        if (features.tempo) {
          const bpm = Math.round(features.tempo);
          setCurrentBPM(bpm);
        }
      }
    } catch (err) {
      console.error('Error fetching BPM:', err);
    }
  };

  // Calculate route using NavigationService
  const calculateRoute = async () => {
    if (!mapInstance) return;

    const dest = destination || [37.8049, -122.3694]; // Default destination
    
    try {
      await NavigationService.calculateRoute(userLocation, dest);
      setRouteActive(true);
      
      // Get first instruction
      const firstInstruction = NavigationService.getCurrentInstruction();
      if (firstInstruction) {
        setNextInstruction(firstInstruction);
        if (syncEnabled && isPlaying) {
          setTimeout(() => {
            speak(`Starting route. ${firstInstruction.text}`);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Route calculation failed:', error);
      speak('Unable to calculate route. Please check your connection.');
    }
  };

  // Beat Sync Logic
  const toggleSync = useCallback(() => {
    if (syncEnabled) {
      setSyncEnabled(false);
      if (beatIntervalRef.current) {
        clearInterval(beatIntervalRef.current);
        beatIntervalRef.current = null;
      }
      stopSpeaking();
    } else {
      setSyncEnabled(true);
      startBeatTimer();
    }
  }, [syncEnabled, currentBPM, stopSpeaking]);

  const startBeatTimer = () => {
    const msPerBeat = (60 / currentBPM) * 1000;
    
    if (beatIntervalRef.current) {
      clearInterval(beatIntervalRef.current);
    }

    beatIntervalRef.current = setInterval(() => {
      updateVisualizer();
    }, msPerBeat);
  };

  // Update visualizer bars
  const updateVisualizer = () => {
    setVisualizerBars(prev => 
      prev.map(() => Math.random() * 80 + 20)
    );
  };

  // Play/Pause Spotify
  const togglePlay = async () => {
    if (!deviceId) return;
    
    const token = localStorage.getItem('spotify_token');
    const endpoint = isPlaying ? 'pause' : 'play';
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/${endpoint}?device_id=${deviceId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsPlaying(!isPlaying);
    } catch (err) {
      console.error('Error toggling playback:', err);
    }
  };

  // Login handler
  const handleLogin = () => {
    const scope = 'user-modify-playback-state user-read-playback-state streaming user-read-currently-playing';
    const url = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(window.location.origin)}&scope=${encodeURIComponent(scope)}&show_dialog=false`;
    window.location.href = url;
  };

  // Set destination handler
  const handleSetDestination = () => {
    const lat = prompt('Enter destination latitude:', '37.8049');
    const lng = prompt('Enter destination longitude:', '-122.3694');
    
    if (lat && lng) {
      const newDest = [parseFloat(lat), parseFloat(lng)];
      setDestination(newDest);
      
      // Add marker for destination
      if (mapInstance && L.current) {
        L.current.marker(newDest).addTo(mapInstance).bindPopup('Destination');
      }
      
      calculateRoute();
    }
  };

  // Generate visualizer bars
  const renderVisualizer = () => (
    <div className="beat-visualizer">
      {visualizerBars.map((height, i) => (
        <div
          key={i}
          className="visualizer-bar"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="login-screen">
        <h1 className="login-title">Beat<span>Maps</span></h1>
        <p className="login-subtitle">
          Navigate to the rhythm. Turn-by-turn directions synchronized to your music's BPM.
        </p>
        <button className="login-btn" onClick={handleLogin}>
          Connect Spotify & Start
        </button>
        <p className="login-note">
          Note: Requires Spotify Premium for playback
        </p>
      </div>
    );
  }

  return (
    <div id="app">
      <div className="map-container" ref={mapContainerRef} id="map"></div>
      
      <div className="overlay-panel">
        <div className="panel-content">
          {/* Header */}
          <div className="header">
            <div className="logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
              </svg>
              Beat<span>Maps</span>
              <span className={`sync-badge ${syncEnabled ? 'active' : ''}`}>
                {syncEnabled ? 'SYNCED' : 'OFFLINE'}
              </span>
            </div>
            <div className="bpm-display">{currentBPM} BPM</div>
          </div>

          {/* Player Info */}
          <div className="player-section">
            <img 
              src={currentTrack?.albumArt || 'https://via.placeholder.com/70'} 
              alt="Album Art" 
              className="album-art"
            />
            <div className="track-info">
              <div className="track-name">{currentTrack?.name || 'Not Playing'}</div>
              <div className="artist-name">{currentTrack?.artist || 'Connect Spotify'}</div>
            </div>
          </div>

          {/* Beat Visualizer */}
          {renderVisualizer()}

          {/* Controls */}
          <div className="controls">
            <button 
              className="btn btn-primary" 
              onClick={togglePlay}
              disabled={!deviceId}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button 
              className={`btn ${syncEnabled ? 'btn-primary' : ''}`} 
              onClick={toggleSync}
              disabled={!deviceId || !currentTrack}
            >
              {syncEnabled ? 'Disable Sync' : 'Enable Beat Sync'}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleSetDestination}
            >
              {routeActive ? 'Change Route' : 'Set Destination'}
            </button>
          </div>

          {/* Navigation Instruction */}
          {nextInstruction && (
            <div className={`nav-instruction ${speaking ? 'speaking' : ''}`}>
              <div className="instruction-icon">🗺️</div>
              <div className="instruction-text">{nextInstruction.text}</div>
              <div className="instruction-distance">
                {Math.round(nextInstruction.distance)}m • {speaking ? '🔊 Announcing...' : 'Next turn'}
              </div>
            </div>
          )}

          {/* Speaking indicator */}
          {speaking && (
            <div className="speaking-indicator">
              🔊 Voice Navigation Active
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
