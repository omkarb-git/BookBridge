import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Target, Navigation, LocateFixed, Plus, Minus } from 'lucide-react';
import { haversineDistance } from '../hooks/useGeolocation';
import { useLocationContext } from '../App';

// Fix for default Leaflet icon missing in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Location {
  lat: number;
  lng: number;
}

interface LiveMapProps {
  exchangeId: string;
  currentUserId: string;
  partnerName: string;
  meetingPoint?: Location & { address?: string };
  onMapClick?: (loc: Location) => void;
  selectionMode?: boolean;
  isLocked?: boolean;
  zoom?: number;
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

function createPartnerIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:22px;height:22px;background:#C1121F;border:4px solid white;border-radius:50%;box-shadow:0 0 10px rgba(193,18,31,0.6);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

function createMeetingIcon(isLocked: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:36px; height:48px; background:white; border-radius:12px; box-shadow: 6px 6px 12px #bebebe, -6px -6px 12px #ffffff; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:4px;">
        <div style="width:100%; height:100%; border-radius:8px; background:#1B4332; display:flex; align-items:center; justify-content:center; box-shadow: inset 2px 2px 5px rgba(0,0,0,0.2);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            ${isLocked 
              ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>'
              : '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>'
            }
          </svg>
        </div>
      </div>`,
    iconSize: [36, 48],
    iconAnchor: [18, 48],
    popupAnchor: [0, -48],
  });
}

function createSelectionIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `
      <div style="width:36px;height:36px;background:white;border-radius:12px;box-shadow: 6px 6px 12px #bebebe, -6px -6px 12px #ffffff;display:flex;align-items:center;justify-content:center;animation:bounce 1s ease infinite;">
        <div style="width:28px;height:28px;background:#F5C518;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow: inset 2px 2px 5px rgba(0,0,0,0.1);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>
          </svg>
        </div>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

function RouteLayer({ from, to }: { from: Location, to: Location }) {
  const [route, setRoute] = useState<[number, number][]>([]);

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`);
        const data = await response.json();
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]]);
          setRoute(coords);
        }
      } catch (err) {
        console.error("Failed to fetch route:", err);
      }
    };
    if (from && to) fetchRoute();
  }, [from.lat, from.lng, to.lat, to.lng]);

  if (route.length === 0) return null;

  return (
    <Polyline 
      positions={route} 
      pathOptions={{ 
        color: '#10B981', 
        weight: 6, 
        opacity: 0.6, 
        dashArray: '10, 15',
        lineCap: 'round'
      }} 
    />
  );
}

function ZoomButtons() {
  const map = useMap();
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[400] flex flex-col gap-3">
      <button 
        onClick={() => map.zoomIn()}
        className="w-12 h-12 nm-flat bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-[var(--c-emerald)] hover:nm-inset transition-all active:scale-95 shadow-xl border border-white"
        title="Zoom In"
      >
        <Plus size={24} strokeWidth={3} />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-12 h-12 nm-flat bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-[var(--c-emerald)] hover:nm-inset transition-all active:scale-95 shadow-xl border border-white"
        title="Zoom Out"
      >
        <Minus size={24} strokeWidth={3} />
      </button>
    </div>
  );
}

function MapEvents({ onClick }: { onClick?: (loc: Location) => void }) {
  useMapEvents({
    click(e) {
      if (onClick) {
        onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

function MapViewManager({ center, zoom, points }: { center: [number, number], zoom: number, points?: Location[] }) {
  const map = useMap();
  const hasInitializedRef = useRef(false);
  const prevCenterRef = useRef<[number, number]>(center);

  useEffect(() => {
    if (!hasInitializedRef.current && center) {
      map.setView(center, zoom);
      hasInitializedRef.current = true;
      prevCenterRef.current = center;
      return;
    }

    if (points && points.length > 1) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lng]));
      const currentBounds = map.getBounds();
      if (!currentBounds.contains(bounds.getNorthEast()) || !currentBounds.contains(bounds.getSouthWest())) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15, animate: true });
      }
    } else if (center) {
      const centerChanged = center[0] !== prevCenterRef.current[0] || center[1] !== prevCenterRef.current[1];
      if (centerChanged) {
        map.setView(center, map.getZoom(), { animate: true });
        prevCenterRef.current = center;
      }
    }
  }, [center, zoom, points, map]);

  useEffect(() => {
    const run = () => map.invalidateSize();
    const timeout = setTimeout(run, 100);
    return () => clearTimeout(timeout);
  }, [map]);

  return null;
}

const LiveMap = memo(function LiveMap({ exchangeId, currentUserId, partnerName, meetingPoint, onMapClick, selectionMode, isLocked, zoom }: LiveMapProps) {
  const [myLoc, setMyLoc] = useState<Location | null>(null);
  const [partnerLoc, setPartnerLoc] = useState<Location | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [shouldFollow, setShouldFollow] = useState(true);
  const lastUpdateRef = useRef<number>(0);

  const userIcon = useMemo(() => createUserIcon(), []);
  const partnerIcon = useMemo(() => createPartnerIcon(), []);
  const meetingIcon = useMemo(() => createMeetingIcon(isLocked ?? false), [isLocked]);
  const selectionIcon = useMemo(() => createSelectionIcon(), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!myLoc && !selectionMode) {
        setShowLoading(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [myLoc, selectionMode]);

  const { location: globalLoc } = useLocationContext();

  useEffect(() => {
    if (globalLoc) {
      setMyLoc(globalLoc);
    }
  }, [globalLoc]);

  useEffect(() => {
    if (selectionMode) return;

    const unsubscribe = onSnapshot(doc(db, 'exchanges', exchangeId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.locations) {
          const pId = Object.keys(data.locations).find(id => id !== currentUserId);
          if (pId && data.locations[pId]) {
            setPartnerLoc(data.locations[pId]);
          }
          if (!globalLoc && data.locations[currentUserId]) {
            setMyLoc(data.locations[currentUserId]);
          }
        }
      }
    });

    const syncInterval = setInterval(() => {
      if (globalLoc && !selectionMode) {
        const now = Date.now();
        if (now - lastUpdateRef.current > 10000) {
          lastUpdateRef.current = now;
          updateDoc(doc(db, 'exchanges', exchangeId), {
            [`locations.${currentUserId}`]: globalLoc
          }).catch(console.error);
        }
      }
    }, 10000);

    return () => {
      unsubscribe();
      clearInterval(syncInterval);
    };
  }, [exchangeId, currentUserId, selectionMode, globalLoc]);

  const center = useMemo<[number, number]>(() => {
    if (meetingPoint) return [meetingPoint.lat, meetingPoint.lng];
    if (myLoc) return [myLoc.lat, myLoc.lng];
    return [19.076, 72.8777];
  }, [meetingPoint?.lat, meetingPoint?.lng, myLoc?.lat, myLoc?.lng]);

  const pointsToFit = useMemo(() => {
    if (selectionMode) return undefined;
    const pts: Location[] = [];
    if (myLoc) pts.push(myLoc);
    if (partnerLoc) pts.push(partnerLoc);
    if (meetingPoint) pts.push(meetingPoint);
    return pts.length > 0 ? pts : undefined;
  }, [myLoc, partnerLoc, meetingPoint, selectionMode]);

  return (
    <div className="relative w-full h-full min-h-[300px] nm-flat rounded-[2.5rem] overflow-hidden p-2">
      <div className="w-full h-full rounded-[2rem] overflow-hidden">
        <MapContainer 
          key={exchangeId}
          center={center} 
          zoom={zoom || 15} 
          style={{ width: '100%', height: '100%', zIndex: 0 }}
          zoomControl={false}
          scrollWheelZoom={true}
        >
          <TileLayer
            url="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-07-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg"
            attribution='&copy; <a href="https://earthdata.nasa.gov/gibs">NASA GIBS</a>'
            maxZoom={18}
          />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={0.6}
            maxZoom={18}
          />
          <ZoomButtons />
          <MapEvents onClick={onMapClick} />
          {shouldFollow && <MapViewManager center={center} zoom={zoom || 15} points={pointsToFit} />}
          
          {isLocked && myLoc && meetingPoint && (
            <RouteLayer from={myLoc} to={meetingPoint} />
          )}
          
          {myLoc && (
            <Marker position={[myLoc.lat, myLoc.lng]} icon={userIcon}>
              <Popup>
                <div className="p-2 text-center font-black uppercase text-[10px] tracking-widest text-[var(--c-emerald)]">YOU</div>
              </Popup>
            </Marker>
          )}
          
          {partnerLoc && (
            <Marker position={[partnerLoc.lat, partnerLoc.lng]} icon={partnerIcon}>
              <Popup>
                <div className="p-2 text-center font-black uppercase text-[10px] tracking-widest text-red-500">{partnerName}</div>
              </Popup>
            </Marker>
          )}

          {meetingPoint && (
            <Marker position={[meetingPoint.lat, meetingPoint.lng]} icon={selectionMode ? selectionIcon : meetingIcon}>
              <Popup>
                <div className="p-2 text-center">
                  <div className="font-black text-[10px] uppercase tracking-widest text-[var(--c-emerald)]">
                    {isLocked ? 'LOCKED' : 'POINT'}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {meetingPoint && !selectionMode && (
            <Circle
              center={[meetingPoint.lat, meetingPoint.lng]}
              radius={100}
              pathOptions={{ color: '#10B981', weight: 2, dashArray: '10 10', fillColor: '#10B981', fillOpacity: 0.05 }}
            />
          )}
        </MapContainer>
      </div>

      {!selectionMode && (
        <button
          onClick={() => setShouldFollow(!shouldFollow)}
          className={`absolute top-4 sm:top-6 left-4 sm:left-6 z-[1000] w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center bg-white text-[var(--c-emerald)] ${shouldFollow ? 'nm-inset' : 'nm-flat'}`}
          title={shouldFollow ? "Following location" : "Resume following"}
        >
          <LocateFixed size={18} sm:size={22} />
        </button>
      )}
      
      {!myLoc && !selectionMode && showLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-xl z-10 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <Target size={48} className="text-[var(--c-emerald)] animate-pulse mb-6" />
          <div className="nm-flat bg-white px-8 py-4 rounded-2xl">
            <p className="font-black text-[var(--c-ink)] uppercase text-xs tracking-[0.3em]">
              ACQUIRING SIGNAL...
            </p>
          </div>
        </div>
      )}
      
      {selectionMode && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[1000] w-max">
          <div className="nm-flat bg-white px-6 py-3 rounded-2xl">
            <p className="font-black text-[var(--c-ink)] uppercase text-[9px] tracking-[0.3em]">
              SELECT MEETING COORDINATES
            </p>
          </div>
        </div>
      )}

      {!selectionMode && meetingPoint && (myLoc || partnerLoc) && (
        <div className="absolute bottom-4 sm:bottom-6 left-4 sm:left-6 right-4 sm:right-6 z-[1000] flex gap-2 sm:gap-4">
          {myLoc && (
            <div className="flex-1 nm-flat px-4 sm:px-6 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 transition-all bg-white">
              <Navigation size={16} className="text-[var(--c-emerald)]" />
              <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap text-[var(--c-emerald)]">
                YOU: {haversineDistance(myLoc, meetingPoint) < 0.05 ? 'ARRIVED' : haversineDistance(myLoc, meetingPoint) < 1 ? `${(haversineDistance(myLoc, meetingPoint) * 1000).toFixed(0)}M` : `${haversineDistance(myLoc, meetingPoint).toFixed(1)}KM`}
              </span>
            </div>
          )}
          {partnerLoc && (
            <div className="flex-1 nm-flat px-4 sm:px-6 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3 transition-all bg-white">
              <Navigation size={16} className={haversineDistance(partnerLoc, meetingPoint) < 0.05 ? 'text-[var(--c-emerald)]' : 'text-red-500'} />
              <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${haversineDistance(partnerLoc, meetingPoint) < 0.05 ? 'text-[var(--c-emerald)]' : 'text-[var(--c-ink)]'}`}>
                {partnerName.toUpperCase()}: {haversineDistance(partnerLoc, meetingPoint) < 0.05 ? 'ARRIVED' : haversineDistance(partnerLoc, meetingPoint) < 1 ? `${(haversineDistance(partnerLoc, meetingPoint) * 1000).toFixed(0)}M` : `${haversineDistance(partnerLoc, meetingPoint).toFixed(1)}KM`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default LiveMap;
