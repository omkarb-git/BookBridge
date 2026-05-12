import React, { useMemo, useEffect, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Polyline, CircleMarker, Tooltip, useMapEvents, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { BookOpen, MapPin, ArrowLeftRight, Navigation, X } from 'lucide-react';

// Fix for default Leaflet icon missing in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface BookMarkerData {
  id: string;
  title: string;
  author: string;
  lat: number;
  lng: number;
  distance: number;
  isNearby: boolean;
  condition: string;
  owner: { name: string; rating: number };
  cover?: string;
  genre: string;
  wants: string;
}

interface NearbyMapViewProps {
  books: BookMarkerData[];
  userLocation: { lat: number; lng: number } | null;
  nearbyRadius: number;
  onRequestExchange?: (bookId: string) => void;
  onViewDetails?: (bookId: string) => void;
}

function createBookIcon(book: any, isNearby: boolean): L.DivIcon {
  const accentColor = isNearby ? '#10B981' : '#1D3557';
  
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:45px; height:65px; background:white; border-radius:12px; box-shadow: 6px 6px 12px #bebebe, -6px -6px 12px #ffffff; overflow:hidden; transition:all 0.3s ease; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3px;" class="book-map-marker">
        <div style="width:100%; height:100%; border-radius:10px; overflow:hidden; position:relative; background:#f0f0f0; box-shadow: inset 2px 2px 5px #bebebe, inset -2px -2px 5px #ffffff;">
          ${book.cover 
            ? `<img src="${book.cover}" style="width:100%; height:100%; object-fit:cover; position:absolute; inset:0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />` 
            : ''
          }
          <div style="padding:6px; font-family:sans-serif; font-size:7px; font-weight:900; text-transform:uppercase; color:var(--c-ink); text-align:center; display:${book.cover ? 'none' : 'flex'}; align-items:center; justify-content:center; z-index:1; height:100%;">
            ${book.title}
          </div>
        </div>
        ${isNearby ? `<div style="position:absolute; top:0; right:0; width:12px; height:12px; background:#10B981; border-radius:50%; border:2px solid white; z-index:10; margin-top:-2px; margin-right:-2px; box-shadow: 0 0 10px rgba(16,185,129,0.5);"></div>` : ''}
      </div>`,
    iconSize: [45, 65],
    iconAnchor: [22, 32],
    popupAnchor: [0, -32],
  });
}

function createUserIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex; align-items:center; justify-content:center; width:22px; height:22px;">
        <div class="user-location-pulse" style="background:#10B981; border: 3px solid white; box-shadow: 0 0 15px rgba(16,185,129,0.8);"></div>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const NearbyMapView = memo(function NearbyMapView({ books, userLocation, nearbyRadius, onRequestExchange }: NearbyMapViewProps) {
  const [currentZoom, setCurrentZoom] = React.useState(13);

  const plottedBooks = useMemo(() => {
    const counts = new Map<string, number>();
    const totals = new Map<string, number>();

    books.forEach((book) => {
      const key = `${book.lat.toFixed(4)},${book.lng.toFixed(4)}`;
      totals.set(key, (totals.get(key) || 0) + 1);
    });

    return books.map((book) => {
      const key = `${book.lat.toFixed(4)},${book.lng.toFixed(4)}`;
      const index = counts.get(key) || 0;
      counts.set(key, index + 1);

      const total = totals.get(key) || 1;
      if (total === 1) return book;

      const angle = (Math.PI * 2 * index) / total;
      const spread = 0.0006 * Math.max(1, Math.ceil(total / 2));

      return {
        ...book,
        originalLat: book.lat,
        originalLng: book.lng,
        lat: book.lat + Math.sin(angle) * spread,
        lng: book.lng + Math.cos(angle) * spread,
        zIndex: 1000 + index,
        isSpidered: true
      };
    });
  }, [books, currentZoom]);

  const center = useMemo<[number, number]>(() => 
    userLocation
      ? [userLocation.lat, userLocation.lng]
      : plottedBooks.length > 0
        ? [plottedBooks[0].lat, plottedBooks[0].lng]
        : [19.076, 72.8777]
  , [userLocation?.lat, userLocation?.lng, plottedBooks]);

  const userIcon = useMemo(() => createUserIcon(), []);

  const conditionLabels: Record<string, string> = {
    like_new: 'Like New',
    good: 'Good',
    fair: 'Fair',
    worn: 'Worn',
  };

  return (
    <div className="relative w-full h-full animate-fade-in">
      <MapContainer
        center={center}
        zoom={13}
        style={{ width: '100%', height: '100%', zIndex: 0 }}
        zoomControl={false}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={20}
        />
        <MapViewManager center={center} zoom={13} onZoomChange={setCurrentZoom} />
        <ZoomControl position="bottomright" />

        {userLocation && (
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={nearbyRadius * 1000}
            pathOptions={{
              color: '#10B981',
              weight: 2,
              dashArray: '10 10',
              fillColor: '#10B981',
              fillOpacity: 0.05,
            }}
          />
        )}

        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
            <Popup>
              <div className="text-center p-3 font-black uppercase text-[10px] tracking-widest text-[var(--c-emerald)]">Your Position</div>
            </Popup>
          </Marker>
        )}

        {plottedBooks.filter(b => (b as any).isSpidered).map(book => {
          const start: [number, number] = [(book as any).originalLat, (book as any).originalLng];
          const end: [number, number] = [book.lat, book.lng];
          const segments = 20;
          const curvePoints: [number, number][] = [];
          const midLat = (start[0] + end[0]) / 2;
          const midLng = (start[1] + end[1]) / 2;
          const dx = end[0] - start[0];
          const dy = end[1] - start[1];
          const curvature = 0.4; 
          const ctrlLat = midLat + dy * curvature;
          const ctrlLng = midLng - dx * curvature;

          for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const lat = (1 - t) * (1 - t) * start[0] + 2 * (1 - t) * t * ctrlLat + t * t * end[0];
            const lng = (1 - t) * (1 - t) * start[1] + 2 * (1 - t) * t * ctrlLng + t * t * end[1];
            curvePoints.push([lat, lng]);
          }

          return (
            <Polyline 
              key={`line-${book.id}`}
              positions={curvePoints}
              pathOptions={{ 
                color: '#10B981', 
                weight: 1, 
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: '2, 4'
              }}
            />
          );
        })}

        {Array.from(new Set(plottedBooks.filter(b => (b as any).isSpidered).map(b => `${(b as any).originalLat},${(b as any).originalLng}`))).map(coordStr => {
          const [lat, lng] = coordStr.split(',').map(Number);
          return (
            <CircleMarker 
              key={`hub-${coordStr}`}
              center={[lat, lng]}
              radius={3}
              pathOptions={{ 
                fillColor: '#10B981', 
                fillOpacity: 1, 
                color: 'white', 
                weight: 2
              }}
            />
          );
        })}

        {plottedBooks.map((book) => (
          <Marker
            key={book.id}
            position={[book.lat, book.lng]}
            icon={createBookIcon(book, book.isNearby)}
            zIndexOffset={(book as any).zIndex || 0}
          >
            <Tooltip direction="top" offset={[0, -32]} opacity={1}>
              <div className="p-3 min-w-[160px] nm-flat bg-white rounded-xl">
                <div className="font-black text-[10px] uppercase text-[var(--c-ink)] tracking-tight leading-tight">{book.title}</div>
                <div className="text-[8px] font-bold text-[var(--c-ink)] uppercase mt-1 tracking-widest">{book.author}</div>
                <div className="text-[8px] font-black mt-2 text-[var(--c-emerald)] uppercase tracking-[0.2em]">{book.owner.name}</div>
              </div>
            </Tooltip>
            <Popup maxWidth={300} minWidth={240} closeButton={false}>
              <div className="p-3">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-24 nm-inset rounded-xl overflow-hidden flex-shrink-0 p-1.5 bg-gray-50">
                    {book.cover ? (
                      <img src={book.cover} alt={book.title} className="w-full h-full object-contain rounded-lg" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <BookOpen size={20} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-1">
                    <div className="font-black text-xs text-[var(--c-ink)] uppercase tracking-tight leading-tight mb-2">{book.title}</div>
                    <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest leading-none mb-3">{book.author}</div>
                    <div className="inline-block px-3 py-1 nm-inset rounded-lg text-[8px] font-black text-[var(--c-emerald)] uppercase tracking-widest">
                      {conditionLabels[book.condition] || book.condition}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest mb-4 nm-inset px-4 py-2.5 rounded-xl text-[var(--c-ink)]">
                  <span className="flex items-center gap-2 opacity-80">
                    <MapPin size={12} className="text-[var(--c-emerald)]" /> {book.distance.toFixed(1)}KM
                  </span>
                  <span className="text-[var(--c-emerald)]">{book.owner.name}</span>
                </div>
                <button
                  onClick={() => onRequestExchange?.(book.id)}
                  className="w-full nm-flat text-[var(--c-emerald)] py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-center hover:nm-inset active:scale-95 transition-all"
                >
                  REQUEST EXCHANGE
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute top-4 sm:top-8 left-4 sm:left-8 z-[1000] flex flex-col gap-2 sm:gap-4 max-w-[calc(100%-2rem)]">
        <div className="nm-flat bg-white px-3 sm:px-8 py-2 sm:py-5 rounded-lg sm:rounded-[2rem] flex items-center gap-2 sm:gap-6 text-[var(--c-ink)]">
          <div className="w-6 h-6 sm:w-12 sm:h-12 nm-inset rounded-md sm:rounded-2xl flex items-center justify-center text-[var(--c-emerald)]">
            <MapPin size={12} sm:size={24} />
          </div>
          <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">
            {books.filter((b) => b.isNearby).length} NEARBY <span className="mx-1 sm:mx-2 opacity-20">|</span> {books.length} GLOBAL
          </span>
        </div>
        
        {userLocation && (
            <button
              onClick={() => {
                const map = (window as any).leafletMap;
                if (map) map.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
              }}
              className="w-10 h-10 sm:w-12 sm:h-12 nm-flat bg-white rounded-xl sm:rounded-2xl flex items-center justify-center text-[var(--c-emerald)] hover:nm-inset transition-all"
              title="Recenter on me"
            >
              <Navigation size={18} sm:size={22} />
            </button>
        )}
      </div>

      <div className="absolute bottom-3 sm:bottom-8 left-3 sm:left-8 z-[1000] nm-flat bg-white p-2 sm:p-6 rounded-xl sm:rounded-[2rem] max-w-[calc(100%-1.5rem)]">
        <div className="hidden sm:block text-[9px] font-black uppercase tracking-[0.3em] text-[var(--c-ink)] opacity-30 mb-4 ml-2">LEGEND</div>
        <div className="flex flex-row sm:flex-col items-center gap-3 sm:gap-4 px-1 sm:px-0">
          <div className="flex items-center gap-1.5 sm:gap-6 text-[7px] sm:text-[11px] font-black uppercase tracking-widest text-[var(--c-ink)]">
            <div className="w-2.5 h-2.5 sm:w-5 sm:h-5 rounded-full bg-[var(--c-emerald)] border border-white shadow-[0_0_12px_rgba(16,185,129,0.6)]"></div>
            <span>YOU</span>
          </div>
          <div className="w-px h-2 bg-[var(--c-ink)] opacity-10 sm:hidden"></div>
          <div className="flex items-center gap-1.5 sm:gap-6 text-[7px] sm:text-[11px] font-black uppercase tracking-widest text-[var(--c-ink)]">
            <div className="w-2.5 h-3.5 sm:w-5 sm:h-6 bg-white border border-gray-100 rounded-[2px] sm:rounded-lg nm-flat" style={{boxShadow: '2px 2px 5px #bebebe'}}></div>
            <span>VOLUME</span>
          </div>
          <div className="w-px h-2 bg-[var(--c-ink)] opacity-10 sm:hidden"></div>
          <div className="flex items-center gap-1.5 sm:gap-6 text-[7px] sm:text-[11px] font-black uppercase tracking-widest text-[var(--c-ink)]">
            <div className="w-2.5 h-3.5 sm:w-5 sm:h-6 bg-white border border-gray-100 rounded-[2px] sm:rounded-lg nm-flat" style={{ boxShadow: '2px 2px 5px #bebebe' }}>
              <div style={{ width: '4px', height: '4px', background: '#10B981', borderRadius: '50%', margin: '2px 2px 0 auto', border: '1px solid white' }} className="hidden sm:block"></div>
              <div style={{ width: '2.5px', height: '2.5px', background: '#10B981', borderRadius: '50%', margin: '1px 1px 0 auto', border: '0.5px solid white' }} className="sm:hidden"></div>
            </div>
            <span>NEARBY</span>
          </div>
        </div>
      </div>
    </div>
  );
});

function MapViewManager({ center, zoom, onZoomChange }: { center: [number, number], zoom: number, onZoomChange?: (z: number) => void }) {
  const map = useMap();
  
  useEffect(() => {
    (window as any).leafletMap = map;
    return () => { delete (window as any).leafletMap; };
  }, [map]);

  useMapEvents({
    zoomend: () => {
      onZoomChange?.(map.getZoom());
    }
  });

  const hasInitializedRef = React.useRef(false);
  const prevCenterRef = React.useRef(center);

  useEffect(() => {
    if (!hasInitializedRef.current && center) {
      map.setView(center, zoom);
      hasInitializedRef.current = true;
      prevCenterRef.current = center;
      return;
    }

    const centerChanged = center[0] !== prevCenterRef.current[0] || center[1] !== prevCenterRef.current[1];
    if (centerChanged) {
      map.setView(center, zoom, { animate: true });
      prevCenterRef.current = center;
    }
  }, [center, zoom, map]);

  useEffect(() => {
    const run = () => map.invalidateSize();
    const timeout = setTimeout(run, 100);
    return () => clearTimeout(timeout);
  }, [map]);

  return null;
}

export default NearbyMapView;
