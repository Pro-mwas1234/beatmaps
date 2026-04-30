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

// Transport modes
const TRANSPORT_MODES = [
  { id: 'driving', icon: '🚗', label: 'Drive' },
  { id: 'walking', icon: '🚶', label: 'Walk' },
  { id: 'cycling', icon: '🚴', label: 'Cycle' },
  { id: 'transit', icon: '🚌', label: 'Transit' }
];

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
  
  // New state for Google Maps-like UI
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [transportMode, setTransportMode] = useState('driving');
  const [showSearchPanel, setShowSearchPanel] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedOrigin, setSelectedOrigin] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFocus, setSearchFocus] = useState(null);
  
  const beatIntervalRef = useRef(null);
  const mapContainerRef = useRef(null);
  const L = useRef(null);
  const locationWatchId = useRef(null);
  const searchMarkers = useRef([]);

  // Initialize voice navigation
  const { speak, stopSpeaking, speaking, currentAnnouncement } = useVoiceNavigation(VOICE_SETTINGS);

  // Geocoding using OpenStreetMap Nominatim API
  const searchLocation = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      setSearchResults(data.map(item => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type
      })));
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchFocus === 'origin' && originInput) {
        searchLocation(originInput);
      } else if (searchFocus === 'destination' && destinationInput) {
        searchLocation(destinationInput);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [originInput, destinationInput, searchFocus]);

  // Handle location selection
  const handleSelectLocation = (location) => {
    if (searchFocus === 'origin') {
      setOriginInput(location.name.split(',')[0]);
      setSelectedOrigin(location);
      setUserLocation([location.lat, location.lon]);
      
      // Center map on origin
      if (mapInstance) {
        mapInstance.setView([location.lat, location.lon], 13);
        
        // Clear existing markers
        searchMarkers.current.forEach(marker => marker.remove());
        searchMarkers.current = [];
        
        // Add origin marker
        const originMarker = L.current.marker([location.lat, location.lon]).addTo(mapInstance);
        originMarker.bindPopup('Starting Point').openPopup();
        searchMarkers.current.push(originMarker);
      }
    } else if (searchFocus === 'destination') {
      setDestinationInput(location.name.split(',')[0]);
      setSelectedDestination(location);
      setDestination([location.lat, location.lon]);
      
      // Add destination marker
      if (mapInstance && L.current) {
        const destMarker = L.current.marker([location.lat, location.lon]).addTo(mapInstance);
        destMarker.bindPopup('Destination').openPopup();
        searchMarkers.current.push(destMarker);
      }
    }
    
    setSearchResults([]);
    setSearchFocus(null);
  };

  // Use current location
  const useCurrentLocation = () => {
    if ('geolocation' in navigator) {
      speak('Getting your current location...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = [position.coords.latitude, position.coords.longitude];
          setUserLocation(coords);
          setSelectedOrigin({ lat: coords[0], lon: coords[1], name: 'Current Location' });
          setOriginInput('Current Location');
          
          if (mapInstance) {
            mapInstance.setView(coords, 13);
            
            // Clear existing markers
            searchMarkers.current.forEach(marker => marker.remove());
            searchMarkers.current = [];
            
            const userMarker = L.current.marker(coords).addTo(mapInstance);
            userMarker.bindPopup('Your Location').openPopup();
            searchMarkers.current.push(userMarker);
          }
          speak('Current location found. You can now enter your destination.');
        },
        (error) => {
          console.error('Geolocation error:', error);
          let errorMsg = 'Unable to get your current location.';
          if (error.code === 1) {
            errorMsg = 'Location permission denied. Please allow location access in your browser settings.';
          } else if (error.code === 2) {
            errorMsg = 'Location unavailable. Please check your device\'s GPS settings.';
          } else if (error.code === 3) {
            errorMsg = 'Location request timed out. Please try again.';
          }
          speak(errorMsg);
          alert(errorMsg);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    } else {
      const msg = 'Geolocation is not supported by your browser.';
      speak(msg);
      alert(msg);
    }
  };

  // Handle Spotify Authentication
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
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
    if (!mapInstance || !selectedOrigin || !selectedDestination) {
      speak('Please select both starting point and destination.');
      return;
    }

    const start = [selectedOrigin.lat, selectedOrigin.lon];
    const dest = [selectedDestination.lat, selectedDestination.lon];
    
    try {
      await NavigationService.calculateRoute(start, dest);
      setRouteActive(true);
      setShowSearchPanel(false);
      
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
      const errorMessage = error.message || 'Unknown error';
      speak(`Unable to find route: ${errorMessage}. Try different locations or check your connection.`);
      alert(`Route Error: ${errorMessage}\n\nTips:\n- Make sure both origin and destination are valid locations\n- Try searching for major cities or landmarks\n- Check your internet connection\n- The routing service may be temporarily unavailable`);
    }
  };

  // Start navigation with selected transport mode
  const handleStartNavigation = () => {
    if (!selectedOrigin || !selectedDestination) {
      speak('Please enter origin and destination');
      return;
    }
    calculateRoute();
  };

  // Clear route and show search panel
  const handleBackToSearch = () => {
    setRouteActive(false);
    setShowSearchPanel(true);
    setNextInstruction(null);
    if (NavigationService.routingControl) {
      mapInstance.removeControl(NavigationService.routingControl);
    }
    NavigationService.reset();
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

  // Login handler - calls backend endpoint to get auth URL with response_type=code
  const handleLogin = async () => {
    try {
      const response = await fetch('/api/spotify/login');
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        console.error('No auth URL received from server');
      }
    } catch (error) {
      console.error('Error initiating Spotify login:', error);
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

  // Render Google Maps-like search panel
  const renderSearchPanel = () => (
    <div className="search-panel">
      <div className="search-header">
        <h2>Navigate to the rhythm</h2>
        <button className="close-btn" onClick={() => setShowSearchPanel(false)}>✕</button>
      </div>
      
      {/* Origin Input */}
      <div className="search-input-container">
        <div className="input-icon origin-icon">📍</div>
        <input
          type="text"
          placeholder="Choose starting point"
          value={originInput}
          onChange={(e) => setOriginInput(e.target.value)}
          onFocus={() => setSearchFocus('origin')}
          className="search-input"
        />
        {originInput && (
          <button className="clear-btn" onClick={() => {
            setOriginInput('');
            setSelectedOrigin(null);
          }}>✕</button>
        )}
      </div>
      
      {/* Destination Input */}
      <div className="search-input-container">
        <div className="input-icon dest-icon">🏁</div>
        <input
          type="text"
          placeholder="Choose destination"
          value={destinationInput}
          onChange={(e) => setDestinationInput(e.target.value)}
          onFocus={() => setSearchFocus('destination')}
          className="search-input"
        />
        {destinationInput && (
          <button className="clear-btn" onClick={() => {
            setDestinationInput('');
            setSelectedDestination(null);
          }}>✕</button>
        )}
      </div>
      
      {/* Search Results Dropdown */}
      {searchResults.length > 0 && (
        <div className="search-results">
          {searchResults.map((result, index) => (
            <div
              key={index}
              className="search-result-item"
              onClick={() => handleSelectLocation(result)}
            >
              <span className="result-icon">📍</span>
              <span className="result-name">{result.name.split(',')[0]}</span>
              <span className="result-type">{result.type}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Quick Actions */}
      <div className="quick-actions">
        <button className="quick-action-btn" onClick={useCurrentLocation}>
          📍 Use Current Location
        </button>
      </div>
      
      {/* Transport Mode Selection */}
      <div className="transport-modes">
        {TRANSPORT_MODES.map(mode => (
          <button
            key={mode.id}
            className={`transport-mode-btn ${transportMode === mode.id ? 'active' : ''}`}
            onClick={() => setTransportMode(mode.id)}
          >
            <span className="mode-icon">{mode.icon}</span>
            <span className="mode-label">{mode.label}</span>
          </button>
        ))}
      </div>
      
      {/* Start Navigation Button */}
      <button
        className="start-nav-btn"
        onClick={handleStartNavigation}
        disabled={!selectedOrigin || !selectedDestination}
      >
        Start Navigation
      </button>
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
      
      {/* Search Panel - Google Maps style */}
      {showSearchPanel && (
        <div className="search-panel-overlay">
          {renderSearchPanel()}
        </div>
      )}
      
      <div className={`overlay-panel ${routeActive ? 'navigation-mode' : ''}`}>
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
            {routeActive && (
              <button 
                className="btn btn-secondary" 
                onClick={handleBackToSearch}
              >
                Back to Search
              </button>
            )}
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
