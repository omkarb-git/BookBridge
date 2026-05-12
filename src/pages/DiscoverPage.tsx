import { useEffect, useState, useContext } from 'react';
import { Search, Map, Grid, List, SlidersHorizontal, X, Target, MapPin, Inbox, BookOpen, Star, Loader2, CheckCircle2, ArrowLeftRight } from 'lucide-react';
import { collection, onSnapshot, query, where, doc, getDoc, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { GENRES } from '../data/mockData';
import { db, auth } from '../lib/firebase';
import BookCard from '../components/BookCard';
import NearbyMapView from '../components/NearbyMapView';
import { normalizeBookCover } from '../lib/bookCovers';
import { LocationContext } from '../App';
import { haversineDistance } from '../hooks/useGeolocation';
import { useExchangeActions } from '../hooks/useExchangeActions';
import { searchAll, BookResult } from '../services/bookService';
import CustomDropdown from '../components/CustomDropdown';

interface DiscoverPageProps {
  onNavigate: (page: string) => void;
}

type DiscoverBook = {
  id: string;
  title: string;
  author: string;
  genre: string;
  condition: string;
  cover?: string;
  owner: { name: string; rating: number; exchanges: number; avatar: string };
  ownerId?: string;
  ownerName?: string;
  distance?: number;
  isMutualMatch?: boolean;
  wants: string;
  city: string;
  status: string;
  isbn?: string;
  googleId?: string;
  location?: { lat: number; lng: number };
  description?: string;
};

export default function DiscoverPage({ onNavigate }: DiscoverPageProps) {
  const [books, setBooks] = useState<DiscoverBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list' | 'map'>('grid');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedCondition, setSelectedCondition] = useState<string[]>([]);
  const [selectedDistance, setSelectedDistance] = useState('any');
  const [mutualMatchOnly, setMutualMatchOnly] = useState(false);

  const { location: userLocation } = useContext(LocationContext);



  // Real-time listener for books
  useEffect(() => {
    // Fetch all books and filter client-side so books without explicit 'available' still show
    const q = query(collection(db, 'books'));
    const userLocationCache: Record<string, any> = {};
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const currentUid = auth.currentUser?.uid;
      const normalizedBooks = (await Promise.all(snapshot.docs.map(async (entry) => {
          const data = entry.data() as Record<string, unknown>;
          const title = typeof data.title === 'string' ? data.title.trim() : '';
          const author = typeof data.author === 'string' ? data.author.trim() : '';

          if (!title || !author) return null;

          // Skip own books
          const ownerId = typeof data.ownerId === 'string' ? data.ownerId : undefined;
          if (ownerId === currentUid) return null;

          const owner = typeof data.owner === 'object' && data.owner !== null ? data.owner as any : null;
          const ownerName = typeof data.ownerName === 'string' && data.ownerName.trim() ? data.ownerName : 'Reader';

          let bookLocation = typeof data.location === 'object' && data.location !== null 
            ? data.location as { lat: number; lng: number } 
            : undefined;

          if (!bookLocation && ownerId) {
            try {
              if (userLocationCache[ownerId]) {
                bookLocation = userLocationCache[ownerId];
              } else {
                const userSnap = await getDoc(doc(db, 'users', ownerId));
                const userData = userSnap.data() as Record<string, unknown> | undefined;
                const loc = userData?.location;
                if (typeof loc === 'object' && loc !== null) {
                  bookLocation = loc as { lat: number; lng: number };
                  userLocationCache[ownerId] = bookLocation;
                }
              }
            } catch (err) {
              console.error('Error fetching owner location:', err);
            }
          }

          // Calculate real distance if both locations available
          let distance: number | undefined;
          if (userLocation && bookLocation) {
            distance = haversineDistance(userLocation, bookLocation);
          }

          // Skip books that are actively in exchange or completed
          const bookStatus = typeof data.status === 'string' ? data.status : 'available';
          if (['exchanging', 'completed', 'cancelled', 'exchanged'].includes(bookStatus)) return null;

          return {
            id: entry.id,
            title,
            author,
            genre: typeof data.genre === 'string' && data.genre.trim() ? data.genre : 'General',
            condition: typeof data.condition === 'string' && data.condition.trim() ? data.condition : 'good',
            cover: normalizeBookCover(data.cover),
            owner: {
              name: typeof owner?.name === 'string' && owner.name.trim() ? owner.name : ownerName,
              rating: typeof owner?.rating === 'number' ? owner.rating : 0,
              exchanges: typeof owner?.exchanges === 'number' ? owner.exchanges : 0,
              avatar: typeof owner?.avatar === 'string' && owner.avatar.trim() ? owner.avatar : ownerName.slice(0, 2).toUpperCase(),
            },
            ownerId,
            ownerName: typeof data.ownerName === 'string' ? data.ownerName : undefined,
            distance: distance !== undefined ? Math.round(distance * 10) / 10 : undefined,
            isMutualMatch: Boolean(data.isMutualMatch),
            wants: typeof data.wants === 'string' && data.wants.trim() ? data.wants : 'Anything interesting',
            city: typeof data.city === 'string' && data.city.trim() ? data.city : 'Unknown',
            status: 'available',
            isbn: typeof data.isbn === 'string' ? data.isbn : undefined,
            googleId: typeof data.googleId === 'string' ? data.googleId : undefined,
            location: bookLocation,
          } as DiscoverBook;
        })))
        .filter((book): book is NonNullable<typeof book> => book !== null);

      // Default sort by distance
      normalizedBooks.sort((a, b) => {
        const da = a.distance ?? 999999;
        const db2 = b.distance ?? 999999;
        return da - db2;
      });

      setBooks(normalizedBooks);
      setLoading(false);

      // Background Metadata Enrichment Pass - Limited to first 5 vague books to save time/resources
      normalizedBooks
        .filter((b, i) => {
          const g = (b.genre || '').toLowerCase();
          return i < 5 && (!g || ['general', 'fiction', 'unknown', 'classic'].includes(g));
        })
        .forEach(async (book, index) => {
          try {
            // Slight stagger to avoid burst limits
            await new Promise(resolve => setTimeout(resolve, index * 1000));
            
            const queryStr = encodeURIComponent(`${book.title} ${book.author}`);
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${queryStr}&maxResults=1`);
            const data = await res.json();
            const item = data.items?.[0];
            const vol = item?.volumeInfo;
            if (!vol) return;

            let betterGenre = vol.categories?.[0];
            // ... rest of logic remains but let's just use a simplified version for now to avoid bloat
            if (betterGenre) {
              betterGenre = betterGenre.replace(/^(Fiction|Juvenile Fiction)\s\/\s/i, '').split(' / ')[0];
              if (betterGenre && betterGenre.toLowerCase() !== (book.genre?.toLowerCase() || '')) {
                setBooks(prev => prev.map(b => b.id === book.id ? { ...b, genre: betterGenre } : b));
              }
            }
          } catch (e) {}
        });
    }, (err) => {
      console.error('Error fetching books:', err);
      setError('Failed to load books. Please try again later.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userLocation]);



  const filteredBooks = books.filter((book) => {
    if (
      searchQuery &&
      !book.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !book.author.toLowerCase().includes(searchQuery.toLowerCase())
    ) return false;
    if (selectedGenre) {
      const bookGenre = (book.genre || '').toLowerCase();
      const targetGenre = selectedGenre.toLowerCase();
      if (!bookGenre.includes(targetGenre)) return false;
    }
    if (selectedCondition.length && !selectedCondition.includes(book.condition)) return false;
    if (mutualMatchOnly && !book.isMutualMatch) return false;

    // Distance filter using real distance
    if (selectedDistance !== 'any' && book.distance !== undefined) {
      const maxDist = parseInt(selectedDistance);
      if (book.distance > maxDist) return false;
    }

    // Remove cover requirement — show all community books regardless of cover
    return true;
  });

  const toggleCondition = (condition: string) => {
    setSelectedCondition((current) =>
      current.includes(condition) ? current.filter((item) => item !== condition) : [...current, condition]
    );
  };

  // Prepare map data
  const mapBooks = filteredBooks
    .filter(b => b.location)
    .map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      lat: b.location!.lat,
      lng: b.location!.lng,
      distance: b.distance ?? 0,
      isNearby: (b.distance ?? 999) <= 10,
      condition: b.condition,
      owner: { name: b.owner.name, rating: b.owner.rating },
      cover: b.cover,
      genre: b.genre,
      wants: b.wants,
    }));

  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [selectedBookForExchange, setSelectedBookForExchange] = useState<DiscoverBook | null>(null);
  const [myBooks, setMyBooks] = useState<any[]>([]);
  const [selectedMyBookId, setSelectedMyBookId] = useState<string>('');
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBookForDetails, setSelectedBookForDetails] = useState<DiscoverBook | null>(null);
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);

  const { sendExchangeRequest } = useExchangeActions({ currentUser: auth.currentUser });

  const handleOpenExchangeModal = async (book: DiscoverBook) => {
    setSelectedBookForExchange(book);
    setExchangeModalOpen(true);
    setRequestStatus('idle');
    
    try {
      const q = query(collection(db, 'books'), where('ownerId', '==', auth.currentUser?.uid));
      const snap = await getDocs(q);
      const booksData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyBooks(booksData);
      if (booksData.length > 0) setSelectedMyBookId(booksData[0].id);
    } catch (err) {
      console.error('Error fetching my books:', err);
    }
  };

  const handleOpenDetailsModal = async (book: DiscoverBook) => {
    setSelectedBookForDetails(book);
    setDetailsModalOpen(true);
    
    if (!book.description) {
      setIsFetchingDescription(true);
      try {
        const queryStr = encodeURIComponent(`${book.title} ${book.author}`);
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${queryStr}&maxResults=1&printType=books`);
        const data = await res.json();
        const description = data.items?.[0]?.volumeInfo?.description;
        if (description) {
          setSelectedBookForDetails(prev => prev && prev.id === book.id ? { ...prev, description } : prev);
          // Also update the main books list
          setBooks(prev => prev.map(b => b.id === book.id ? { ...b, description } : b));
        }
      } catch (err) {
        console.error('Error fetching description:', err);
      } finally {
        setIsFetchingDescription(false);
      }
    }
  };

  const handleSubmitExchange = async () => {
    if (!selectedBookForExchange || !selectedMyBookId) return;

    setRequestStatus('sending');
    const offeredBook = myBooks.find(b => b.id === selectedMyBookId);
    
    const bookForHook = {
      id: selectedBookForExchange.id,
      title: selectedBookForExchange.title,
      author: selectedBookForExchange.author,
      ownerId: selectedBookForExchange.ownerId || '',
      ownerName: selectedBookForExchange.ownerName || 'Unknown',
    };

    const result = await sendExchangeRequest(bookForHook, offeredBook.id, offeredBook.title);
    
    if (result === 'success' || result === 'already_sent') {
      setRequestStatus('success');
      setTimeout(() => {
        setExchangeModalOpen(false);
        onNavigate('exchanges');
      }, 1500);
    } else {
      setRequestStatus('error');
      setTimeout(() => setRequestStatus('idle'), 2000);
    }
  };


  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-[var(--c-bg)] relative">
      {/* Filters sidebar overlay */}
      <div className={`
        fixed inset-0 z-[2000] transition-all duration-300
        ${filtersOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `}>
        <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} />
        <div className={`
          absolute inset-y-0 left-0 w-72 nm-flat h-full p-6 translate-x-0 transition-transform duration-300 ease-out
          ${filtersOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex justify-between items-center mb-8 nm-inset p-3 rounded-2xl">
            <span className="font-bold text-xs text-[var(--c-emerald)] uppercase tracking-widest">Filters</span>
            <button onClick={() => setFiltersOpen(false)} className="nm-flat p-2 hover:nm-inset transition-all rounded-full">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest opacity-70 ml-2">Genre</div>
              <div className="nm-inset rounded-2xl overflow-visible">
                <CustomDropdown
                  options={[{ label: 'All Genres', value: '' }, ...GENRES.map(g => ({ label: g.name, value: g.name }))]}
                  value={selectedGenre}
                  onChange={setSelectedGenre}
                  placeholder="All Genres"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest opacity-70 ml-2">Condition</div>
              <div className="space-y-3 px-2">
                {['like_new', 'good', 'fair', 'worn'].map((condition) => (
                  <label key={condition} className="flex items-center gap-4 cursor-pointer group">
                    <div className={`w-6 h-6 rounded-lg transition-all flex items-center justify-center ${selectedCondition.includes(condition) ? 'nm-inset bg-[var(--c-emerald)]' : 'nm-flat hover:nm-inset'}`}>
                      {selectedCondition.includes(condition) && <div className="w-2 h-2 bg-white rounded-full shadow-lg" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedCondition.includes(condition)}
                      onChange={() => toggleCondition(condition)}
                      className="hidden"
                    />
                    <span className="text-[11px] font-bold text-[var(--c-ink)] uppercase opacity-70 group-hover:opacity-100 transition-opacity">{condition.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest opacity-70 ml-2">Distance</div>
              <div className="space-y-3 px-2">
                {[['1', '1km'], ['5', '5km'], ['10', '10km'], ['any', 'Any']].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-4 cursor-pointer group">
                    <div className={`w-6 h-6 rounded-full transition-all flex items-center justify-center ${selectedDistance === value ? 'nm-inset bg-[var(--c-emerald)]' : 'nm-flat hover:nm-inset'}`}>
                      {selectedDistance === value && <div className="w-2 h-2 bg-white rounded-full shadow-lg" />}
                    </div>
                    <input type="radio" name="distance" checked={selectedDistance === value} onChange={() => setSelectedDistance(value)} className="hidden" />
                    <span className="text-[11px] font-bold text-[var(--c-ink)] uppercase opacity-70 group-hover:opacity-100 transition-opacity">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-4 px-2">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[11px] font-bold text-[var(--c-ink)] uppercase opacity-70 group-hover:opacity-100">Mutual Match</span>
                <div className={`w-12 h-6 rounded-full transition-all p-1 ${mutualMatchOnly ? 'nm-inset bg-[var(--c-emerald)]' : 'nm-flat'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-all transform ${mutualMatchOnly ? 'translate-x-6' : 'translate-x-0'}`} />
                </div>
                <input type="checkbox" checked={mutualMatchOnly} onChange={() => setMutualMatchOnly(!mutualMatchOnly)} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 p-2 sm:p-4">
        {/* Search bar & View Toggles */}
        <div className="nm-flat p-4 mb-2 sm:mb-6">
          <div className="flex flex-col lg:flex-row items-center gap-4 sm:gap-6 mb-2 sm:mb-4">
            <div className="flex-1 relative w-full flex items-center gap-3">
              <div className="nm-inset flex items-center px-4 sm:px-6 py-3 sm:py-4 flex-1 rounded-xl sm:rounded-2xl group transition-all focus-within:ring-2 focus-within:ring-[var(--c-emerald)]/20 border border-[var(--c-emerald)]/30">
                <Search size={20} className="text-[var(--c-emerald)] mr-3 sm:mr-4 opacity-70 group-focus-within:opacity-100 transition-opacity" />
                <input
                  type="text"
                  placeholder="Search community books..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none focus:outline-none w-full text-xs sm:text-sm font-bold text-[var(--c-ink)] placeholder:text-[var(--c-ink)] placeholder:opacity-70"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="p-1 hover:text-red-500 transition-colors">
                    <X size={16} />
                  </button>
                )}
              </div>
              

            </div>

            <div className="flex items-center gap-3 w-full lg:w-auto">
              {/* View Toggle - Hidden on mobile */}
              <div className="hidden sm:flex p-1 nm-inset rounded-xl sm:rounded-2xl flex-1 lg:flex-none">
                {[
                  { icon: <Grid size={16} />, val: 'grid' }, 
                  { icon: <List size={16} />, val: 'list' },
                  { icon: <Map size={16} />, val: 'map' }
                ].map(({ icon, val }) => (
                  <button
                    key={val}
                    onClick={() => setView(val as 'grid' | 'list' | 'map')}
                    className={`flex-1 lg:flex-none px-4 sm:px-6 py-2 sm:py-2.5 transition-all rounded-lg sm:rounded-xl ${view === val ? 'nm-flat text-[var(--c-emerald)]' : 'text-[var(--c-ink)] opacity-70 hover:opacity-100'}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              {/* Filter Button - Hidden on mobile */}
              <button 
                onClick={() => setFiltersOpen(true)}
                className="hidden sm:flex nm-flat p-3 rounded-xl text-[var(--c-emerald)] hover:nm-inset transition-all"
              >
                <SlidersHorizontal size={18} />
              </button>
            </div>
          </div>

          {/* Open Map Button for Mobile Only */}
          <div className="flex sm:hidden pt-2 pb-1 w-full">
            <button
              onClick={() => setView('map')}
              className="w-full nm-flat text-[var(--c-emerald)] py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg !border-2 !border-[var(--c-emerald)] animate-bob"
            >
              <Map size={16} className="text-[var(--c-emerald)]" /> Open Map
            </button>
          </div>

          {/* Quick Filter Buttons - Hidden on mobile */}
          <div className="hidden sm:flex overflow-x-auto no-scrollbar gap-2 sm:gap-3 pt-2 pb-1 -mx-1 px-1">
            <button 
              onClick={() => setFiltersOpen(true)}
              className={`whitespace-nowrap px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${selectedGenre ? 'nm-inset text-[var(--c-emerald)]' : 'nm-flat hover:nm-inset opacity-70'}`}
            >
              <SlidersHorizontal size={12} className="hidden sm:block" /> Genre: {selectedGenre || 'All'}
            </button>
            <button 
              onClick={() => setFiltersOpen(true)}
              className={`whitespace-nowrap px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all ${selectedCondition.length ? 'nm-inset text-[var(--c-emerald)]' : 'nm-flat hover:nm-inset opacity-70'}`}
            >
              Cond: {selectedCondition.length === 0 ? 'Any' : selectedCondition.length === 1 ? selectedCondition[0].replace('_', ' ') : `${selectedCondition.length} Sel`}
            </button>
            <button 
              onClick={() => setFiltersOpen(true)}
              className={`whitespace-nowrap px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all ${selectedDistance !== 'any' ? 'nm-inset text-[var(--c-emerald)]' : 'nm-flat hover:nm-inset opacity-70'}`}
            >
              Dist: {selectedDistance === 'any' ? 'Any' : `${selectedDistance}km`}
            </button>
            <button 
              onClick={() => setMutualMatchOnly(!mutualMatchOnly)}
              className={`whitespace-nowrap px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all ${mutualMatchOnly ? 'nm-inset text-[var(--c-emerald)]' : 'nm-flat hover:nm-inset opacity-70'}`}
            >
              Match: {mutualMatchOnly ? 'ON' : 'OFF'}
            </button>
            {(selectedGenre || selectedCondition.length > 0 || selectedDistance !== 'any' || mutualMatchOnly) && (
              <button 
                onClick={() => {
                  setSelectedGenre('');
                  setSelectedCondition([]);
                  setSelectedDistance('any');
                  setMutualMatchOnly(false);
                }}
                className="whitespace-nowrap px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-red-500 hover:nm-inset transition-all nm-flat ml-auto"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto pr-2 nm-inset p-6 rounded-3xl">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="nm-flat p-8 rounded-full mb-6">
                <Loader2 className="w-10 h-10 text-[var(--c-emerald)] animate-spin" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Connecting to Library...</p>
            </div>
          ) : error ? (
            <div className="nm-flat p-12 text-center max-w-md mx-auto mt-20">
              <div className="nm-inset w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <X size={32} className="text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-[var(--c-ink)] uppercase mb-2">Something went wrong</h3>
              <p className="text-xs font-medium opacity-80">{error}</p>
            </div>
          ) : (
            <>
              {/* Grid view */}
              {view === 'grid' && (
                <div className="space-y-12">
                  {/* Community Results */}
                  {filteredBooks.length > 0 && (
                    <div className="space-y-8">
                       <div className="flex items-center gap-4">
                          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--c-emerald)]">COMMUNITY INVENTORY</h2>
                          <div className="h-px flex-1 bg-[var(--c-emerald)] opacity-10"></div>
                       </div>
                       <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-8">
                        {filteredBooks.map((book) => (
                          <BookCard key={book.id} book={book} onRequestExchange={() => onNavigate('exchanges')} onViewDetails={() => handleOpenDetailsModal(book)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* List view */}
              {view === 'list' && (
                <div className="space-y-6">
                  {filteredBooks.map((book) => (
                    <div key={book.id} className="nm-flat p-4 flex flex-row gap-4 sm:gap-6 hover:scale-[1.01] transition-transform">
                      <div className="w-[150px] sm:w-32 h-[180px] sm:h-44 nm-inset rounded-2xl flex items-center justify-center overflow-hidden p-2 flex-shrink-0">
                        {book.cover ? (
                          <img src={book.cover} alt={book.title} className="w-full h-full object-contain rounded-xl shadow-md" />
                        ) : (
                          <BookOpen className="text-[var(--c-emerald)] opacity-30 w-10 h-10" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                        <div>
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <h3 className="font-bold text-[var(--c-emerald)] text-xl uppercase tracking-tight line-clamp-1">{book.title}</h3>
                            {book.isMutualMatch && (
                              <div className="nm-flat px-3 py-1.5 rounded-full text-[9px] font-bold uppercase text-[var(--c-emerald)] flex items-center gap-2 flex-shrink-0">
                                <Target size={12} /> MATCH
                              </div>
                            )}
                          </div>
                          <div className="text-xs font-bold text-[var(--c-ink)] uppercase tracking-widest">{book.author}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-6 mt-4">
                          <div className="flex items-center gap-2 text-xs font-bold">
                            <Star size={14} className="text-yellow-500 fill-yellow-500" />
                            <span className="text-[var(--c-ink)]">{book.owner.rating}</span>
                            <span className="opacity-30">({book.owner.exchanges})</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 justify-center flex-shrink-0">
                        <button onClick={() => handleOpenDetailsModal(book)} className="flex-1 nm-flat px-6 py-3 rounded-xl text-[10px] font-bold uppercase hover:scale-105 active:scale-95 transition-all">
                          Details
                        </button>
                        <button onClick={() => handleOpenExchangeModal(book)} className="flex-1 nm-flat text-[var(--c-emerald)] px-6 py-3 rounded-xl text-[10px] font-bold uppercase hover:scale-105 active:scale-95 transition-all">
                          Swap
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Map view */}
              {view === 'map' && (
                <div className="fixed sm:relative inset-0 sm:inset-auto z-[3000] sm:z-0 bg-[var(--c-bg)] sm:bg-transparent animate-fade-in sm:h-[calc(100vh-20rem)] sm:min-h-[500px] sm:w-full sm:rounded-[2.5rem] sm:overflow-hidden sm:nm-inset">
                  <button 
                    onClick={() => setView('grid')}
                    className="absolute top-4 sm:top-8 right-4 sm:right-8 z-[3001] nm-flat bg-white p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-[var(--c-emerald)] hover:nm-inset transition-all shadow-2xl flex items-center gap-2 sm:gap-3 group"
                    title="Close Map"
                  >
                    <X size={16} sm:size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Close Map</span>
                  </button>
                  
                  <div className="w-full h-full p-2 sm:p-0">
                    <div className="w-full h-full rounded-[2rem] sm:rounded-none overflow-hidden nm-inset sm:nm-none relative">
                      <NearbyMapView 
                        books={mapBooks}
                        userLocation={userLocation}
                        nearbyRadius={5}
                        onRequestExchange={(bookId) => {
                          const book = filteredBooks.find(b => b.id === bookId);
                          if (book) handleOpenExchangeModal(book);
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {filteredBooks.length === 0 && (
                <div className="nm-flat p-20 text-center max-w-lg mx-auto mt-12 flex flex-col items-center">
                  <div className="nm-inset w-24 h-24 rounded-full flex items-center justify-center mb-8">
                    <Inbox size={40} className="text-[var(--c-emerald)] opacity-30" />
                  </div>
                  <h3 className="text-2xl font-bold text-[var(--c-emerald)] uppercase tracking-tight mb-3">No matches found</h3>
                  <p className="text-xs font-medium text-[var(--c-ink)] opacity-80 uppercase tracking-widest">Adjust your filters or try a different search</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Exchange Modal */}
      {exchangeModalOpen && selectedBookForExchange && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-[4000] flex items-center justify-center p-4">
          <div className="nm-flat w-full max-w-md animate-fade-up relative z-[4001] p-2 overflow-visible">
            <div className="px-6 py-5 nm-inset mb-4 flex items-center justify-between rounded-2xl">
              <h3 className="font-bold text-[var(--c-emerald)] uppercase text-lg tracking-tight">Offer Exchange</h3>
              <button onClick={() => setExchangeModalOpen(false)} className="nm-flat p-2 hover:nm-inset transition-all rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <div className="nm-inset p-4 rounded-2xl flex items-center gap-5">
                <div className="w-16 h-20 nm-flat rounded-xl overflow-hidden flex-shrink-0">
                  <img src={selectedBookForExchange.cover} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-sm font-bold uppercase tracking-tight text-[var(--c-emerald)]">{selectedBookForExchange.title}</div>
                  <div className="text-[10px] font-bold uppercase opacity-70 mt-1">BY {selectedBookForExchange.author}</div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--c-ink)] uppercase opacity-70 mb-4 ml-2">What will you offer in return?</label>
                {myBooks.length > 0 ? (
                  <div className="nm-inset rounded-2xl overflow-visible">
                    <CustomDropdown
                      options={myBooks.map(b => ({ label: b.title, value: b.id }))}
                      value={selectedMyBookId}
                      onChange={setSelectedMyBookId}
                      placeholder="Select a book to offer"
                    />
                  </div>
                ) : (
                  <div className="nm-inset p-5 text-red-500 font-bold text-[10px] uppercase rounded-2xl border-l-4 border-red-500">
                    You have no books to offer! Please add some first.
                  </div>
                )}
              </div>

              {requestStatus === 'success' && (
                <div className="nm-inset bg-emerald-50 text-emerald-600 p-4 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase">
                  <CheckCircle2 size={20} /> Request Sent Successfully!
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setExchangeModalOpen(false)} className="flex-1 nm-flat text-[var(--c-ink)] py-4 text-[10px] font-bold uppercase rounded-2xl hover:nm-inset transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleSubmitExchange}
                  disabled={!selectedMyBookId || requestStatus === 'sending' || requestStatus === 'success'}
                  className="flex-1 nm-flat text-[var(--c-emerald)] py-4 text-[10px] font-bold uppercase rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {requestStatus === 'sending' ? <Loader2 size={16} className="animate-spin" /> : 'Send Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Book Details Modal */}
      {detailsModalOpen && selectedBookForDetails && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-[4000] flex items-center justify-center p-4">
          <div className="nm-flat w-full max-w-2xl animate-fade-up relative z-[4001] p-2 max-h-[90vh] flex flex-col overflow-visible">
            <div className="px-8 py-6 nm-inset mb-4 flex items-center justify-between rounded-3xl">
              <h3 className="font-bold text-[var(--c-emerald)] uppercase text-lg tracking-tight">Book Details</h3>
              <button onClick={() => setDetailsModalOpen(false)} className="nm-flat p-2 hover:nm-inset transition-all rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="w-full md:w-48 h-72 nm-inset rounded-[2rem] overflow-hidden p-3 flex-shrink-0">
                  <img src={selectedBookForDetails.cover} alt={selectedBookForDetails.title} className="w-full h-full object-contain rounded-2xl shadow-xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl font-black text-[var(--c-emerald)] uppercase tracking-tight mb-2 leading-none">{selectedBookForDetails.title}</h2>
                  <p className="text-sm font-bold text-[var(--c-ink)] uppercase tracking-widest mb-6 opacity-60">BY {selectedBookForDetails.author}</p>
                  
                  <div className="flex flex-wrap gap-4 mb-8">
                    <div className="nm-inset px-5 py-3 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--c-emerald)]">
                      <MapPin size={16} /> {selectedBookForDetails.distance?.toFixed(1) || '0.0'} KM AWAY
                    </div>
                    <div className="nm-inset px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--c-ink)]">
                      WANTS: <span className="text-[var(--c-emerald)]">{selectedBookForDetails.wants}</span>
                    </div>
                  </div>

                  <div className="nm-inset p-6 rounded-[2rem]">
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--c-ink)] opacity-30 mb-4 ml-2">BOOK SUMMARY</div>
                    {isFetchingDescription ? (
                      <div className="flex items-center gap-3 py-4">
                        <Loader2 size={16} className="animate-spin text-[var(--c-emerald)]" />
                        <span className="text-[10px] font-bold uppercase opacity-50">Fetching from Google Books...</span>
                      </div>
                    ) : selectedBookForDetails.description ? (
                      <p className="text-xs font-medium leading-relaxed opacity-80 line-clamp-[8]">
                        {selectedBookForDetails.description}
                      </p>
                    ) : (
                      <p className="text-[10px] font-bold uppercase opacity-30 py-4 italic">No summary available for this volume.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-6 pt-4">
                <button 
                  onClick={() => { setDetailsModalOpen(false); handleOpenExchangeModal(selectedBookForDetails); }}
                  className="flex-1 nm-flat text-[var(--c-emerald)] py-6 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <ArrowLeftRight size={20} /> INITIATE SWAP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Map Toggle */}
      {view !== 'map' && (
        <button
          onClick={() => setView('map')}
          className="hidden sm:flex fixed bottom-10 right-10 z-[50] nm-flat text-[var(--c-emerald)] px-8 py-5 rounded-full hover:nm-inset hover:scale-105 active:scale-95 transition-all items-center gap-3 shadow-2xl !border-2 !border-[var(--c-emerald)] animate-bob"
        >
          <Map size={24} className="text-[var(--c-emerald)]" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Open Map</span>
        </button>
      )}
    </div>
  );
}
