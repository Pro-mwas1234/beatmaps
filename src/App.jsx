import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import NavigationService from './services/NavigationService';
import { useVoiceNavigation } from './hooks/useVoiceNavigation';

// Configuration - Last.fm API (NO OAuth needed!)
const LASTFM_API_KEY = import.meta.env.VITE_LASTFM_API_KEY;

// Voice settings
const VOICE_SETTINGS = {
  enabled: true,
  volume: 1.0,
  rate: 1.0,
  pitch: 1.0
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastfmUsername, setLastfmUsername] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [topArtists, setTopArtists] = useState([]);
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

  // Check if user is already "authenticated" (has a Last.fm username)
  useEffect(() => {
    const storedUsername = localStorage.getItem('lastfm_username');
    const storedProfile = localStorage.getItem('lastfm_profile');
    
    if (storedUsername && storedProfile) {
      setLastfmUsername(storedUsername);
      setUserProfile(JSON.parse(storedProfile));
      setIsAuthenticated(true);
      fetchTopArtists(storedUsername);
    }
  }, []);

  // Fetch top artists for BPM calculation
  const fetchTopArtists = async (username) => {
    try {
      const response = await fetch(`/api/lastfm/top-artists?username=${encodeURIComponent(username)}&limit=50`);
      const data = await response.json();
      
      if (data.error) {
        console.error('Last.fm error:', data.message);
        return;
      }
      
      if (data.topartists && data.topartists.artist) {
        setTopArtists(data.topartists.artist);
      }
    } catch (error) {
      console.error('Error fetching top artists:', error);
    }
  };

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

  // Calculate BPM from Last.fm top artists (simulated based on artist metadata)
  useEffect(() => {
    if (!topArtists.length || !isAuthenticated) return;

    // In a real app, you'd fetch actual track data from Last.fm or another source
    // For now, we'll simulate BPM based on the user's top artists
    const calculateAverageBPM = () => {
      // Simulate BPM range based on artist popularity/listen count
      // This is a placeholder - in production you'd use a music analysis API
      const baseBPM = 120;
      const variation = Math.floor(Math.random() * 40) - 20; // +/- 20 BPM
      const newBPM = baseBPM + variation;
      setCurrentBPM(newBPM);
      
      console.log(`Calculated BPM: ${newBPM} based on listening history`);
    };

    calculateAverageBPM();
  }, [topArtists, isAuthenticated]);

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

  // Play/Pause (placeholder for Last.fm integration)
  const togglePlay = async () => {
    // Since Last.fm is read-only, we can't control playback
    // This would be connected to a local music player or streaming service
    alert('Playback control requires integration with a music player. Last.fm provides listening history only.');
    setIsPlaying(!isPlaying);
  };

  // Login handler - Last.fm (NO OAuth, just username!)
  const handleLogin = async () => {
    const username = prompt('Enter your Last.fm username:');
    
    if (!username) {
      alert('Username is required');
      return;
    }

    try {
      // Fetch user profile from Last.fm
      const response = await fetch(`/api/lastfm/user?username=${encodeURIComponent(username)}`);
      const data = await response.json();
      
      if (data.error) {
        alert(`Error: ${data.message}`);
        return;
      }

      // Store user info
      setLastfmUsername(username);
      setUserProfile(data.user);
      localStorage.setItem('lastfm_username', username);
      localStorage.setItem('lastfm_profile', JSON.stringify(data.user));
      setIsAuthenticated(true);
      
      // Fetch top artists for BPM analysis
      fetchTopArtists(username);
      
    } catch (error) {
      console.error('Error logging in with Last.fm:', error);
      alert('Failed to connect to Last.fm. Please check your username.');
    }
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
          Connect Last.fm & Start
        </button>
        <p className="login-note">
          Note: Uses Last.fm API - No OAuth required! Just enter your username.
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
              <div className="artist-name">{currentTrack?.artist || userProfile?.name || 'Last.fm User'}</div>
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
