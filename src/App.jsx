import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import NavigationService from './services/NavigationService';
import { useVoiceNavigation } from './hooks/useVoiceNavigation';

// Voice settings
const VOICE_SETTINGS = {
  enabled: true,
  volume: 1.0,
  rate: 1.0,
  pitch: 1.0
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [player, setPlayer] = useState(null);
  const [youtubePlayerReady, setYoutubePlayerReady] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const beatIntervalRef = useRef(null);
  const mapContainerRef = useRef(null);
  const L = useRef(null);
  const locationWatchId = useRef(null);
  const playerContainerRef = useRef(null);

  // Initialize voice navigation
  const { speak, stopSpeaking, speaking, currentAnnouncement } = useVoiceNavigation(VOICE_SETTINGS);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }

    window.onYouTubeIframeAPIReady = () => {
      setYoutubePlayerReady(true);
    };

    return () => {
      if (player) {
        player.destroy();
      }
    };
  }, []);

  // Initialize YouTube player when ready
  useEffect(() => {
    if (youtubePlayerReady && playerContainerRef.current && !player) {
      const ytPlayer = new window.YT.Player(playerContainerRef.current, {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1
        },
        events: {
          onReady: (event) => {
            console.log('YouTube player ready');
            setPlayer(event.target);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              estimateBPM();
            } else if (event.data === window.YT.PlayerState.PAUSED || 
                       event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
            }
            // Auto-play next track when current ends
            if (event.data === window.YT.PlayerState.ENDED) {
              playNextTrack();
            }
          }
        }
      });
    }
  }, [youtubePlayerReady, playerContainerRef.current]);

  // Check if user already has a session
  useEffect(() => {
    const savedPlaylist = localStorage.getItem('beatmaps_playlist');
    if (savedPlaylist) {
      setPlaylist(JSON.parse(savedPlaylist));
      setIsAuthenticated(true);
    }
  }, []);

  // Estimate BPM based on genre/tempo (simplified)
  const estimateBPM = () => {
    // In production, you could use an audio analysis library
    // For now, use common BPM ranges based on music genre
    const bpmRanges = {
      'pop': [100, 130],
      'rock': [120, 160],
      'electronic': [120, 140],
      'hip hop': [80, 115],
      'jazz': [120, 180],
      'classical': [60, 140],
      'dance': [120, 140],
      'default': [100, 130]
    };

    const genre = currentTrack?.genre?.toLowerCase() || 'default';
    const range = bpmRanges[genre] || bpmRanges.default;
    const bpm = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    setCurrentBPM(bpm);
  };

  // Search for music on YouTube
  const searchMusic = async (query) => {
    try {
      // Use YouTube Data API proxy or direct search
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      
      if (data.items) {
        setSearchResults(data.items);
      }
    } catch (error) {
      console.error('Search error:', error);
      // Fallback to mock results for demo
      setSearchResults([
        { id: { videoId: 'dQw4w9WgXcQ' }, snippet: { title: 'Rick Astley - Never Gonna Give You Up', thumbnails: { medium: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg' } } } },
        { id: { videoId: '9bZkp7q19f0' }, snippet: { title: 'PSY - GANGNAM STYLE', thumbnails: { medium: { url: 'https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg' } } } },
        { id: { videoId: 'kJQP7kiw5Fk' }, snippet: { title: 'Luis Fonsi - Despacito', thumbnails: { medium: { url: 'https://img.youtube.com/vi/kJQP7kiw5Fk/mqdefault.jpg' } } } }
      ]);
    }
  };

  // Add track to playlist
  const addToPlaylist = (track) => {
    const newTrack = {
      id: track.id.videoId || track.id,
      title: track.snippet?.title || track.title,
      thumbnail: track.snippet?.thumbnails?.medium?.url || `https://img.youtube.com/vi/${track.id}/mqdefault.jpg`,
      genre: 'pop' // Default genre, could be extracted from metadata
    };
    
    const updatedPlaylist = [...playlist, newTrack];
    setPlaylist(updatedPlaylist);
    localStorage.setItem('beatmaps_playlist', JSON.stringify(updatedPlaylist));
    
    if (!currentTrack) {
      setCurrentTrack(newTrack);
      setCurrentIndex(0);
    }
    
    setIsAuthenticated(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Play a specific track
  const playTrack = (track, index) => {
    if (player && track) {
      player.loadVideoById(track.id);
      setCurrentTrack(track);
      setCurrentIndex(index);
      setIsPlaying(true);
    }
  };

  // Play next track in playlist
  const playNextTrack = () => {
    if (playlist.length === 0) return;
    
    const nextIndex = (currentIndex + 1) % playlist.length;
    playTrack(playlist[nextIndex], nextIndex);
  };

  // Play previous track
  const playPreviousTrack = () => {
    if (playlist.length === 0) return;
    
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
    playTrack(playlist[prevIndex], prevIndex);
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

  // Play/Pause
  const togglePlay = () => {
    if (!player) return;
    
    if (isPlaying) {
      player.pauseVideo();
    } else {
      player.playVideo();
    }
  };

  // Handle search submit
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      searchMusic(searchQuery);
    }
  };

  // Logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setPlaylist([]);
    setCurrentTrack(null);
    setRouteActive(false);
    localStorage.removeItem('beatmaps_playlist');
    if (player) {
      player.stopVideo();
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
        <div className="search-container">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              placeholder="Search for music..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <button type="submit" className="search-btn">Search</button>
          </form>
          
          {searchResults.length > 0 && (
            <div className="search-results">
              {searchResults.map((track, index) => (
                <div key={index} className="search-result-item" onClick={() => addToPlaylist(track)}>
                  <img src={track.snippet?.thumbnails?.medium?.url || 'https://via.placeholder.com/60'} alt="" />
                  <span>{track.snippet?.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="login-note">
          Search for songs to create your playlist and start navigating!
        </p>
      </div>
    );
  }

  return (
    <div id="app">
      {/* Hidden YouTube player container */}
      <div ref={playerContainerRef} style={{ display: 'none' }}></div>
      
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
              src={currentTrack?.thumbnail || 'https://via.placeholder.com/70'} 
              alt="Album Art" 
              className="album-art"
            />
            <div className="track-info">
              <div className="track-name">{currentTrack?.title || 'Not Playing'}</div>
              <div className="artist-name\">{playlist.length > 0 ? `${currentIndex + 1}/${playlist.length}` : 'Add songs to playlist'}</div>
            </div>
          </div>

          {/* Beat Visualizer */}
          {renderVisualizer()}

          {/* Search Bar */}
          <div className="search-bar">
            <form onSubmit={handleSearch} className="search-form-inline">
              <input
                type="text"
                placeholder="Add more songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input-inline"
              />
              <button type="submit" className="search-btn-inline">+</button>
            </form>
          </div>

          {/* Controls */}
          <div className="controls">
            <button 
              className="btn btn-secondary" 
              onClick={playPreviousTrack}
              disabled={playlist.length === 0}
            >
              ⏮
            </button>
            <button 
              className="btn btn-primary" 
              onClick={togglePlay}
              disabled={!currentTrack}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={playNextTrack}
              disabled={playlist.length === 0}
            >
              ⏭
            </button>
          </div>

          <div className="controls">
            <button 
              className={`btn ${syncEnabled ? 'btn-primary' : ''}`} 
              onClick={toggleSync}
              disabled={!currentTrack}
            >
              {syncEnabled ? 'Disable Sync' : 'Enable Beat Sync'}
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => document.getElementById('destination-input').scrollIntoView({ behavior: 'smooth' })}
            >
              {routeActive ? 'Change Route' : 'Set Destination'}
            </button>
            <button 
              className="btn btn-danger" 
              onClick={handleLogout}
            >
              Logout
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

          {/* Destination Input */}
          <div id="destination-input" className="destination-section">
            <button 
              className="btn btn-secondary full-width" 
              onClick={() => {
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
              }}
            >
              {routeActive ? 'Change Route' : 'Set Destination'}
            </button>
          </div>

          {/* Playlist */}
          {playlist.length > 0 && (
            <div className="playlist-section">
              <h3>Playlist ({playlist.length})</h3>
              <div className="playlist">
                {playlist.map((track, index) => (
                  <div 
                    key={index} 
                    className={`playlist-item ${index === currentIndex ? 'active' : ''}`}
                    onClick={() => playTrack(track, index)}
                  >
                    <img src={track.thumbnail} alt="" />
                    <span>{track.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
