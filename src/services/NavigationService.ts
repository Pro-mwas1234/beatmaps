// src/services/NavigationService.ts
import L from 'leaflet';

export interface TurnInstruction {
  type: string;
  text: string;
  distance: number;
  time: number;
  location: [number, number];
}

declare module 'leaflet' {
  namespace Routing {
    function osrmv1(options?: any): any;
    function control(options?: any): any;
  }
}

class NavigationService {
  private map: L.Map | null = null;
  private routingControl: any = null;
  private currentRoute: any = null;
  private upcomingTurns: TurnInstruction[] = [];
  private nextTurnIndex: number = 0;
  private listeners: ((turn: TurnInstruction | null) => void)[] = [];
  private userLocationMarker: L.Marker | null = null;
  private routePolyline: L.Polyline | null = null;

  init(map: L.Map) {
    this.map = map;
  }

  async calculateRoute(start: [number, number], end: [number, number]) {
    if (!this.map) return;

    // Dynamic import for leaflet-routing-machine
    await import('leaflet-routing-machine');

    return new Promise((resolve, reject) => {
      // Remove existing route if any
      if (this.routingControl) {
        this.map!.removeControl(this.routingControl);
        this.routingControl = null;
      }

      if (this.routePolyline) {
        this.map!.removeLayer(this.routePolyline);
        this.routePolyline = null;
      }

      this.routingControl = L.Routing.control({
        waypoints: [
          L.latLng(start[0], start[1]),
          L.latLng(end[0], end[1])
        ],
        routeWhileDragging: false,
        show: false, // Hide default instruction panel
        addWaypoints: false,
        createMarker: () => null,
        lineOptions: {
          styles: [{ color: '#00ff88', opacity: 0.8, weight: 6 }]
        },
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        })
      }).on('routesfound', (e: any) => {
        const routes = e.routes;
        
        // Parse instructions
        this.upcomingTurns = routes[0].instructions.map((inst: any) => ({
          type: inst.type,
          text: inst.text,
          distance: inst.distance,
          time: inst.time,
          location: [inst.latlng.lat, inst.latlng.lng]
        }));

        this.nextTurnIndex = 0;
        this.currentRoute = routes[0];
        
        // Draw route polyline for visual feedback
        if (routes[0].coordinates && routes[0].coordinates.length > 0) {
          this.routePolyline = L.polyline(
            routes[0].coordinates.map((coord: any) => [coord.lat, coord.lng]),
            { color: '#00ff88', opacity: 0.8, weight: 6 }
          ).addTo(this.map!);
          
          // Fit map bounds to show entire route
          const bounds = L.latLngBounds(routes[0].coordinates);
          this.map!.fitBounds(bounds, { padding: [50, 50] });
        }
        
        resolve(routes[0]);
        this.notifyListeners();
      }).on('routingerror', (e: any) => {
        console.error('Routing error:', e.error);
        reject(e.error);
      }).addTo(this.map);
    });
  }

  // Update user location marker in real-time
  updateUserLocation(location: [number, number]) {
    if (!this.map) return;

    if (this.userLocationMarker) {
      this.userLocationMarker.setLatLng(L.latLng(location[0], location[1]));
    } else {
      // Create a custom marker for user location
      const userIcon = L.divIcon({
        className: 'user-location-marker',
        html: `<div style="
          width: 16px;
          height: 16px;
          background-color: #00ff88;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(0, 255, 136, 0.8);
          animation: pulse 2s infinite;
        "></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      
      this.userLocationMarker = L.marker(location, { icon: userIcon }).addTo(this.map);
      this.userLocationMarker.bindPopup('Your Location').openPopup();
    }

    // Add accuracy circle if available (optional enhancement)
    return this.userLocationMarker;
  }

  checkProximity(currentLocation: [number, number]) {
    if (!this.currentRoute || this.nextTurnIndex >= this.upcomingTurns.length) {
      return null;
    }

    const nextTurn = this.upcomingTurns[this.nextTurnIndex];
    const dist = this.getDistanceFromLatLonInM(
      currentLocation[0], currentLocation[1],
      nextTurn.location[0], nextTurn.location[1]
    );

    // Announce at 500m and 100m for major turns
    const triggerDistance = nextTurn.type === 'Straight' ? 100 : 500;

    if (dist < triggerDistance && dist > 0) {
      const turnToAnnounce = nextTurn;
      this.nextTurnIndex++;
      return turnToAnnounce;
    }

    return null;
  }

  // Get remaining distance to destination
  getRemainingDistance(currentLocation: [number, number]): number {
    if (!this.currentRoute) return 0;
    
    // Find the closest point on the route to current location
    let totalRemaining = 0;
    const coordinates = this.currentRoute.coordinates || [];
    
    if (coordinates.length === 0) return 0;
    
    // Simple approach: sum distances between consecutive points from current position
    for (let i = 0; i < coordinates.length - 1; i++) {
      totalRemaining += this.getDistanceFromLatLonInM(
        coordinates[i].lat, coordinates[i].lng,
        coordinates[i + 1].lat, coordinates[i + 1].lng
      );
    }
    
    return totalRemaining;
  }

  // Get estimated time of arrival based on current progress
  getETA(currentLocation: [number, number], averageSpeedKmh: number = 40): number {
    const remainingDistance = this.getRemainingDistance(currentLocation);
    if (remainingDistance === 0) return 0;
    
    // Convert speed to m/s and calculate time in seconds
    const speedMs = averageSpeedKmh * 1000 / 3600;
    return Math.round(remainingDistance / speedMs);
  }

  private getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Radius of the earth in m
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }

  subscribe(listener: (turn: TurnInstruction | null) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners() {
    if (this.upcomingTurns.length > 0) {
      this.listeners.forEach(l => l(this.upcomingTurns[0]));
    }
  }

  getCurrentInstruction(): TurnInstruction | null {
    return this.upcomingTurns[this.nextTurnIndex] || null;
  }

  getAllInstructions(): TurnInstruction[] {
    return this.upcomingTurns;
  }

  reset() {
    this.nextTurnIndex = 0;
    this.upcomingTurns = [];
    this.currentRoute = null;
    
    if (this.userLocationMarker) {
      this.map?.removeLayer(this.userLocationMarker);
      this.userLocationMarker = null;
    }
    
    if (this.routePolyline) {
      this.map?.removeLayer(this.routePolyline);
      this.routePolyline = null;
    }
  }

  cleanup() {
    this.reset();
    if (this.routingControl) {
      this.map?.removeControl(this.routingControl);
      this.routingControl = null;
    }
  }
}

export default new NavigationService();
