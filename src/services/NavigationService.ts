// src/services/NavigationService.ts
import L from 'leaflet';

export interface TurnInstruction {
  type: string;
  text: string;
  distance: number;
  time: number;
  location: [number, number];
}

class NavigationService {
  private map: L.Map | null = null;
  private routingControl: any = null;
  private currentRoute: any = null;
  private upcomingTurns: TurnInstruction[] = [];
  private nextTurnIndex: number = 0;
  private listeners: ((turn: TurnInstruction | null) => void)[] = [];

  init(map: L.Map) {
    this.map = map;
  }

  async calculateRoute(start: [number, number], end: [number, number]) {
    if (!this.map) throw new Error('Map not initialized');

    // Dynamic import for leaflet-routing-machine
    const { route } = await import('leaflet-routing-machine');

    return new Promise((resolve, reject) => {
      // Remove existing route if any
      if (this.routingControl) {
        this.map!.removeControl(this.routingControl);
      }

      // Timeout handler
      const timeoutId = setTimeout(() => {
        reject(new Error('Route calculation timed out. Please try again.'));
      }, 15000);

      this.routingControl = route({
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
          serviceUrl: 'https://router.project-osrm.org/route/v1',
          timeout: 10000
        })
      }).on('routesfound', (e: any) => {
        clearTimeout(timeoutId);
        const routes = e.routes;
        
        if (!routes || routes.length === 0) {
          reject(new Error('No route found'));
          return;
        }
        
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
        
        // Fit map bounds to show entire route
        const latlngs = routes[0].coordinates.map((coord: any) => [coord.lat, coord.lng]);
        this.map!.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
        
        resolve(routes[0]);
        this.notifyListeners();
      }).on('routingerror', (e: any) => {
        clearTimeout(timeoutId);
        console.error('Routing error:', e);
        reject(new Error('Unable to find route. Please try different locations or check your connection.'));
      }).addTo(this.map);
    });
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

  reset() {
    this.nextTurnIndex = 0;
    this.upcomingTurns = [];
  }
}

export default new NavigationService();
