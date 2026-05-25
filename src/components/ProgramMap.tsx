import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { ProgramData } from '../types';

const PIN_BLUE = '#2563eb';

// Plain teardrop pin — solid blue with a small white dot. No number label;
// the popup on click provides all the context needed.
const PIN_ICON = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
    <filter id="pinf" x="-60%" y="-40%" width="220%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.2)"/>
    </filter>
    <path d="M12 1C6.477 1 2 5.477 2 11c0 7.5 10 20 10 20S22 18.5 22 11C22 5.477 17.523 1 12 1z"
          fill="${PIN_BLUE}" filter="url(#pinf)"/>
    <circle cx="12" cy="11" r="4" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -34],
  });
})();

// Custom cluster bubble — single blue circle to match brand, replaces the
// default yellow/green MarkerCluster.Default.css styling.
function clusterIcon(clusterGroup: any) {
  const count = clusterGroup.getChildCount();
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${PIN_BLUE};border:3px solid white;box-shadow:0 2px 10px rgba(37,99,235,0.35);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;font-size:13px;font-weight:700;color:white">${count}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// Manages the marker cluster group imperatively — cleaner than trying to wrap Leaflet
// plugins in React-Leaflet's declarative component model.
function ClusterLayer({ programs }: { programs: ProgramData[] }) {
  const map = useMap();

  useEffect(() => {
    const cluster = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: clusterIcon,
    });

    programs.forEach((program) => {
      if (!program.location.coordinates) return;
      const { lat, lng } = program.location.coordinates;
      const fullAddress = `${program.location.street}, ${program.location.city}, ${program.location.state} ${program.location.zipCode}`;
      const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`;

      const marker = L.marker([lat, lng], { icon: PIN_ICON });
      marker.bindPopup(`
        <div style="font-family:-apple-system,BlinkMacSystemFont,Inter,sans-serif;padding:4px 2px">
          <div style="margin-bottom:8px">
            <strong style="font-size:13px;color:#0f172a;line-height:1.3">${program.streetName}</strong>
          </div>
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:11px;font-weight:600;margin-bottom:10px">${program.facilityDetails.decryptedProgramType}</span>
          <p style="font-size:12px;color:#64748b;margin:0 0 10px;line-height:1.5">${fullAddress}</p>
          ${program.contact.phone ? `<p style="margin:0 0 10px"><a href="tel:${program.contact.phone.replace(/\D/g, '')}" style="font-size:12px;color:${PIN_BLUE};font-weight:600;text-decoration:none">📞 ${program.contact.phone}</a></p>` : ''}
          <a href="${directionsHref}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:4px;padding:7px 13px;border-radius:8px;background:${PIN_BLUE};color:white;font-size:12px;font-weight:600;text-decoration:none">Get Directions ↗</a>
        </div>
      `, { minWidth: 230, maxWidth: 290 });

      cluster.addLayer(marker);
    });

    map.addLayer(cluster);

    // Fit bounds to all markers
    const pts = programs
      .filter((p) => p.location.coordinates)
      .map((p) => [p.location.coordinates!.lat, p.location.coordinates!.lng] as [number, number]);
    if (pts.length === 1) {
      map.setView(pts[0], 14, { animate: true });
    } else if (pts.length > 1) {
      map.fitBounds(pts, { padding: [48, 48], animate: true, maxZoom: 14 });
    }

    return () => { map.removeLayer(cluster); };
  }, [programs, map]);

  return null;
}

interface Props {
  programs: ProgramData[];
  compact?: boolean;
}

export default function ProgramMap({ programs, compact = false }: Props) {
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
        style={{ height: compact ? '220px' : '380px', width: '100%' }}
        dragging={true}
        touchZoom={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        <ClusterLayer programs={mapped} />
      </MapContainer>
      )}

      {/* Legend — hidden when collapsed or in compact widget mode */}
      {!collapsed && !compact && (
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-x-4 gap-y-1.5 items-center">
          {mapped.slice(0, 8).map((program, i) => (
            <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: PIN_BLUE }}
              />
              {program.streetName}
            </span>
          ))}
          {mapped.length > 8 && (
            <span className="text-xs text-slate-400 italic">+{mapped.length - 8} more · zoom in to see all</span>
          )}
        </div>
      )}
    </div>
  );
}
