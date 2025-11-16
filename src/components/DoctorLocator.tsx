import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Phone, Navigation, List, Map as MapIcon } from 'lucide-react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MedicalFacility {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  address?: string;
  phone?: string;
  distance?: number;
}

interface DoctorLocatorProps {
  specialty?: string;
  disease?: string;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

export function DoctorLocator({ specialty, disease }: DoctorLocatorProps) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [facilities, setFacilities] = useState<MedicalFacility[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [error, setError] = useState<string>('');

  const getUserLocation = () => {
    setLoading(true);
    setError('');
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserLocation(location);
        fetchNearbyFacilities(location);
      },
      (error) => {
        setError('Unable to retrieve your location. Please enable location services.');
        setLoading(false);
        toast.error('Location access denied');
      }
    );
  };

  const fetchNearbyFacilities = async (location: [number, number]) => {
    try {
      const [lat, lon] = location;
      const radius = 5000; // 5km radius
      
      // Overpass API query for hospitals, clinics, and doctors
      const query = `
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:${radius},${lat},${lon});
          node["amenity"="clinic"](around:${radius},${lat},${lon});
          node["amenity"="doctors"](around:${radius},${lat},${lon});
          way["amenity"="hospital"](around:${radius},${lat},${lon});
          way["amenity"="clinic"](around:${radius},${lat},${lon});
          way["amenity"="doctors"](around:${radius},${lat},${lon});
        );
        out center;
      `;

      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });

      const data = await response.json();
      
      const facilitiesList: MedicalFacility[] = data.elements
        .map((element: any) => {
          const elementLat = element.lat || element.center?.lat;
          const elementLon = element.lon || element.center?.lon;
          
          if (!elementLat || !elementLon) return null;
          
          const distance = calculateDistance(lat, lon, elementLat, elementLon);
          
          return {
            id: element.id.toString(),
            name: element.tags?.name || `${element.tags?.amenity || 'Medical Facility'}`,
            type: element.tags?.amenity || 'medical',
            lat: elementLat,
            lon: elementLon,
            address: element.tags?.['addr:full'] || element.tags?.['addr:street'] || 'Address not available',
            phone: element.tags?.phone || element.tags?.['contact:phone'] || 'Phone not available',
            distance,
          };
        })
        .filter(Boolean)
        .sort((a: MedicalFacility, b: MedicalFacility) => (a.distance || 0) - (b.distance || 0))
        .slice(0, 20); // Limit to 20 results

      setFacilities(facilitiesList);
      setLoading(false);
      
      if (facilitiesList.length === 0) {
        toast.info('No medical facilities found nearby');
      }
    } catch (error) {
      console.error('Error fetching facilities:', error);
      setError('Failed to fetch nearby facilities');
      setLoading(false);
      toast.error('Failed to fetch nearby facilities');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const openInMaps = (lat: number, lon: number, name: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    getUserLocation();
  }, []);

  return (
    <div className="space-y-4">
      {disease && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Finding specialists for: {disease}
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4 mr-2" />
            List
          </Button>
          <Button
            variant={viewMode === 'map' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('map')}
            disabled={!userLocation}
          >
            <MapIcon className="h-4 w-4 mr-2" />
            Map
          </Button>
        </div>
        <Button size="sm" onClick={getUserLocation} disabled={loading}>
          <Navigation className="h-4 w-4 mr-2" />
          {loading ? 'Locating...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Finding nearby medical facilities...</div>
        </div>
      )}

      {viewMode === 'list' && !loading && facilities.length > 0 && (
        <div className="grid gap-3">
          {facilities.map((facility) => (
            <Card key={facility.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold">{facility.name}</h3>
                        <Badge variant="secondary" className="mt-1">
                          {facility.type}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground pl-7">{facility.address}</p>
                    {facility.phone && (
                      <div className="flex items-center gap-2 pl-7">
                        <Phone className="h-4 w-4 text-accent" />
                        <span className="text-sm">{facility.phone}</span>
                      </div>
                    )}
                    {facility.distance && (
                      <p className="text-sm text-muted-foreground pl-7">
                        {facility.distance.toFixed(2)} km away
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => openInMaps(facility.lat, facility.lon, facility.name)}
                  >
                    Directions
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === 'map' && userLocation && !loading && (
        <Card className="overflow-hidden">
          <div className="h-[500px]">
            <MapContainer
              center={userLocation}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <MapUpdater center={userLocation} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* User location marker */}
              <Marker position={userLocation}>
                <Popup>Your Location</Popup>
              </Marker>
              
              {/* Facility markers */}
              {facilities.map((facility) => (
                <Marker key={facility.id} position={[facility.lat, facility.lon]}>
                  <Popup>
                    <div className="space-y-1">
                      <h3 className="font-semibold">{facility.name}</h3>
                      <p className="text-xs text-muted-foreground">{facility.address}</p>
                      {facility.phone && <p className="text-xs">{facility.phone}</p>}
                      {facility.distance && (
                        <p className="text-xs">{facility.distance.toFixed(2)} km away</p>
                      )}
                      <Button
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => openInMaps(facility.lat, facility.lon, facility.name)}
                      >
                        Get Directions
                      </Button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
