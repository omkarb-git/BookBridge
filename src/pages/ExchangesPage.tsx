import { useEffect, useState, useCallback, useMemo } from 'react';
import { MapPin, Star, RefreshCw, ClipboardList, Map as MapIcon, CheckCircle2, Navigation, CheckCircle, Loader2, X, ThumbsUp, MessageSquare, KeyRound, Maximize2, Minimize2, ChevronRight, Calendar, AlertTriangle } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, where, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { useExchangeActions } from '../hooks/useExchangeActions';
import LiveMap from '../components/LiveMap';
import NeumorphicCalendar from '../components/NeumorphicCalendar';
import { useLocationContext } from '../App';
import { haversineDistance } from '../hooks/useGeolocation';

interface ExchangesPageProps {
  onNavigate?: (page: string) => void;
}

type ExchangeTab = 'active' | 'history' | 'tracking';

const STATUS_CONFIG: Record<string, { label: string; text: string; bg: string }> = {
  pending: { label: 'Pending', text: 'text-amber-800', bg: 'bg-amber-100' },
  accepted: { label: 'Accepted', text: 'text-blue-800', bg: 'bg-blue-100' },
  meeting_scheduled: { label: 'Meeting Set', text: 'text-green-800', bg: 'bg-green-100' },
  in_transit: { label: 'In Progress', text: 'text-orange-800', bg: 'bg-orange-100' },
  completed: { label: 'Completed', text: 'text-gray-800', bg: 'bg-gray-100' },
  rejected: { label: 'Declined', text: 'text-red-800', bg: 'bg-red-100' },
  cancelled: { label: 'Cancelled', text: 'text-red-800', bg: 'bg-red-100' },
};

