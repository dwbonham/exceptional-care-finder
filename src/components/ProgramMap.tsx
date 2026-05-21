import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ProgramData } from '../types';

// Custom SVG pin — matches the app's blue palette, avoids Leaflet's broken
// default icon URL resolution in Vite bundled builds.
function makePin(color: string, label: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <filter id="shadow" x="-30%" y="-20%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.25)"/>
      </filter>
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 16 26 16 26S32 26.667 32 16C32 7.163 24.837 0 16 0z"
            fill="${color}" filter="url(#shadow)"/>
      <circle cx="16" cy="16" r="7" fill="white"/>
      <text x="16" y="20" text-anchor="middle" font-size="9" font-weight="700"
            font-family="Inter,system-ui,sans-serif" fill="${color}">${label}</text>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -44],
  });
}

const PIN_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669'];

// Child component: re-fits map bounds whenever the filtered program list changes.
function BoundsController({ programs }: { programs: ProgramData[] }) {
  const map = useMap();

  useEffect(() => {
    const pts = programs
      .filter((p) => p.location.coordinates)
      .map((p) => [p.location.coordinates!.lat, p.location.coordinates!.lng] as [number, number]);

    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 14, { animate: true });
    } else {
      map.fitBounds(pts, { padding: [48, 48], animate: true, maxZoom: 14 });
    }
  }, [programs, map]);

  return null;
}

interface Props {
  programs: ProgramData[];
}

export default function ProgramMap({ programs }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const mapped = useMemo(
    () => programs.filter((p) => p.location.coordinates),
    [programs]
  );

  if (mapped.length === 0) return null;

  const center: [number, number] = [
    mapped[0].location.coordinates!.lat,
    mapped[0].location.coordinates!.lng,
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header — always visible, controls collapse */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm">📍</span>
          <div>
            <span className="text-sm font-semibold text-slate-800">
              {mapped.length} location{mapped.length !== 1 ? 's' : ''} on map
            </span>
            {!collapsed && (
              <span className="hidden sm:inline text-xs text-slate-400 ml-2">
                · Click a pin for details
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
        >
          {collapsed ? '🗺️ Show Map' : '✕ Hide Map'}
        </button>
      </div>

      {/* Map — hidden when collapsed */}
      {!collapsed && (
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{ height: '260px', width: '100%' }}
        dragging={true}
        touchZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {mapped.map((program, i) => {
          const { lat, lng } = program.location.coordinates!;
          const color = PIN_COLORS[i % PIN_COLORS.length];
          const icon = makePin(color, String(i + 1));
          const fullAddress = `${program.location.street}, ${program.location.city}, ${program.location.state} ${program.location.zipCode}`;
          const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

          return (
            <Marker key={i} position={[lat, lng]} icon={icon}>
              <Popup minWidth={220} maxWidth={280}>
                <div style={{ fontFamily: 'Inter, system-ui, sans-serif', padding: '4px 2px' }}>
                  {/* Number badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: color, color: 'white',
                      fontSize: '11px', fontWeight: '700', flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <strong style={{ fontSize: '13px', color: '#0f172a', lineHeight: '1.3' }}>
                      {program.streetName}
                    </strong>
                  </div>

                  {/* Program type */}
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: '999px',
                    background: '#dbeafe', color: '#1d4ed8',
                    fontSize: '11px', fontWeight: '600', marginBottom: '8px',
                  }}>
                    {program.facilityDetails.decryptedProgramType}
                  </span>

                  {/* Address */}
                  <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 10px', lineHeight: '1.4' }}>
                    {fullAddress}
                  </p>

                  {/* Phone */}
                  {program.contact.phone && (
                    <p style={{ margin: '0 0 10px' }}>
                      <a href={`tel:${program.contact.phone.replace(/\D/g, '')}`}
                         style={{ fontSize: '12px', color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}>
                        📞 {program.contact.phone}
                      </a>
                    </p>
                  )}

                  {/* Get Directions link */}
                  <a href={directionsHref} target="_blank" rel="noopener noreferrer"
                     style={{
                       display: 'inline-flex', alignItems: 'center', gap: '4px',
                       padding: '6px 12px', borderRadius: '8px',
                       background: '#2563eb', color: 'white',
                       fontSize: '12px', fontWeight: '600', textDecoration: 'none',
                     }}>
                    🗺️ Get Directions ↗
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <BoundsController programs={mapped} />
      </MapContainer>
      )}

      {/* Legend — hidden when collapsed */}
      {!collapsed && (
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
          {mapped.map((program, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white text-[9px] font-bold shrink-0"
                style={{ background: PIN_COLORS[i % PIN_COLORS.length] }}
              >
                {i + 1}
              </span>
              {program.streetName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
