import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

interface LocationPoint {
  lat: number;
  lng: number;
  label: string;
  color: string;
}

interface CheckinLocationMapProps {
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

let googleMapsPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if ((window as any).google?.maps) return Promise.resolve();
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleMapsPromise = null;
      reject(new Error('Failed to load Google Maps'));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function createMarkerIcon(color: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="28" height="42">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function CheckinLocationMap({
  checkInLat,
  checkInLng,
  checkOutLat,
  checkOutLng,
}: CheckinLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasCheckIn = checkInLat !== null && checkInLng !== null;
  const hasCheckOut = checkOutLat !== null && checkOutLng !== null;
  const hasAnyLocation = hasCheckIn || hasCheckOut;

  useEffect(() => {
    if (!hasAnyLocation || !mapRef.current) return;

    let mounted = true;

    const initMap = async () => {
      try {
        await loadGoogleMaps();
        if (!mounted || !mapRef.current) return;

        const google = (window as any).google;
        const points: LocationPoint[] = [];

        if (hasCheckIn) {
          points.push({ lat: checkInLat!, lng: checkInLng!, label: 'Check In', color: '#10b981' });
        }
        if (hasCheckOut) {
          points.push({ lat: checkOutLat!, lng: checkOutLng!, label: 'Check Out', color: '#ef4444' });
        }

        const bounds = new google.maps.LatLngBounds();
        points.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));

        const center = points.length === 1
          ? { lat: points[0].lat, lng: points[0].lng }
          : { lat: bounds.getCenter().lat(), lng: bounds.getCenter().lng() };

        const map = new google.maps.Map(mapRef.current, {
          center,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        });

        mapInstanceRef.current = map;

        points.forEach((point) => {
          const marker = new google.maps.Marker({
            map,
            position: { lat: point.lat, lng: point.lng },
            title: point.label,
            icon: {
              url: createMarkerIcon(point.color),
              scaledSize: new google.maps.Size(28, 42),
              anchor: new google.maps.Point(14, 42),
            },
          });

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 4px 2px; font-family: system-ui, sans-serif;">
                <div style="font-weight: 600; font-size: 13px; color: ${point.color}; margin-bottom: 2px;">
                  ${point.label}
                </div>
                <div style="font-size: 11px; color: #64748b;">
                  ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}
                </div>
              </div>
            `,
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });
        });

        if (points.length === 2) {
          new google.maps.Polyline({
            map,
            path: points.map(p => ({ lat: p.lat, lng: p.lng })),
            geodesic: true,
            strokeColor: '#0d9488',
            strokeOpacity: 0.7,
            strokeWeight: 3,
            icons: [{
              icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
              offset: '0',
              repeat: '15px',
            }],
          });

          map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        }

        setLoading(false);
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load map');
          setLoading(false);
        }
      }
    };

    initMap();

    return () => {
      mounted = false;
    };
  }, [hasAnyLocation, checkInLat, checkInLng, checkOutLat, checkOutLng]);

  if (!hasAnyLocation) {
    return (
      <div className="bg-slate-50 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400">
        <MapPin className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm font-medium">No location data available</p>
        <p className="text-xs mt-1">Location was not captured for this check-in</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl p-6 flex flex-col items-center justify-center text-red-400">
        <MapPin className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm font-medium">Map unavailable</p>
        <p className="text-xs mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200">
      {loading && (
        <div className="absolute inset-0 bg-slate-50 flex items-center justify-center z-10">
          <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
        </div>
      )}
      <div ref={mapRef} className="w-full h-[240px]" />
      <div className="flex items-center gap-4 px-4 py-2.5 bg-slate-50 border-t border-slate-200">
        {hasCheckIn && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="font-medium">Check In</span>
          </div>
        )}
        {hasCheckOut && (
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="font-medium">Check Out</span>
          </div>
        )}
      </div>
    </div>
  );
}
