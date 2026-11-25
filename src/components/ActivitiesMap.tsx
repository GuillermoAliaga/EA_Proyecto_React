import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import type { Activity } from '../models';

// Corregir iconos por defecto de Leaflet al empaquetar con Vite
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER: [number, number] = [41.3874, 2.1686]; // Barcelona

function isValidCoords(coords?: [number, number]): coords is [number, number] {
  return (
    Array.isArray(coords) &&
    coords.length === 2 &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1]) &&
    !(coords[0] === 0 && coords[1] === 0)
  );
}

function FitMapBounds({ points }: { points: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);

  return null;
}

interface ActivitiesMapProps {
  activities: Activity[];
  currentUserId?: string;
  isAdmin: boolean;
  enrollingId: string | null;
  onEnroll: (id: string) => void;
}

export function ActivitiesMap({
  activities,
  currentUserId,
  isAdmin,
  enrollingId,
  onEnroll,
}: ActivitiesMapProps) {
  const mappable = activities.filter((a) => isValidCoords(a.location?.coordinates));

  // GeoJSON guarda [longitud, latitud] -> Leaflet necesita [latitud, longitud]
  const points: [number, number][] = mappable.map((a) => [
    a.location.coordinates[1],
    a.location.coordinates[0],
  ]);

  return (
    <div className="activities-map-wrapper">
      <MapContainer center={DEFAULT_CENTER} zoom={12} scrollWheelZoom={false}>
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitMapBounds points={points} />

        {mappable.map((a) => {
          const position: [number, number] = [
            a.location.coordinates[1],
            a.location.coordinates[0],
          ];
          const enrolledCount = a.participants?.length ?? 0;
          const maxCount = a.capacity?.maxParticipants ?? 0;
          const isJoined = Boolean(
            currentUserId &&
              a.participants?.some((p) =>
                typeof p === 'string' ? p === currentUserId : p.userId === currentUserId,
              ),
          );
          const canEnroll =
            Boolean(currentUserId) &&
            !isAdmin &&
            !isJoined &&
            a.status === 'OPEN' &&
            enrolledCount < maxCount;

          const routePositions: [number, number][] =
            a.route?.path?.coordinates?.map(([lng, lat]) => [lat, lng]) ?? [];

          return (
            <div key={a._id}>
              <Marker position={position}>
                <Popup>
                  <div style={{ minWidth: '200px', display: 'grid', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>
                      {a.category} · {a.subcategory}
                      {a.location.isStoreLocation ? ' · Tienda oficial' : ''}
                    </div>
                    <strong style={{ fontSize: '0.95rem' }}>{a.title}</strong>
                    <div style={{ fontSize: '0.82rem' }}>
                      {a.location.addressName}
                    </div>
                    <div style={{ fontSize: '0.82rem' }}>
                      Plazas: <strong>{enrolledCount} / {maxCount}</strong> ·{' '}
                      <strong>{a.pricing?.price > 0 ? `${a.pricing.price} €` : 'Gratis'}</strong>
                    </div>

                    {isJoined && (
                      <span
                        style={{
                          marginTop: '0.25rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          textAlign: 'center',
                        }}
                      >
                        Ya estás inscrito
                      </span>
                    )}

                    {canEnroll && (
                      <button
                        type="button"
                        disabled={enrollingId === a._id}
                        onClick={() => onEnroll(a._id)}
                        style={{ marginTop: '0.25rem', padding: '0.3rem 0.6rem', fontSize: '0.82rem' }}
                      >
                        {enrollingId === a._id ? 'Inscribiendo…' : 'Inscribirme'}
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>

              {routePositions.length > 1 && (
                <Polyline positions={routePositions} pathOptions={{ color: '#5c6bc0', weight: 4 }} />
              )}
            </div>
          );
        })}
      </MapContainer>
    </div>
  );
}