function LocationPickerModal({
  selected, user, meetingLocation, setMeetingLocation,
  meetingTime, setMeetingTime,
  manualMeetingPoint, handleMapClick, handleSearchLocation,
  isSearchingLoc, locationSearchResults, onSelectLocation, onConfirm, onClose
}: any) {
  const [showPanel, setShowPanel] = useState(true);
  return (
    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-xl md:p-12 flex items-center justify-center">
      <div className="nm-flat bg-white md:rounded-[4rem] w-full max-w-7xl h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="nm-flat p-4 md:p-6 flex items-center justify-between text-[var(--c-emerald)] relative z-10 shadow-2xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <MapIcon size={20} />
            <div className="font-black text-lg uppercase tracking-tighter">LOCATION SELECTOR</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPanel(p => !p)}
              title={showPanel ? 'Hide search panel' : 'Show search panel'}
              className="w-10 h-10 rounded-xl nm-inset flex items-center justify-center text-[var(--c-emerald)] text-xs font-black uppercase tracking-widest hover:nm-flat transition-all"
            >
              {showPanel ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-xl nm-inset flex items-center justify-center text-[var(--c-emerald)] hover:nm-flat transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Map + optional overlay panel */}
        <div className="flex-1 relative overflow-hidden">
          {/* Full-screen map */}
          <div className="absolute inset-0">
            <LiveMap
              exchangeId={selected.id}
              currentUserId={user?.uid || ''}
              partnerName={""}
              selectionMode={true}
              onMapClick={handleMapClick}
              meetingPoint={manualMeetingPoint}
            />
          </div>

          {/* Floating search panel — hidden when user dismisses */}
          {showPanel && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-md px-4">
              <div className="nm-flat bg-white/95 backdrop-blur-md p-6 rounded-[2rem] space-y-4 shadow-2xl">
                <div className="text-[8px] font-black uppercase tracking-[0.4em] opacity-40">ADDRESS SEARCH</div>
                <div className="relative">
                  <input
                    placeholder="Search places..."
                    value={meetingLocation}
                    onChange={(e) => { setMeetingLocation(e.target.value); handleSearchLocation(e.target.value); }}
                    className="w-full nm-inset rounded-xl p-4 text-sm font-bold uppercase focus:outline-none"
                  />
                  {isSearchingLoc && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[var(--c-emerald)]" />}
                </div>

                {/* Search Results */}
                {locationSearchResults && locationSearchResults.length > 0 && (
                  <div className="nm-inset rounded-xl p-2 max-h-40 overflow-y-auto space-y-1">
                    {locationSearchResults.map((item: any) => (
                      <button
                        key={item.place_id}
                        onClick={() => onSelectLocation(item)}
                        className="w-full text-left p-2 hover:nm-flat rounded-lg text-xs font-bold text-[var(--c-emerald)] truncate"
                      >
                        {item.display_name}
                      </button>
                    ))}
                  </div>
                )}

                {meetingLocation && (
                  <div className="nm-inset rounded-xl p-3">
                    <div className="text-[8px] font-black uppercase tracking-widest opacity-40 mb-1">SELECTED</div>
                    <div className="text-[11px] font-black text-[var(--c-emerald)] uppercase truncate">{meetingLocation}</div>
                  </div>
                )}
                {/* Date & Time */}
                <div className="space-y-2">
                  <div className="text-[8px] font-black uppercase tracking-[0.4em] opacity-40">DATE & TIME</div>
                  <NeumorphicCalendar
                    value={meetingTime}
                    onChange={setMeetingTime}
                    placeholder="Choose date & time"
                  />
                </div>
                <button
                  onClick={onConfirm}
                  disabled={!meetingLocation}
                  className="w-full nm-flat text-[var(--c-emerald)] py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100"
                >
                  CONFIRM LOCATION
                </button>
              </div>
            </div>
          )}

          {/* Floating toggle when panel is hidden */}
          {!showPanel && (
            <button
              onClick={() => setShowPanel(true)}
              className="absolute top-4 left-4 z-10 nm-flat bg-white px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-[var(--c-emerald)] flex items-center gap-2 shadow-xl hover:scale-105 transition-all"
            >
              <MapPin size={14} /> Show Panel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


export default function ExchangesPage({ onNavigate: _onNavigate }: ExchangesPageProps) {
  const [user, setUser] = useState<any>(null);
  const [tab, setTab] = useState<ExchangeTab>('active');
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExchangeId, setSelectedExchangeId] = useState<string | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingCoords, setMeetingCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [isLocationPickerExpanded, setIsLocationPickerExpanded] = useState(false);
  const [isMapPreviewExpanded, setIsMapPreviewExpanded] = useState(false);
  const [isSearchingLoc, setIsSearchingLoc] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [isOTPVerified] = useState(false);
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const { location: userLocation } = useLocationContext();

  const selected = useMemo(() => {
    const found = exchanges.find(e => e.id === selectedExchangeId);
    return found || null;
  }, [exchanges, selectedExchangeId]);

  // Geofence: compute distance (km) to locked meeting point
  const distanceToMeeting = useMemo(() => {
    if (!userLocation || !selected?.meetingCoords) return null;
    return haversineDistance(userLocation, selected.meetingCoords);
  }, [userLocation, selected?.meetingCoords?.lat, selected?.meetingCoords?.lng]);

  // 50 metres = 0.05 km
  const GEOFENCE_KM = 0.05;
  const withinGeofence = distanceToMeeting !== null && distanceToMeeting <= GEOFENCE_KM;

  const onNavigate = _onNavigate || (() => {});

  const manualMeetingPoint = useMemo(() => {
    if (!meetingCoords) return undefined;
    return { 
      lat: meetingCoords.lat, 
      lng: meetingCoords.lng, 
      address: meetingLocation 
    };
  }, [meetingCoords?.lat, meetingCoords?.lng, meetingLocation]);

  const handleMapClick = useCallback((loc: { lat: number, lng: number }) => {
    setMeetingCoords(loc);
    setMeetingLocation(`Custom Location (${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)})`);
  }, []);

  const handleSelectLocation = useCallback((item: any) => {
    setMeetingCoords({ lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setMeetingLocation(item.display_name);
    setLocationSearchResults([]);
  }, []);

  const normalizeLocationResults = (items: any[]) => {
    const mapped = items
      .map((item: any) => {
        if (item?.geometry?.coordinates) {
          return {
            place_id: item.properties?.osm_id || `${item.geometry.coordinates[1]}-${item.geometry.coordinates[0]}`,
            display_name: item.properties?.name
              ? `${item.properties.name}${item.properties.city ? `, ${item.properties.city}` : ''}${item.properties.state ? `, ${item.properties.state}` : ''}${item.properties.country ? `, ${item.properties.country}` : ''}`
              : item.properties?.label || 'Unknown location',
            lat: String(item.geometry.coordinates[1]),
            lon: String(item.geometry.coordinates[0]),
          };
        }
        if (item?.lat && item?.lon && item?.display_name) {
          return {
            place_id: item.place_id,
            display_name: item.display_name,
            lat: item.lat,
            lon: item.lon,
          };
        }
        return null;
      })
      .filter(Boolean);

    const seen = new Set<string>();
    return mapped.filter((item: any) => {
      const key = `${item.display_name}-${item.lat}-${item.lon}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const { acceptExchangeRequest, rejectExchangeRequest, proposeMeeting, approveMeeting, declineMeetingProposal, startTracking, confirmArrival, verifyOTP } = useExchangeActions({ currentUser: user });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'exchanges'),
        where('participants', 'array-contains', currentUser.uid)
      );

      const unsubscribeExchanges = onSnapshot(q, (snapshot) => {
        const exchangesData = snapshot.docs.map(entry => ({
          id: entry.id,
          ...entry.data()
        })).sort((a: any, b: any) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
          return timeB - timeA;
        });
        setExchanges(exchangesData);
        setLoading(false);
      });

      return () => unsubscribeExchanges();
    });

    return () => unsubscribeAuth();
  }, []);



  const activeExchanges = exchanges.filter(exchange => !['completed', 'rejected', 'cancelled'].includes(exchange.status));
  const historyExchanges = exchanges.filter(exchange => ['completed', 'rejected', 'cancelled'].includes(exchange.status));
  const incomingRequests = exchanges.filter(exchange => exchange.status === 'pending' && exchange.ownerId === user?.uid);

  const handleConfirmArrival = async () => {
    if (!selected) return;
    try {
      await confirmArrival(selected);
    } catch (err) {
      console.error('Error confirming arrival:', err);
    }
  };

  const handleVerifyOTP = async () => {
    if (!selected || !otpInput.trim()) return;
    setOtpError('');
    try {
      const result = await verifyOTP(selected, otpInput.trim());
      if (result) {
        setOtpInput('');
        setTab('history');
      } else {
        setOtpError('Wrong Code. Try Again.');
        setOtpInput('');
      }
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setOtpError('Verification Failed. Try Again.');
      setOtpInput('');
    }
  };

  const handleSubmitRating = async () => {
    if (!selected || !user) return;
    try {
      const partnerId = selected.participants?.find((participantId: string) => participantId !== user.uid);
      const bookId = user.uid === selected.requesterId ? selected.bookId : selected.offeredBookId;
      const bookTitle = user.uid === selected.requesterId ? selected.bookTitle : selected.offeredBookTitle;
      
      await addDoc(collection(db, 'ratings'), {
        exchangeId: selected.id,
        fromId: user.uid,
        toId: partnerId,
        bookId,
        bookTitle,
        rating,
        review,
        createdAt: serverTimestamp()
      });
      
      // Also store in exchange doc for easy access
      await updateDoc(doc(db, 'exchanges', selected.id), {
        [`ratings.${user.uid}`]: {
          rating,
          review,
          createdAt: serverTimestamp()
        }
      });

      setShowRatingModal(false);
      setRating(0);
      setReview('');
    } catch (err) {
      console.error('Error submitting rating:', err);
    }
  };

  const handleAccept = async (exchange: any) => {
    await acceptExchangeRequest(exchange);
    setSelectedExchangeId(exchange.id);
    setTab('active');
  };

  const handleConfirmLocation = async () => {
    if (!selected || !meetingLocation) return;
    try {
      await proposeMeeting(selected, meetingLocation, meetingTime, meetingCoords);
      setIsLocationPickerExpanded(false);
    } catch (err) {
      console.error('Error proposing meeting:', err);
    }
  };

  const handleReject = async (exchange: any) => {
    await rejectExchangeRequest(exchange);
    if (selectedExchangeId === exchange.id) setSelectedExchangeId(null);
  };

  const handleSearchLocation = async (query: string) => {
    if (query.length < 3) {
      setLocationSearchResults([]);
      return;
    }
    setIsSearchingLoc(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`);
      const items = await res.json();
      const merged = normalizeLocationResults(items);
      setLocationSearchResults(merged.slice(0, 8));
    } catch (err) {
      console.error('Error searching location:', err);
      setLocationSearchResults([]);
    } finally {
      setIsSearchingLoc(false);
    }
  };

  const trackingExchanges = exchanges.filter(exchange => ['meeting_scheduled', 'in_transit'].includes(exchange.status));
  const listExchanges = tab === 'active' ? activeExchanges : (tab === 'tracking' ? trackingExchanges : historyExchanges);

  return (
    <>
      <div className="h-[calc(100vh-4.5rem)] flex overflow-hidden bg-[var(--c-bg)] relative">
        {/* Sidebar List */}
        <div className={`w-full md:w-96 flex-shrink-0 bg-transparent overflow-y-auto flex flex-col z-20 transition-all p-4 sm:p-6 space-y-4 sm:space-y-6 ${selectedExchangeId ? 'hidden md:flex' : 'flex'}`}>
          <div className="nm-inset p-1.5 sm:p-2 rounded-2xl sm:rounded-[2rem] flex sticky top-0 bg-[var(--c-bg)] z-10">
            {(['active', 'history', 'tracking'] as ExchangeTab[]).map((item) => (
              <button
                key={item}
                onClick={() => setTab(item)}
                className={`flex-1 py-3 sm:py-4 px-2 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 ${
                  tab === item ? 'nm-flat text-[var(--c-emerald)]' : 'text-[var(--c-ink)] opacity-70 hover:opacity-100'
                }`}
              >
                {item === 'active' ? <RefreshCw size={12} /> : item === 'history' ? <ClipboardList size={12} /> : <Navigation size={12} />}
                <span className="inline">{item}</span>
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {incomingRequests.length > 0 && tab === 'active' && (
              <div className="nm-flat p-6 rounded-[2.5rem] bg-[var(--c-emerald)] bg-opacity-5 border border-[var(--c-emerald)] border-opacity-10">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--c-emerald)] mb-6 flex items-center gap-3">
                  <div className="w-8 h-8 nm-inset flex items-center justify-center rounded-lg">
                    <MessageSquare size={14} />
                  </div>
                  {incomingRequests.length} Pending Request{incomingRequests.length > 1 ? 's' : ''}
                </div>
                {incomingRequests.map((req) => (
                  <div key={req.id} className="nm-flat p-5 rounded-3xl mb-4 bg-white">
                    <div className="font-bold text-xs uppercase tracking-tight text-[var(--c-ink)] mb-1">{req.requesterName}</div>
                    <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest mb-6">
                      Wants <span className="text-[var(--c-emerald)]">{req.bookTitle}</span>
                    </div>
                    <div className="flex gap-4">
                      <button
                        onClick={() => handleAccept(req)}
                        className="flex-1 py-3 nm-flat text-[var(--c-emerald)] rounded-xl text-[9px] font-bold uppercase tracking-widest hover:scale-105 transition-all"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(req)}
                        className="flex-1 py-3 nm-flat text-[var(--c-ink)] opacity-80 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-red-500 transition-all"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {listExchanges.map((exchange) => {
              const statusConf = STATUS_CONFIG[exchange.status] || STATUS_CONFIG.pending;
              const isSelected = selectedExchangeId === exchange.id;
              return (
                <button
                  key={exchange.id}
                  onClick={() => setSelectedExchangeId(exchange.id)}
                  className={`w-full p-4 sm:p-6 text-left rounded-2xl sm:rounded-[2rem] transition-all group ${
                    isSelected ? 'nm-inset' : 'nm-flat hover:nm-inset'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="text-[9px] font-bold opacity-30 tracking-widest uppercase">ID: {exchange.id.substring(0, 8)}</div>
                    <span className={`px-3 py-1.5 nm-flat text-[8px] font-bold uppercase tracking-widest rounded-full ${statusConf.text} bg-opacity-80`}>
                      {statusConf.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 nm-inset rounded-xl flex items-center justify-center font-black text-[10px] text-[var(--c-emerald)]">
                      {(exchange.partner || exchange.requesterName || exchange.ownerName || 'U').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-black text-[var(--c-ink)] uppercase tracking-tighter line-clamp-1">{exchange.partner || (user?.uid === exchange.requesterId ? exchange.ownerName : exchange.requesterName)}</div>
                      <div className="text-[8px] font-bold text-[var(--c-ink)] opacity-40 uppercase tracking-widest mt-1">{exchange.bookTitle || exchange.offeredBookTitle}</div>
                    </div>
                  </div>
                </button>
              );
            })}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <div className="w-12 h-12 nm-inset rounded-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[var(--c-emerald)] animate-spin" />
                </div>
                <p className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 uppercase tracking-widest">Syncing Data...</p>
              </div>
            ) : listExchanges.length === 0 ? (
              <div className="nm-flat p-12 rounded-[2.5rem] text-center">
                <p className="text-[10px] font-bold text-[var(--c-emerald)] opacity-70 uppercase tracking-[0.2em]">No exchanges found</p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Details Panel */}
        <div className={`${selectedExchangeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col overflow-y-auto bg-transparent relative p-4 sm:p-6`}>
          {selected && (tab !== 'active' || !['completed', 'rejected', 'cancelled'].includes(selected.status)) ? (
            <div className="max-w-5xl mx-auto w-full space-y-10 relative z-10 animate-fade-up">
              <button 
                onClick={() => setSelectedExchangeId(null)}
                className="md:hidden flex items-center gap-3 mb-6 nm-flat px-6 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest text-[var(--c-emerald)]"
              >
                <RefreshCw className="rotate-180" size={14} />
                Return to List
              </button>

              <div className="nm-flat p-4 sm:p-5 md:p-6 rounded-[2rem] sm:rounded-[3rem] md:rounded-[3.5rem] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--c-emerald)] opacity-5 blur-3xl rounded-full -mr-32 -mt-32"></div>
                <div className="relative z-10">
                  <div className="inline-flex nm-inset text-[var(--c-emerald)] text-[9px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 mb-6 rounded-full">
                    SWAP ID: {selected.id.substring(0, 12)}
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-[var(--c-ink)] tracking-tight uppercase leading-none">
                    {user?.uid === selected.requesterId ? selected.ownerName : (selected.requesterName || selected.partner)}
                  </h2>
                  <div className="flex flex-wrap items-center gap-4 mt-8">
                    <div className="nm-inset px-6 py-3 rounded-2xl text-[11px] font-bold text-[var(--c-emerald)] uppercase tracking-widest flex items-center gap-3">
                      {user?.uid === selected.requesterId ? (selected.myBook || selected.offeredBookTitle) : (selected.theirBook || selected.bookTitle)}
                      <RefreshCw size={14} className="opacity-70" />
                      {user?.uid === selected.requesterId ? (selected.theirBook || selected.bookTitle) : (selected.myBook || selected.offeredBookTitle)}
                    </div>
                  </div>
                </div>
                <div className={`px-8 py-4 nm-inset rounded-2xl text-xs font-black uppercase tracking-[0.2em] ${(STATUS_CONFIG[selected.status] || STATUS_CONFIG.pending).text}`}>
                  {(STATUS_CONFIG[selected.status] || STATUS_CONFIG.pending).label}
                </div>
              </div>

              <div className="nm-flat p-4 sm:p-5 md:p-6 rounded-2xl md:rounded-[3rem]">
                <h3 className="text-[9px] sm:text-[10px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.4em] mb-5 sm:mb-6 text-center">Exchange Progression</h3>
                <div className="flex items-center justify-between relative max-w-3xl mx-auto overflow-x-auto no-scrollbar pb-2">
                  <div className="absolute top-7 left-10 right-10 h-1 nm-inset opacity-20 z-0 rounded-full"></div>
                  {[
                    { label: 'Requested', done: true, icon: RefreshCw },
                    { label: 'Accepted', done: ['accepted', 'meeting_scheduled', 'in_transit', 'completed'].includes(selected.status), icon: ThumbsUp },
                    { label: 'Meeting Set', done: ['meeting_scheduled', 'in_transit', 'completed'].includes(selected.status), icon: MapPin },
                    { label: 'In Transit', done: ['in_transit', 'completed'].includes(selected.status), icon: Navigation },
                    { label: 'Completed', done: selected.status === 'completed', icon: CheckCircle },
                  ].map((step) => (
                    <div key={step.label} className="relative z-10 flex flex-col items-center flex-shrink-0 w-20 sm:flex-1">
                      <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl nm-inset flex items-center justify-center transition-all duration-500 ${step.done ? 'text-[var(--c-emerald)] scale-110 shadow-lg' : 'text-[var(--c-ink)] opacity-20'}`}>
                        <step.icon size={18} />
                      </div>
                      <div className={`text-[8px] sm:text-[9px] font-extrabold uppercase tracking-widest mt-4 sm:mt-6 text-center transition-all ${step.done ? 'text-[var(--c-emerald)]' : 'text-[var(--c-ink)] opacity-60'}`}>
                        {step.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-h-0">

                {/* Main Interaction Column */}
                <div className="flex flex-col min-h-0 space-y-8">
                  <div className="flex-1 flex flex-col space-y-8 no-scrollbar pb-20">
                    {/* Action Header - single prominent MESSAGE button */}
                    <div className="nm-flat rounded-[2rem] p-3 sm:p-4 flex items-center justify-between gap-4 bg-[var(--c-bg)] sticky top-0 z-20 shadow-xl">
                      <div className="flex items-center gap-3">
                        <div className="text-[8px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.3em]">STATUS</div>
                        <div className="nm-inset px-4 py-2 rounded-lg text-[10px] font-black text-[var(--c-emerald)] uppercase tracking-widest">{(selected.status || 'pending').replace(/_/g, ' ')}</div>
                      </div>
                      <button
                        onClick={() => onNavigate('messages')}
                        className="nm-flat px-6 py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl" style={{backgroundColor: 'var(--c-emerald)', color: 'white'}}
                      >
                        <MessageSquare size={16} />
                        MESSAGE {(selected.partner || (user?.uid === selected.requesterId ? selected.ownerName : selected.requesterName) || 'Partner').toUpperCase()}
                      </button>
                    </div>

                    {/* Main Interaction Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      <div className="lg:col-span-5 space-y-5">
                        <div className="nm-flat p-6 rounded-[2.5rem] space-y-5 relative overflow-hidden">
                          {/* Header row */}
                          <div className="flex items-center justify-between">
                            <div className="text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-[0.4em]">MEETING INFO</div>
                            {/* Only show SET/CHANGE before the meeting is locked */}
                            {!selected.meetingLocked && (
                              <button
                                onClick={() => setIsLocationPickerExpanded(true)}
                                className="nm-inset px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-[var(--c-emerald)] hover:nm-flat transition-all"
                              >
                                {selected.proposedMeeting ? 'CHANGE' : 'SET'}
                              </button>
                            )}
                          </div>

                          <div className="space-y-4">
                            {/* Location */}
                            <div className="space-y-2">
                              <label className="text-[8px] font-black uppercase tracking-widest opacity-30 ml-2">LOCATION</label>
                              {selected.meetingLocked && (selected.meetingLocation || selected.meeting) ? (
                                <div className="nm-inset p-4 rounded-2xl flex items-start gap-3">
                                  <MapPin size={14} className="text-[var(--c-emerald)] mt-0.5 flex-shrink-0" />
                                  <span className="text-[11px] font-black text-[var(--c-ink)] uppercase tracking-tight leading-tight">{selected.meetingLocation || selected.meeting}</span>
                                </div>
                              ) : selected.proposedMeeting ? (
                                <div className="space-y-2">
                                  <div className="nm-inset p-4 rounded-2xl flex items-start gap-3">
                                    <MapPin size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-[11px] font-black text-[var(--c-ink)] uppercase tracking-tight leading-tight">{selected.proposedMeeting}</span>
                                  </div>
                                  <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest ml-1">⏳ PENDING PARTNER APPROVAL</div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setIsLocationPickerExpanded(true)}
                                  className="w-full text-left nm-inset p-4 rounded-2xl text-[10px] font-black uppercase tracking-tight text-[var(--c-ink)] hover:nm-flat transition-all flex items-center justify-between group opacity-50"
                                >
                                  <span>Not Set Yet — Tap to Set</span>
                                  <ChevronRight size={14} className="opacity-50" />
                                </button>
                              )}
                            </div>

                            {/* Time */}
                            <div className="space-y-2">
                              <label className="text-[8px] font-black uppercase tracking-widest opacity-30 ml-2">TIME</label>
                              {selected.meetingLocked && (selected.meetingTime || selected.meetingDate) ? (
                                <div className="nm-inset p-4 rounded-2xl flex items-center gap-3">
                                  <Calendar size={14} className="text-[var(--c-emerald)] flex-shrink-0" />
                                  <span className="text-[11px] font-black text-[var(--c-ink)] uppercase tracking-tight">{selected.meetingTime || selected.meetingDate}</span>
                                </div>
                              ) : selected.proposedMeetingTime ? (
                                <div className="nm-inset p-4 rounded-2xl flex items-center gap-3">
                                  <Calendar size={14} className="text-amber-500 flex-shrink-0" />
                                  <span className="text-[11px] font-black text-[var(--c-ink)] uppercase tracking-tight">
                                    {new Date(selected.proposedMeetingTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                  </span>
                                </div>
                              ) : (
                                <div className="nm-inset p-4 rounded-2xl flex items-center gap-3 opacity-50">
                                  <Calendar size={14} className="text-[var(--c-ink)]" />
                                  <span className="text-[10px] font-black text-[var(--c-ink)] uppercase tracking-tight">Not Scheduled</span>
                                </div>
                              )}
                            </div>

                            {/* Approve / Decline buttons for the OTHER user */}
                            {selected.proposedMeeting && !selected.meetingLocked && selected.proposedBy !== user?.uid && (
                              <div className="flex gap-3 pt-1">
                                <button
                                  onClick={() => approveMeeting(selected)}
                                  disabled={!selected.proposedMeetingTime}
                                  title={!selected.proposedMeetingTime ? 'Date & time must be set before approving' : ''}
                                  className="flex-1 nm-flat text-[var(--c-emerald)] py-3 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
                                >
                                  ✓ APPROVE
                                </button>
                                <button
                                  onClick={() => declineMeetingProposal(selected)}
                                  className="flex-1 nm-inset py-3 rounded-xl text-[9px] font-black uppercase tracking-widest text-red-500 hover:nm-flat transition-all"
                                >
                                  ✕ DECLINE
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-7 flex flex-col space-y-8 min-h-[400px]">
                        {selected.status === 'in_transit' || selected.status === 'meeting_scheduled' || selected.status === 'completed' ? (
                          <div className="flex-1 flex flex-col space-y-8">
                            <div className="flex-1 nm-inset rounded-[3rem] overflow-hidden relative border-4 border-white shadow-2xl min-h-[300px]">
                              <LiveMap 
                                exchangeId={selected.id} 
                                currentUserId={user?.uid || ''} 
                                partnerName={selected.partner} 
                                meetingPoint={selected.meetingCoords}
                                zoom={14}
                                isLocked={selected.status === 'completed' || selected.meetingLocked}
                              />
                              <div className="absolute top-6 right-6 z-[1000]">
                                <button 
                                  onClick={() => setIsMapPreviewExpanded(true)}
                                  className="w-12 h-12 nm-flat bg-white rounded-2xl flex items-center justify-center text-[var(--c-ink)] hover:text-[var(--c-emerald)] transition-colors shadow-2xl"
                                >
                                  <Maximize2 size={20} />
                                </button>
                              </div>
                            </div>

                            <div className="nm-flat p-6 rounded-[2.5rem] space-y-5">
                              {/* START JOURNEY — meeting_scheduled state */}
                              {selected.status === 'meeting_scheduled' && !selected.arrived?.[user?.uid] && !withinGeofence && (
                                <button
                                  onClick={() => startTracking(selected)}
                                  className="w-full nm-flat py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 text-[var(--c-emerald)]"
                                >
                                  <Navigation size={16} /> START JOURNEY
                                </button>
                              )}

                              {/* OTP section — only visible after both arrive */}
                              {(selected.status === 'in_transit' || selected.status === 'meeting_scheduled') && selected.otpsGenerated && (
                                <>
                                  {/* YOUR CODE — show this to partner */}
                                  <div className="space-y-2">
                                    <div className="text-[8px] font-black text-[var(--c-emerald)] uppercase tracking-[0.3em]">YOUR SWAP CODE — Show this to your partner</div>
                                    <div className="nm-inset rounded-xl py-5 text-center">
                                      <span className="text-4xl font-black tracking-[0.5em] text-[var(--c-emerald)] select-all">
                                        {selected.otpCodes?.[user?.uid] || '------'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* PARTNER'S CODE — enter what they show you */}
                                  {!selected.otpVerified?.[user?.uid] && (
                                    <div className="space-y-2">
                                      <div className="text-[8px] font-black text-[var(--c-ink)] opacity-40 uppercase tracking-[0.3em]">Enter Your Partner's Code</div>
                                      <div className="flex gap-3">
                                        <input
                                          value={otpInput}
                                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                          placeholder="000000"
                                          maxLength={6}
                                          className="flex-1 text-center text-2xl font-black tracking-[0.4em] nm-inset rounded-xl py-4 px-3 text-[var(--c-ink)] focus:outline-none min-w-0"
                                        />
                                        <button onClick={handleVerifyOTP} className="nm-flat text-[var(--c-emerald)] px-5 rounded-xl shadow-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                                          <KeyRound size={16} />
                                          VERIFY
                                        </button>
                                      </div>
                                      {otpError && (
                                        <div className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mt-2 text-center">{otpError}</div>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Waiting for both to arrive */}
                              {(selected.status === 'in_transit' || selected.status === 'meeting_scheduled') && !selected.otpsGenerated && (
                                <div className="nm-inset rounded-xl p-4 text-center space-y-1">
                                  <div className="text-[9px] font-black text-[var(--c-ink)] opacity-40 uppercase tracking-widest">Swap codes appear once both of you arrive</div>
                                </div>
                              )}

                              {/* CONFIRM ARRIVAL — geofenced to 50m */}
                              {!selected.arrived?.[user?.uid] && (selected.status === 'in_transit' || selected.status === 'meeting_scheduled') && (
                                <>
                                  {!userLocation ? (
                                    <div className="nm-flat bg-amber-500 text-white p-4 rounded-xl text-center flex items-center justify-center gap-3">
                                      <AlertTriangle size={16} />
                                      <span className="text-[9px] font-black uppercase tracking-widest">GPS Required — Enable Location</span>
                                    </div>
                                  ) : withinGeofence ? (
                                    <button
                                      onClick={handleConfirmArrival}
                                      className="w-full nm-flat text-[var(--c-emerald)] py-5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3"
                                    >
                                      <MapPin size={16} /> CONFIRM ARRIVAL
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="w-full nm-inset py-5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-[var(--c-ink)] opacity-40 flex items-center justify-center gap-3 cursor-not-allowed"
                                    >
                                      <Navigation size={16} />
                                      {distanceToMeeting !== null
                                        ? `${(distanceToMeeting * 1000).toFixed(0)}M AWAY — GET CLOSER`
                                        : 'CALCULATING DISTANCE...'}
                                    </button>
                                  )}
                                </>
                              )}
                              {selected.arrived?.[user?.uid] && (
                                <div className="nm-flat bg-[var(--c-emerald)] bg-opacity-10 border border-[var(--c-emerald)] border-opacity-30 p-4 rounded-xl text-center text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-widest flex items-center justify-center gap-2">
                                  <CheckCircle size={14} /> {selected.otpVerified?.[user?.uid] ? 'Code Verified' : 'You Have Arrived'}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 nm-inset rounded-[3rem] flex flex-col items-center justify-center p-20 text-center opacity-10">
                            <Navigation size={64} className="mb-6" />
                            <div className="text-xs font-black uppercase tracking-[0.5em]">TRACKING INACTIVE</div>
                          </div>
                        )}
                        {selected.status === 'completed' && (
                          <div className="nm-flat bg-[var(--c-emerald)] p-10 rounded-[3rem] text-white text-center relative overflow-hidden">
                            <CheckCircle2 size={32} className="mx-auto mb-4" />
                            <h3 className="text-xl font-black uppercase mb-2">Complete!</h3>
                            {selected.ratings?.[user.uid] ? (
                              <div className="w-full bg-white text-[var(--c-emerald)] py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map(s => (
                                    <Star key={s} size={12} className={s <= selected.ratings[user.uid].rating ? 'fill-[var(--c-emerald)]' : 'opacity-20'} />
                                  ))}
                                </div>
                                <span>YOU RATED</span>
                              </div>
                            ) : (
                              <button onClick={() => setShowRatingModal(true)} className="w-full bg-white text-[var(--c-emerald)] py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-2">
                                <Star size={16} className="fill-[var(--c-emerald)]" /> RATE
                              </button>
                            )}
                            
                            {/* Show partner's rating if available */}
                            {(() => {
                              const partnerId = selected.participants?.find((id: string) => id !== user.uid);
                              const partnerRating = selected.ratings?.[partnerId];
                              if (partnerRating) {
                                return (
                                  <div className="mt-4 p-5 nm-inset rounded-xl text-[11px] font-bold text-[var(--c-ink)] uppercase text-left">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[var(--c-emerald)] font-black">PARTNER'S RATING</span>
                                      <div className="flex">
                                        {[1, 2, 3, 4, 5].map(s => (
                                          <Star key={s} size={12} className={s <= partnerRating.rating ? 'fill-yellow-400 text-yellow-400' : 'opacity-20'} />
                                        ))}
                                      </div>
                                    </div>
                                    <p className="opacity-80 normal-case text-xs font-medium">{partnerRating.review || 'No review left'}</p>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-[var(--c-ink)] z-10 relative">
              <div className="w-24 h-24 nm-inset rounded-[2.5rem] flex items-center justify-center mb-8 text-[var(--c-emerald)] animate-float">
                <RefreshCw size={40} className="opacity-20" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight text-[var(--c-ink)] opacity-80 mb-2">SELECT AN EXCHANGE</h3>
              <p className="text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-[0.4em] nm-flat px-6 py-3 rounded-full">ACTIVE TRANSACTIONS READY</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showRatingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-[1000] flex items-center justify-center p-6">
          <div className="nm-flat bg-white rounded-[4rem] w-full max-w-lg overflow-hidden animate-fade-up">
            <div className="px-10 py-8 nm-flat flex items-center justify-between text-[var(--c-emerald)]">
              <h3 className="font-black uppercase tracking-[0.2em] text-sm">RATE EXPERIENCE</h3>
              <button onClick={() => setShowRatingModal(false)} className="w-10 h-10 rounded-full nm-flat flex items-center justify-center text-[var(--c-emerald)] hover:scale-105 transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-12 text-center space-y-10">
              <div className="w-24 h-24 nm-inset rounded-[2.5rem] flex items-center justify-center mx-auto">
                <Star size={48} className="fill-[var(--c-emerald)] text-[var(--c-emerald)]" />
              </div>
              <div className="space-y-3">
                <p className="text-[10px] font-black opacity-30 uppercase tracking-[0.3em]">YOUR FEEDBACK</p>
                <div className="text-2xl font-black uppercase tracking-tight">
                  {selected && (user?.uid === selected.requesterId ? selected.ownerName : (selected.requesterName || selected.partner))}
                </div>
              </div>
              <div className="flex justify-center gap-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setRating(star)} className="focus:outline-none transition-all hover:scale-115 hover:rotate-12 active:scale-95">
                    <Star size={48} className={star <= rating ? 'fill-yellow-400 text-yellow-400 shadow-xl' : 'text-[var(--c-ink)] opacity-10'} strokeWidth={2} />
                  </button>
                ))}
              </div>
              <textarea
                value={review}
                onChange={e => setReview(e.target.value)}
                className="w-full nm-inset rounded-3xl p-8 text-sm focus:outline-none h-40 resize-none font-medium placeholder:opacity-30 uppercase"
                placeholder="DETAILS ABOUT CONDITION..."
              />
              <div className="flex gap-6">
                <button onClick={() => setShowRatingModal(false)} className="flex-1 nm-inset py-5 rounded-2xl text-[10px] font-black uppercase opacity-70">CANCEL</button>
                <button onClick={handleSubmitRating} className="flex-1 nm-flat text-[var(--c-emerald)] py-5 rounded-2xl text-[10px] font-black uppercase shadow-xl disabled:opacity-50" disabled={rating === 0}>SUBMIT</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && isLocationPickerExpanded && (
        <LocationPickerModal
          selected={selected}
          user={user}
          meetingLocation={meetingLocation}
          setMeetingLocation={setMeetingLocation}
          meetingTime={meetingTime}
          setMeetingTime={setMeetingTime}
          manualMeetingPoint={manualMeetingPoint}
          handleMapClick={handleMapClick}
          handleSearchLocation={handleSearchLocation}
          isSearchingLoc={isSearchingLoc}
          locationSearchResults={locationSearchResults}
          onSelectLocation={handleSelectLocation}
          onConfirm={handleConfirmLocation}
          onClose={() => setIsLocationPickerExpanded(false)}
        />
      )}

      {selected && isMapPreviewExpanded && (
        <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-xl md:p-12 flex items-center justify-center">
          <div className="nm-flat bg-white md:rounded-[4rem] w-full max-w-7xl h-full flex flex-col overflow-hidden">
            <div className="nm-flat p-6 md:p-10 flex items-center justify-between">
              <div className="font-black text-2xl uppercase text-[var(--c-emerald)]">VIEWPORT</div>
              <button onClick={() => setIsMapPreviewExpanded(false)} className="w-14 h-14 rounded-2xl nm-flat flex items-center justify-center text-[var(--c-emerald)] hover:scale-105 transition-all shadow-lg">
                <Minimize2 size={28} />
              </button>
            </div>
            <div className="flex-1 relative overflow-hidden">
              <LiveMap 
                exchangeId={selected.id} 
                currentUserId={user?.uid || ''} 
                partnerName={user?.uid === selected.requesterId ? selected.ownerName : (selected.requesterName || selected.partner)} 
                meetingPoint={selected.meetingCoords}
                isLocked={selected.meetingLocked}
                zoom={16}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
