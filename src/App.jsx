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
  const [userLocation, setUserLocation] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeActive, setRouteActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [locationError, setLocationError] = useState(null);
  
  const beatIntervalRef = useRef(null);
  const mapContainerRef = useRef(null);
  const L = useRef(null);
  const locationWatchId = useRef(null);

  // Initialize voice navigation
  const { speak, stopSpeaking, speaking, currentAnnouncement } = useVoiceNavigation(VOICE_SETTINGS);

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

  // Get user location on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    const getUserLocation = () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const newLocation = [position.coords.latitude, position.coords.longitude];
            setUserLocation(newLocation);
            setLocationError(null);
          },
          (error) => {
            console.error('Location error:', error);
            setLocationError('Unable to get your location. Please enable location permissions.');
            // Default to a central location if geolocation fails
            setUserLocation([40.7128, -74.0060]); // New York as fallback
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        setLocationError('Geolocation is not supported by your browser.');
        setUserLocation([40.7128, -74.0060]); // Fallback
      }
    };

    getUserLocation();
  }, [isAuthenticated]);

  // Initialize Map and Navigation Service
  useEffect(() => {
    if (!isAuthenticated || !mapContainerRef.current || !userLocation) return;

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
  }, [isAuthenticated, userLocation, syncEnabled, isPlaying, speak]);

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

  // Search for music on Spotify
  const searchMusic = async (query) => {
    if (!query.trim() || !spotifyToken) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
        headers: { Authorization: `Bearer ${spotifyToken}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.tracks?.items || []);
      }
    } catch (err) {
      console.error('Error searching music:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Play a track from search results
  const playTrack = async (trackUri) => {
    if (!deviceId) return;
    
    try {
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${spotifyToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uris: [trackUri] })
      });
      setShowSearch(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('Error playing track:', err);
    }
  };

  // Geocode address using Nominatim (OpenStreetMap)
  const geocodeAddress = async (address) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`, {
        headers: { 'User-Agent': 'BeatMaps-GPS/1.0' }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
      }
      return null;
    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  };

  // Set destination handler with address search
  const handleSetDestination = async () => {
    const address = prompt('Enter destination address or place name:');
    
    if (address && address.trim()) {
      const coords = await geocodeAddress(address);
      
      if (coords) {
        setDestination(coords);
        
        // Add marker for destination
        if (mapInstance && L.current) {
          L.current.marker(coords).addTo(mapInstance).bindPopup(`Destination: ${address}`);
        }
        
        calculateRoute();
      } else {
        alert('Could not find this location. Please try a different address.');
      }
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
        <h1 className="login-title">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style={{ marginBottom: '16px' }}>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <br />
          Beat<span>Maps</span>
        </h1>
        <p className="login-subtitle">
          Navigate to the rhythm. Turn-by-turn directions synchronized to your music's BPM.
        </p>
        <button className="login-btn" onClick={handleLogin}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
          Connect Spotify & Start
        </button>
        <p className="login-note">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-8h-2V7h2v2z"/>
          </svg>
          Free with ads • Works with any Spotify account
        </p>
      </div>
    );
  }

  return (
    <div id="app">
      <div className="map-container" ref={mapContainerRef} id="map"></div>
      
      <div className="overlay-panel">
        <div className="panel-content">
          {/* Status Bar */}
          <div className="status-bar">
            <div className="status-item">
              <span className={`status-dot ${routeActive ? '' : 'offline'}`}></span>
              <span>{routeActive ? 'Navigation Active' : 'No Route'}</span>
            </div>
            <div className="status-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span>{spotifyToken ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>

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

          {/* Search Bar */}
          <div className="search-section">
            <div className="search-container">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="search-icon">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Search for music..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchMusic(searchQuery)}
              />
              <button className="search-btn" onClick={() => searchMusic(searchQuery)} disabled={isSearching}>
                {isSearching ? (
                  <svg className="spinner" width="18" height="18" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeDasharray="31.4 31.4" strokeLinecap="round">
                      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                    </circle>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                  </svg>
                )}
              </button>
            </div>
            
            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((track) => (
                  <div key={track.id} className="search-result-item" onClick={() => playTrack(track.uri)}>
                    <img src={track.album.images[0]?.url || 'https://via.placeholder.com/48'} alt={track.name} className="result-art" />
                    <div className="result-info">
                      <div className="result-name">{track.name}</div>
                      <div className="result-artist">{track.artists.map(a => a.name).join(', ')}</div>
                    </div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="play-icon">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player Info */}
          <div className="player-section">
            <img 
              src={currentTrack?.albumArt || 'https://via.placeholder.com/72'} 
              alt="Album Art" 
              className="album-art"
            />
            <div className="track-info">
              <div className="track-name">{currentTrack?.name || 'Not Playing'}</div>
              <div className="artist-name">{currentTrack?.artist || 'Connect Spotify'}</div>
            </div>
          </div>

          {/* Location Error Banner */}
          {locationError && (
            <div className="location-error-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {locationError}
            </div>
          )}

          {/* Quick Actions */}
          <div className="quick-actions">
            <button 
              className="quick-action-btn"
              onClick={() => {
                if (mapInstance && userLocation) {
                  mapInstance.setView(userLocation, 15);
                  speak('Centered on your location');
                }
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
              </svg>
              Locate Me
            </button>
            <button 
              className="quick-action-btn"
              onClick={handleSetDestination}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              Destination
            </button>
            <button 
              className="quick-action-btn"
              onClick={() => {
                setRouteActive(false);
                setNextInstruction(null);
                stopSpeaking();
                speak('Route cleared');
              }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
              Clear Route
            </button>
          </div>

          {/* Beat Visualizer */}
          {renderVisualizer()}

          {/* Controls */}
          <div className="controls">
            <button 
              className={`btn btn-icon ${isPlaying ? 'btn-primary' : ''}`} 
              onClick={togglePlay}
              disabled={!deviceId}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
            <button 
              className={`btn ${syncEnabled ? 'btn-primary' : ''}`} 
              onClick={toggleSync}
              disabled={!deviceId || !currentTrack}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/>
              </svg>
              {syncEnabled ? 'Sync On' : 'Sync Off'}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={handleSetDestination}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13c0-5 4-9 9-9s9 4 9 9z"/>
                <circle cx="12" cy="10" r="3" fill="#1a1a1a"/>
              </svg>
              {routeActive ? 'Change Route' : 'Set Route'}
            </button>
          </div>

          {/* Navigation Instruction */}
          {nextInstruction && (
            <div className={`nav-instruction ${speaking ? 'speaking' : ''}`}>
              <div className="instruction-icon">
                {nextInstruction.text.toLowerCase().includes('left') ? '⬅️' : 
                 nextInstruction.text.toLowerCase().includes('right') ? '➡️' : 
                 nextInstruction.text.toLowerCase().includes('straight') ? '⬆️' : 
                 nextInstruction.text.toLowerCase().includes('uturn') ? '🔄' : '🗺️'}
              </div>
              <div className="instruction-text">{nextInstruction.text}</div>
              <div className="instruction-distance">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                {Math.round(nextInstruction.distance)}m • {speaking ? '🔊 Announcing...' : 'Next'}
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
