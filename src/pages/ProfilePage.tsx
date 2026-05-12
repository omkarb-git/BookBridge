import { useEffect, useState, useContext } from 'react';
import { Bell, Book, BookOpen, Eye, Heart, Image as ImageIcon, LogOut, MapPin, MessageCircle, Plus, Repeat, Search, Smartphone, Star, Target, Trash2, TrendingUp, Trophy, X, Info, Loader2 } from 'lucide-react';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import BookCover from '../components/BookCover';
import { normalizeBookCover } from '../lib/bookCovers';
import { LocationContext } from '../App';
import { downloadEpubFromFirestoreChunks } from '../lib/epubFiles';
import { searchAll, getSearchTerms, BookResult } from '../services/bookService';

interface ProfilePageProps {
  onNavigate: (page: string) => void;
  onRead?: (url: string | ArrayBuffer, title: string) => void;
  openAddForm?: boolean;
  onCloseAddForm?: () => void;
}

interface BookSuggestion extends BookResult {}



type ProfileTab = 'overview' | 'library';
type LibraryTab = 'physical' | 'digital' | 'wishlist';
type StatusFilter = 'all' | 'available' | 'in_exchange' | 'exchanged';

const EXCHANGE_STATUS_STYLES: Record<string, { label: string }> = {
  pending: { label: 'Pending' },
  accepted: { label: 'Accepted' },
  meeting_scheduled: { label: 'Meeting Set' },
  in_transit: { label: 'In Progress' },
  completed: { label: 'Completed' },
};

const CONDITION_STYLES: Record<string, { label: string }> = {
  like_new: { label: 'Like New' },
  good: { label: 'Good' },
  fair: { label: 'Fair' },
  worn: { label: 'Worn' },
};



export default function ProfilePage({ onNavigate, onRead, openAddForm, onCloseAddForm }: ProfilePageProps) {
  const [user, setUser] = useState<any>(null);
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('physical');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    genre: '',
    condition: 'good',
    wants: '',
    scope: 'local',
    cover: '',
    city: '',
    isbn: '',
    googleId: ''
  });
  const [bookSearch, setBookSearch] = useState('');
  const [bookSuggestions, setBookSuggestions] = useState<BookSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<BookSuggestion | null>(null);
  const [relatedAuthorBooks, setRelatedAuthorBooks] = useState<BookSuggestion[]>([]);
  const [isFetchingRelated, setIsFetchingRelated] = useState(false);
  const [isSearchingBooks, setIsSearchingBooks] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [myBooks, setMyBooks] = useState<any[]>([]);
  const [myEpubs, setMyEpubs] = useState<any[]>([]);
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [downloadingEpubId, setDownloadingEpubId] = useState<string | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [showPointsBreakdown, setShowPointsBreakdown] = useState(false);
  const [showRecentActivity, setShowRecentActivity] = useState(false);
  const [showRankMatrix, setShowRankMatrix] = useState(false);
  const { location: userLocation } = useContext(LocationContext);

  useEffect(() => {
    if (openAddForm) {
      setProfileTab('library');
      setShowAddForm(true);
      setAddStep(1);
      onCloseAddForm?.();
    }
  }, [openAddForm, onCloseAddForm]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchUserData(currentUser.uid);
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (showAddForm) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddForm]);

  const formatTimestamp = (value: any) => {
    if (!value) return '';
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = yesterday.toDateString() === date.toDateString();
    
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return `Today, ${timeStr}`;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + `, ${timeStr}`;
  };

  const fetchUserData = async (uid: string) => {
    setLoading(true);
    try {
      // 1. Get current Profile Doc to check for sync
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      const profileData = userSnap.data() || {};

      // 2. Fetch all activity to calculate true Karma
      const booksSnap = await getDocs(query(collection(db, 'books'), where('ownerId', '==', uid)));
      const epubsSnap = await getDocs(query(collection(db, 'epubs'), where('uploadedBy', '==', uid)));
      const exchangesSnap = await getDocs(query(collection(db, 'exchanges'), where('participants', 'array-contains', uid)));
      const notificationsSnap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', uid)));

      const books = booksSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      const epubs = epubsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      const allExchanges = exchangesSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      const completedExchanges = allExchanges.filter((ex: any) => ex.status === 'completed');

      // 3. True Karma Calculation
      const physicalPoints = books.length * 10;
      const epubPoints = epubs.length * 50;
      const exchangePoints = completedExchanges.length * 100;
      const totalPoints = physicalPoints + epubPoints + exchangePoints;

      // 4. Karma Sync - If profile is missing stats or they are wrong, update it silently
      if (
        profileData.points !== totalPoints || 
        profileData.booksAdded !== books.length || 
        profileData.exchangesCompleted !== completedExchanges.length
      ) {
        console.log(`Syncing Karma for ${uid}:`, { totalPoints, books: books.length, exchanges: completedExchanges.length });
        await updateDoc(userRef, {
          points: totalPoints,
          booksAdded: books.length,
          exchangesCompleted: completedExchanges.length,
          epubsUploaded: epubs.length,
          updatedAt: serverTimestamp()
        });
      }

      setMyBooks(books);
      setMyEpubs(epubs);
      setExchanges(allExchanges);
      setNotifications(notificationsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    } catch (err) {
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-detect city from GPS
  useEffect(() => {
    if (showAddForm && userLocation && !newBook.city) {
      void detectLocation();
    }
  }, [showAddForm, userLocation]);

  const detectLocation = async () => {
    if (!userLocation) return;
    setIsDetectingLocation(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.lat}&lon=${userLocation.lng}&zoom=10`);
      const data = await response.json();
      const city = data.address?.city || data.address?.town || data.address?.village || data.address?.suburb || data.address?.neighborhood;
      const state = data.address?.state;
      if (city) {
        setNewBook(prev => ({ ...prev, city: state ? `${city}, ${state}` : city }));
      }
    } catch (err) {
      console.warn("Location detection failed:", err);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  useEffect(() => {
    if (!showAddForm || addStep !== 1 || selectedSuggestion || bookSearch.trim().length < 3) {
      if (bookSearch.trim().length < 3) {
        setBookSuggestions([]);
      }
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setIsSearchingBooks(true);
      try {
        const results = await searchAll(bookSearch, controller.signal);
        setBookSuggestions(results.slice(0, 24));
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error fetching book suggestions:', err);
        }
      } finally {
        setIsSearchingBooks(false);
      }
    }, 500);


    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [addStep, bookSearch, selectedSuggestion, showAddForm]);

  const handleAddBook = async () => {
    if (!user) return;
    if (!selectedSuggestion || !newBook.title.trim() || !newBook.author.trim() || !newBook.genre.trim()) {
      setFormError('Choose a real book from the search suggestions before saving.');
      return;
    }

    try {
      const bookData: Record<string, any> = {
        ...newBook,
        ownerId: user.uid,
        ownerName: user.displayName || user.email,
        status: 'available',
        createdAt: serverTimestamp()
      };
      // Attach user's GPS location so the book appears on the map
      if (userLocation) {
        bookData.location = { lat: userLocation.lat, lng: userLocation.lng };
      }
      const batch = writeBatch(db);
      const bookRef = doc(collection(db, 'books'));
      batch.set(bookRef, bookData);
      
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        booksAdded: increment(1),
        points: increment(10),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      setShowAddForm(false);
      setNewBook({ title: '', author: '', genre: '', condition: 'good', wants: '', scope: 'local', cover: '', city: '', isbn: '', googleId: '' });
      setBookSearch('');
      setBookSuggestions([]);
      setSelectedSuggestion(null);
      setFormError(null);
      setAddStep(1);
      fetchUserData(user.uid);
    } catch (err) {
      console.error('Error adding book:', err);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'books', bookId));
      
      const userRef = doc(db, 'users', user!.uid);
      batch.update(userRef, {
        booksAdded: increment(-1),
        points: increment(-10),
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      if (user?.uid) fetchUserData(user.uid);
    } catch (err) {
      console.error('Error deleting book:', err);
    }
  };

  const handleRelistBook = async (bookId: string) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'books', bookId), {
        status: 'available',
        updatedAt: serverTimestamp()
      });
      await batch.commit();
      if (user?.uid) fetchUserData(user.uid);
    } catch (err) {
      console.error('Error relisting book:', err);
    }
  };

  const handleDownloadEpub = async (epub: any) => {
    if (epub.storageMode === 'firestore') {
      setDownloadingEpubId(epub.id);
      try {
        await downloadEpubFromFirestoreChunks(db, epub.id, epub.fileName || epub.title, epub.mimeType);
      } catch (err) {
        console.error('Error downloading epub:', err);
      } finally {
        setDownloadingEpubId(null);
      }
      return;
    }

    if (epub.fileUrl) {
      window.open(epub.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleReadEpub = async (epub: any) => {
    if (!onRead) return;
    setDownloadingEpubId(epub.id);
    try {
      if (epub.storageMode === 'firestore') {
        const chunksSnap = await getDocs(query(collection(db, 'epubs', epub.id, 'chunks'), orderBy('index', 'asc')));
        if (chunksSnap.empty) throw new Error("No book data found.");
        
        const parts = chunksSnap.docs.map((entry) => {
          const data = entry.data() as { data?: string };
          const binary = atob(data.data || '');
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return bytes;
        });

        const blob = new Blob(parts, { type: epub.mimeType || 'application/epub+zip' });
        const buffer = await blob.arrayBuffer();
        onRead(buffer, epub.title);
      }
    } catch (err) {
      console.error('Error reading epub:', err);
    } finally {
      setDownloadingEpubId(null);
    }
  };

  const handleSelectSuggestion = async (suggestion: BookSuggestion) => {
    setSelectedSuggestion(suggestion);
    setNewBook((current) => ({
      ...current,
      title: suggestion.title,
      author: suggestion.author,
      genre: suggestion.genre,
      cover: suggestion.cover || '',
      isbn: suggestion.isbn || '',
      googleId: suggestion.googleId || ''
    }));
    setBookSuggestions([]);

    // Fetch related books by the same author
    setIsFetchingRelated(true);
    try {
      const authorQuery = encodeURIComponent(`inauthor:${suggestion.author}`);
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${authorQuery}&maxResults=8&printType=books`);
      const data = await res.json();
      
      const related = (data.items ?? [])
        .filter((item: any) => item.volumeInfo.title.toLowerCase() !== suggestion.title.toLowerCase())
        .map((item: any) => {
          const identifiers = item.volumeInfo?.industryIdentifiers ?? [];
          const isbn = identifiers.find((id: any) => id.type === 'ISBN_13')?.identifier || identifiers.find((id: any) => id.type === 'ISBN_10')?.identifier;
          return {
            id: isbn || item.id,
            title: item.volumeInfo.title,
            author: item.volumeInfo.authors?.[0] || suggestion.author,
            genre: item.volumeInfo.categories?.[0] || 'Fiction',
            cover: item.volumeInfo.imageLinks?.thumbnail,
            isbn,
            googleId: item.id
          };
        });
      setRelatedAuthorBooks(related);
    } catch (err) {
      console.error('Error fetching related books:', err);
    } finally {
      setIsFetchingRelated(false);
    }
  };

  const handleResetSelectedBook = () => {
    setSelectedSuggestion(null);
    setRelatedAuthorBooks([]);
    setBookSearch('');
    setBookSuggestions([]);
    setNewBook((current) => ({
      ...current,
      title: '',
      author: '',
      genre: '',
      cover: '',
    }));
  };

  const handleContinueFromStepOne = () => {
    if (!selectedSuggestion) {
      setFormError('Pick a book from the suggestions to continue.');
      return;
    }
    setFormError(null);
    setAddStep(2);
  };

  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Reader';
  const firstName = displayName.split(' ')[0] || displayName;
  const activeExchanges = exchanges.filter((exchange) => exchange.status !== 'completed');
  const completedExchanges = exchanges.filter((exchange) => exchange.status === 'completed');
  const newNotifs = notifications.filter((notification) => !notification.read);
  const filteredBooks = myBooks.filter((book) => statusFilter === 'all' ? true : book.status === statusFilter);

  // Dynamic Points Calculation
  const exchangePoints = completedExchanges.length * 100;
  const epubUploadPoints = myEpubs.length * 50;
  const epubDownloadPoints = myEpubs.reduce((sum, epub) => sum + (epub.downloads || 0) * 5, 0);
  const physicalBookPoints = myBooks.length * 10;
  const totalPoints = exchangePoints + epubUploadPoints + epubDownloadPoints + physicalBookPoints;

  const getRankInfo = (pts: number) => {
    if (pts >= 100000) return { rank: 'Librarian of Babel', next: 250000, color: 'text-orange-600', bg: 'bg-orange-50' };
    if (pts >= 50000) return { rank: 'Grand Master', next: 100000, color: 'text-red-500', bg: 'bg-red-50' };
    if (pts >= 25000) return { rank: 'Master', next: 50000, color: 'text-orange-500', bg: 'bg-orange-50' };
    if (pts >= 10000) return { rank: 'Sage', next: 25000, color: 'text-purple-600', bg: 'bg-purple-50' };
    if (pts >= 4000) return { rank: 'Scholar', next: 10000, color: 'text-emerald-500', bg: 'bg-green-50' };
    if (pts >= 1500) return { rank: 'Bookworm', next: 4000, color: 'text-blue-500', bg: 'bg-blue-50' };
    if (pts >= 500) return { rank: 'Collector', next: 1500, color: 'text-yellow-500', bg: 'bg-yellow-50' };
    return { rank: 'Novice', next: 500, color: 'text-[var(--c-ink)]', bg: 'bg-gray-100' };
  };

  const rankInfo = getRankInfo(totalPoints);
  const rank = rankInfo.rank;
  const progressPercent = Math.min(100, (totalPoints / rankInfo.next) * 100);

  const libraryTabs: { id: LibraryTab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'physical', label: 'Physical Books', icon: Book, count: myBooks.length },
    { id: 'digital', label: 'Digital EPUBs', icon: Smartphone, count: myEpubs.length },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, count: 0 },
  ];

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <div className="nm-flat p-12 text-center rounded-[3rem] animate-pulse">
          <Loader2 className="w-16 h-16 text-[var(--c-emerald)] animate-spin mx-auto mb-6" />
          <div className="text-xl font-black text-[var(--c-ink)] uppercase tracking-[0.3em]">Loading Profile...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 space-y-8">
      <div className="nm-flat p-4 md:p-12 relative overflow-hidden rounded-[2rem]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--c-mint)] opacity-10 blur-3xl rounded-full -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[var(--c-teal)] opacity-10 blur-3xl rounded-full -ml-20 -mb-20"></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8 relative z-10">
          <div className="space-y-2 md:space-y-4">
            <h1 className="text-2xl md:text-6xl font-extrabold tracking-tight text-[var(--c-emerald)] uppercase leading-none">
              Hello, {firstName}!
            </h1>
            <p className="text-xs md:text-lg font-medium text-[var(--c-ink)] flex flex-wrap items-center gap-2">
              You have <span className="px-2 py-0.5 nm-inset rounded-full text-[var(--c-emerald)] font-bold">{activeExchanges.length} ACTIVE SWAPS</span> and <span className="px-2 py-0.5 nm-inset rounded-full text-[var(--c-emerald)] font-bold">{newNotifs.length} NOTIFICATIONS</span>
            </p>
          </div>
          <button
            onClick={() => { setProfileTab('library'); setShowAddForm(true); setAddStep(1); }}
            className="nm-flat text-[var(--c-emerald)] px-4 py-3 md:px-8 md:py-5 rounded-2xl flex items-center gap-3 text-sm font-bold uppercase hover:scale-105 active:scale-95 transition-all shadow-xl self-start"
          >
            <Plus size={22} /> Add New Book
          </button>
        </div>
      </div>

      <div className="flex p-2 nm-inset rounded-[2rem]">
        <button
          onClick={() => setProfileTab('overview')}
          className={`flex-1 py-5 text-center font-bold uppercase text-xs tracking-widest transition-all rounded-2xl ${profileTab === 'overview' ? 'nm-flat text-[var(--c-emerald)]' : 'text-[var(--c-ink)] opacity-70 hover:opacity-100'}`}
        >
          Overview & Stats
        </button>
        <button
          onClick={() => setProfileTab('library')}
          className={`flex-1 py-5 text-center font-bold uppercase text-xs tracking-widest transition-all rounded-2xl ${profileTab === 'library' ? 'nm-flat text-[var(--c-emerald)]' : 'text-[var(--c-ink)] opacity-70 hover:opacity-100'}`}
        >
          My Library
        </button>
      </div>

      {profileTab === 'overview' && (
        <div className="space-y-8 animate-fade-up">
          {/* Progression (Mobile Only) */}
          <div className="nm-flat p-8 rounded-3xl md:hidden">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-6 flex items-center gap-3">
              <TrendingUp size={18} className="text-[var(--c-emerald)]" /> Progression
            </div>
            <div className="text-5xl font-extrabold text-[var(--c-emerald)] mb-2 tracking-tight">
              {totalPoints.toLocaleString()} <span className="text-lg font-bold text-[var(--c-ink)] opacity-30">PTS</span>
            </div>
            <div className="text-xs font-bold text-[var(--c-ink)] opacity-80 mb-6 flex items-center justify-between">
              <span>RANK: {rank.toUpperCase()}</span>
              <div className="group relative">
                <Info size={16} className="text-[var(--c-emerald)] cursor-help opacity-70" />
                <div className="absolute right-0 top-8 w-64 nm-flat p-6 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none rounded-2xl">
                  <div className="text-[9px] font-bold uppercase tracking-widest space-y-3">
                    <div className="flex justify-between pb-1 border-b border-white border-opacity-10"><span>Novice</span> <span>0+</span></div>
                    <div className="flex justify-between text-yellow-500 pb-1 border-b border-white border-opacity-10"><span>Collector</span> <span>500+</span></div>
                    <div className="flex justify-between text-blue-500 pb-1 border-b border-white border-opacity-10"><span>Bookworm</span> <span>1.5K+</span></div>
                    <div className="flex justify-between text-emerald-500 pb-1 border-b border-white border-opacity-10"><span>Scholar</span> <span>4K+</span></div>
                    <div className="flex justify-between text-purple-500 pb-1 border-b border-white border-opacity-10"><span>Sage</span> <span>10K+</span></div>
                    <div className="flex justify-between text-orange-500 pb-1 border-b border-white border-opacity-10"><span>Master</span> <span>25K+</span></div>
                    <div className="flex justify-between text-red-500 pb-1 border-b border-white border-opacity-10"><span>Grand Master</span> <span>50K+</span></div>
                    <div className="flex justify-between text-orange-600"><span>Librarian</span> <span>100K+</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-4 w-full nm-inset rounded-full p-1 mb-4 overflow-hidden">
              <div className="h-full bg-[var(--c-emerald)] rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 text-center uppercase tracking-widest">
              {Math.round(100 - progressPercent)}% MORE TO NEXT RANK
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'My Books', value: myBooks.length.toString(), icon: Book, action: () => setProfileTab('library'), accent: 'text-blue-500' },
              { label: 'Exchanges', value: completedExchanges.length.toString(), icon: Repeat, action: () => onNavigate('exchanges'), accent: 'text-emerald-500' },
              { label: 'Karma Points', value: totalPoints.toLocaleString(), icon: Star, action: () => onNavigate('leaderboard'), accent: 'text-yellow-500' },
              { label: 'Current Rank', value: rank, icon: Trophy, action: () => onNavigate('leaderboard'), accent: 'text-orange-500' },
            ].map((stat) => (
              <button key={stat.label} onClick={stat.action} className="nm-flat p-6 text-left hover:scale-[1.02] transition-all flex flex-col items-start group rounded-3xl">
                <div className={`w-12 h-12 nm-inset flex items-center justify-center mb-6 rounded-2xl ${stat.accent}`}>
                  <stat.icon size={24} className="group-hover:scale-110 transition-transform" />
                </div>
                <div className="text-3xl font-extrabold text-[var(--c-ink)] mb-1 uppercase tracking-tight">{stat.value}</div>
                <div className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 uppercase tracking-widest">{stat.label}</div>
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <div className="nm-flat overflow-hidden rounded-3xl">
                <button 
                  onClick={() => setShowPointsBreakdown(!showPointsBreakdown)}
                  className="w-full px-8 py-6 flex items-center justify-between group hover:nm-inset transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 nm-inset flex items-center justify-center rounded-xl text-yellow-500">
                      <Star size={20} />
                    </div>
                    <span className="font-bold text-sm uppercase tracking-widest">Points Breakdown</span>
                  </div>
                  <Plus size={20} className={`transform transition-transform opacity-30 ${showPointsBreakdown ? 'rotate-45' : ''}`} />
                </button>
                {showPointsBreakdown && (
                  <div className="px-8 pb-8 space-y-6 animate-fade-down">
                    {[
                      { label: 'Completed Exchanges', points: exchangePoints, detail: `${completedExchanges.length} × 100 PTS` },
                      { label: 'Digital Book Uploads', points: epubUploadPoints, detail: `${myEpubs.length} × 50 PTS` },
                      { label: 'Community Downloads', points: epubDownloadPoints, detail: `${epubDownloadPoints / 5} × 5 PTS` },
                      { label: 'Physical Library', points: physicalBookPoints, detail: `${myBooks.length} × 10 PTS` },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between items-center py-4 border-b border-[var(--c-ink)] border-opacity-5 last:border-0">
                        <div>
                          <div className="font-bold text-[var(--c-ink)] text-xs uppercase tracking-tight">{item.label}</div>
                          <div className="text-[9px] font-bold text-[var(--c-ink)] opacity-30 uppercase tracking-widest mt-1">{item.detail}</div>
                        </div>
                        <div className="nm-inset text-[var(--c-emerald)] px-4 py-2 rounded-xl font-bold text-xs">
                          +{item.points}
                        </div>
                      </div>
                    ))}
                    <div className="pt-6 mt-2 border-t border-[var(--c-ink)] border-opacity-10 flex justify-between items-center">
                      <span className="font-bold text-[var(--c-ink)] text-sm uppercase tracking-widest opacity-80">Total Karma Points</span>
                      <span className="text-3xl font-extrabold text-[var(--c-emerald)] tracking-tight">{totalPoints.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="nm-flat overflow-hidden rounded-3xl">
                <button 
                  onClick={() => setShowRankMatrix(!showRankMatrix)}
                  className="w-full px-8 py-6 flex items-center justify-between group hover:nm-inset transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 nm-inset flex items-center justify-center rounded-xl text-orange-500">
                      <Trophy size={20} />
                    </div>
                    <span className="font-bold text-sm uppercase tracking-widest">Rank Matrix</span>
                  </div>
                  <Plus size={20} className={`transform transition-transform opacity-30 ${showRankMatrix ? 'rotate-45' : ''}`} />
                </button>
                {showRankMatrix && (
                  <div className="px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-down">
                    {[
                      { rank: 'Novice', pts: '0+', color: 'text-[var(--c-ink)]', active: totalPoints < 500 },
                      { rank: 'Collector', pts: '500+', color: 'text-yellow-500', active: totalPoints >= 500 && totalPoints < 1500 },
                      { rank: 'Bookworm', pts: '1,500+', color: 'text-blue-500', active: totalPoints >= 1500 && totalPoints < 4000 },
                      { rank: 'Scholar', pts: '4,000+', color: 'text-emerald-500', active: totalPoints >= 4000 && totalPoints < 10000 },
                      { rank: 'Sage', pts: '10,000+', color: 'text-purple-500', active: totalPoints >= 10000 && totalPoints < 25000 },
                      { rank: 'Master', pts: '25,000+', color: 'text-orange-500', active: totalPoints >= 25000 && totalPoints < 50000 },
                      { rank: 'Grand Master', pts: '50,000+', color: 'text-red-500', active: totalPoints >= 50000 && totalPoints < 100000 },
                      { rank: 'Babel Librarian', pts: '100,000+', color: 'text-orange-600', active: totalPoints >= 100000 },
                    ].map((item) => (
                      <div key={item.rank} className={`flex justify-between items-center p-4 rounded-2xl transition-all ${item.active ? 'nm-inset scale-[1.02]' : 'nm-flat opacity-80'}`}>
                        <div className={`font-bold text-[11px] uppercase tracking-wider ${item.color}`}>{item.rank}</div>
                        <div className="font-bold text-[10px] text-[var(--c-ink)] opacity-70">{item.pts} PTS</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <button 
                  onClick={() => setShowRecentActivity(!showRecentActivity)}
                  className="w-full text-lg font-bold text-[var(--c-ink)] flex items-center justify-between p-8 nm-flat rounded-3xl group hover:nm-inset transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 nm-inset flex items-center justify-center rounded-xl text-blue-500">
                      <Bell size={24} />
                    </div>
                    <span className="uppercase tracking-widest text-sm">Recent Activity</span>
                  </div>
                  <Plus size={24} className={`transform transition-transform opacity-30 ${showRecentActivity ? 'rotate-45' : ''}`} />
                </button>
                {showRecentActivity && (
                  <div className="nm-flat rounded-3xl overflow-hidden animate-fade-down p-2">
                    {notifications.length > 0 ? notifications.slice(0, 4).map((notification: any) => (
                      <div key={notification.id} className={`flex items-start gap-6 p-6 hover:nm-inset transition-all rounded-2xl ${!notification.read ? 'bg-[var(--c-mint)] bg-opacity-5' : ''}`}>
                        <div className="w-12 h-12 nm-flat flex items-center justify-center rounded-xl flex-shrink-0">
                          {notification.icon === 'repeat' ? <Repeat size={20} className="text-emerald-500" /> : notification.icon === 'star' ? <Star size={20} className="text-yellow-500" /> : notification.icon === 'message-circle' ? <MessageCircle size={20} className="text-blue-500" /> : notification.icon === 'target' ? <Target size={20} className="text-red-500" /> : <Bell size={20} className="text-[var(--c-ink)]" />}
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="font-bold text-xs text-[var(--c-ink)] uppercase tracking-tight">{notification.title}</div>
                          <div className="text-sm font-medium text-[var(--c-ink)] opacity-80 mt-2 line-clamp-1">{notification.body}</div>
                        </div>
                        <div className="text-[10px] text-[var(--c-ink)] font-bold opacity-30 whitespace-nowrap pt-2 uppercase tracking-widest">
                          {formatTimestamp(notification.createdAt)}
                        </div>
                      </div>
                    )) : (
                      <div className="p-12 text-center text-xs font-bold text-[var(--c-ink)] opacity-70 uppercase tracking-widest">No recent activity detected.</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div className="nm-flat p-8 rounded-3xl hidden md:block">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-6 flex items-center gap-3">
                  <TrendingUp size={18} className="text-[var(--c-emerald)]" /> Progression
                </div>
                <div className="text-5xl font-extrabold text-[var(--c-emerald)] mb-2 tracking-tight">
                  {totalPoints.toLocaleString()} <span className="text-lg font-bold text-[var(--c-ink)] opacity-30">PTS</span>
                </div>
                <div className="text-xs font-bold text-[var(--c-ink)] opacity-80 mb-6 flex items-center justify-between">
                  <span>RANK: {rank.toUpperCase()}</span>
                  <div className="group relative">
                    <Info size={16} className="text-[var(--c-emerald)] cursor-help opacity-70" />
                    <div className="absolute right-0 top-8 w-64 nm-flat p-6 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none rounded-2xl">
                      <div className="text-[9px] font-bold uppercase tracking-widest space-y-3">
                        <div className="flex justify-between pb-1 border-b border-white border-opacity-10"><span>Novice</span> <span>0+</span></div>
                        <div className="flex justify-between text-yellow-500 pb-1 border-b border-white border-opacity-10"><span>Collector</span> <span>500+</span></div>
                        <div className="flex justify-between text-blue-500 pb-1 border-b border-white border-opacity-10"><span>Bookworm</span> <span>1.5K+</span></div>
                        <div className="flex justify-between text-emerald-500 pb-1 border-b border-white border-opacity-10"><span>Scholar</span> <span>4K+</span></div>
                        <div className="flex justify-between text-purple-500 pb-1 border-b border-white border-opacity-10"><span>Sage</span> <span>10K+</span></div>
                        <div className="flex justify-between text-orange-500 pb-1 border-b border-white border-opacity-10"><span>Master</span> <span>25K+</span></div>
                        <div className="flex justify-between text-red-500 pb-1 border-b border-white border-opacity-10"><span>Grand Master</span> <span>50K+</span></div>
                        <div className="flex justify-between text-orange-600"><span>Librarian</span> <span>100K+</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="h-4 w-full nm-inset rounded-full p-1 mb-4 overflow-hidden">
                  <div className="h-full bg-[var(--c-emerald)] rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 text-center uppercase tracking-widest">
                  {Math.round(100 - progressPercent)}% MORE TO NEXT RANK
                </div>
              </div>


            </div>
          </div>
        </div>
      )}

      {profileTab === 'library' && (
        <div className="space-y-8 animate-fade-up">
          <div className="flex p-2 nm-inset rounded-[2rem]">
            {libraryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLibraryTab(tab.id)}
                className={`flex-1 py-4 px-6 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-3 transition-all rounded-2xl ${libraryTab === tab.id ? 'nm-flat text-[var(--c-emerald)]' : 'text-[var(--c-ink)] opacity-70 hover:opacity-100'}`}
              >
                <tab.icon size={20} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className={`px-2 py-0.5 nm-inset text-[9px] rounded-lg ${libraryTab === tab.id ? 'text-[var(--c-emerald)]' : 'text-[var(--c-ink)]'}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {libraryTab === 'physical' && (
            <div className="space-y-8">
              <div className="flex p-2 nm-inset rounded-2xl self-start overflow-x-auto no-scrollbar">
                {(['all', 'available', 'in_exchange', 'exchanged'] as StatusFilter[]).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl whitespace-nowrap ${statusFilter === filter ? 'nm-flat text-[var(--c-emerald)]' : 'text-[var(--c-ink)] opacity-70 hover:opacity-100'}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
                {filteredBooks.map((book: any) => {
                  return (
                    <div key={book.id} className="nm-flat p-2 flex flex-col group rounded-2xl md:rounded-3xl transition-transform hover:scale-[1.02] relative overflow-hidden bg-white">
                      {/* Delete Button - Absolute Positioned for cleaner UI */}
                      <button 
                        onClick={() => handleDeleteBook(book.id)} 
                        className="absolute top-3 right-3 p-2 nm-flat text-red-400 hover:text-red-600 transition-all rounded-full z-10"
                        title="Delete Volume"
                      >
                        <Trash2 size={14} />
                      </button>

                      <div className="nm-inset h-40 sm:h-72 flex items-center justify-center relative rounded-xl md:rounded-2xl p-4 md:p-6 overflow-hidden bg-gray-50/30">
                        {book.cover ? (
                          <img
                            src={normalizeBookCover(book.cover)}
                            alt={book.title}
                            className="w-full h-full object-contain rounded-lg transition-transform group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <BookOpen size={24} className="text-[var(--c-emerald)] opacity-20" />
                        )}
                      </div>

                      <div className="p-3 md:p-5 flex flex-col flex-1 min-w-0">
                        <div className="font-black text-[var(--c-ink)] text-[10px] md:text-xs uppercase tracking-tight leading-tight mb-0.5 md:mb-1 group-hover:text-[var(--c-emerald)] transition-colors line-clamp-2 h-7 md:h-10">
                          {book.title}
                        </div>
                        <div className="text-[8px] md:text-[9px] font-bold text-[var(--c-ink)] opacity-50 uppercase tracking-widest truncate">
                          {book.author}
                        </div>
                        {book.status === 'exchanged' && (
                          <button
                            onClick={() => handleRelistBook(book.id)}
                            className="mt-3 w-full py-2.5 nm-flat bg-[var(--c-emerald)] text-white hover:nm-inset text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all rounded-lg shadow-md"
                          >
                            Exchange Again
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  onClick={() => { setShowAddForm(true); setAddStep(1); }}
                  className="nm-flat hover:scale-[1.02] transition-all flex flex-col items-center justify-center gap-4 group rounded-2xl md:rounded-3xl p-4 md:p-8 min-h-[200px] md:min-h-[380px]"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 nm-inset flex items-center justify-center rounded-xl md:rounded-2xl group-hover:scale-110 transition-transform text-[var(--c-emerald)]">
                    <Plus className="w-7 h-7 md:w-8 md:h-8" />
                  </div>
                  <span className="text-[9px] md:text-[10px] font-extrabold text-[var(--c-ink)] uppercase tracking-[0.2em] opacity-70">Add Volume</span>
                </button>
              </div>

              {filteredBooks.length === 0 && (
                <div className="nm-flat p-20 text-center rounded-3xl">
                  <div className="nm-inset w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Book size={32} className="text-[var(--c-emerald)] opacity-20" />
                  </div>
                  <p className="text-[10px] font-bold text-[var(--c-emerald)] opacity-70 uppercase tracking-widest">Your physical library is currently empty.</p>
                </div>
              )}
            </div>
          )}

          {libraryTab === 'digital' && (
            <div className="space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-8">
                {myEpubs.map((epub: any) => (
                  <div key={epub.id} className="nm-flat p-1.5 md:p-2 flex flex-col group rounded-2xl md:rounded-3xl transition-transform hover:scale-[1.02]">
                    <div className="nm-inset h-32 md:h-56 flex items-center justify-center relative rounded-xl md:rounded-2xl overflow-hidden p-2 md:p-4">
                      <div className="w-10 h-10 md:w-16 md:h-16 nm-flat rounded-full flex items-center justify-center">
                        <Smartphone className="w-5 h-5 md:w-8 md:h-8 text-[var(--c-emerald)] opacity-30" />
                      </div>
                      <div className="absolute top-2 right-2 md:top-4 md:right-4 px-2 md:px-3 py-1 md:py-1.5 nm-flat text-[7px] md:text-[8px] font-black uppercase tracking-widest text-[var(--c-emerald)] rounded-full">
                        {epub.genre.toUpperCase()}
                      </div>
                    </div>
                    <div className="p-3 md:p-6 flex flex-col flex-1">
                      <div className="font-bold text-[var(--c-emerald)] text-xs md:text-sm uppercase tracking-tight leading-tight mb-1 line-clamp-1">{epub.title}</div>
                      <div className="text-[8px] md:text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest mb-4 md:mb-6 line-clamp-1">{epub.author}</div>
                      <div className="mt-auto flex flex-col gap-2 md:gap-3">
                        <button
                          onClick={() => handleReadEpub(epub)}
                          className="w-full nm-flat bg-[var(--c-bg)] text-[var(--c-emerald)] py-2.5 md:py-4 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                        >
                          {downloadingEpubId === epub.id ? '...' : 'READ VOLUME'}
                        </button>
                        <button
                          onClick={() => handleDownloadEpub(epub)}
                          className="w-full nm-flat text-[var(--c-emerald)] py-2.5 md:py-4 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                        >
                          {downloadingEpubId === epub.id ? '...' : 'GET EPUB'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={() => onNavigate('epub-library')}
                  className="nm-flat hover:scale-[1.02] transition-all min-h-[180px] md:min-h-[320px] flex flex-col items-center justify-center gap-4 md:gap-6 group rounded-2xl md:rounded-3xl"
                >
                  <div className="w-12 h-12 md:w-16 md:h-16 nm-inset flex items-center justify-center rounded-xl md:rounded-2xl group-hover:scale-110 transition-transform text-[var(--c-emerald)]">
                    <Plus className="w-6 h-6 md:w-8 md:h-8" />
                  </div>
                  <span className="text-[8px] md:text-[10px] font-black text-[var(--c-ink)] uppercase tracking-widest opacity-70">Upload</span>
                </button>
              </div>

              {myEpubs.length === 0 && (
                <div className="nm-flat p-10 md:p-20 text-center rounded-2xl md:rounded-3xl">
                  <div className="nm-inset w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                    <Smartphone className="w-6 h-6 md:w-8 md:h-8 text-[var(--c-emerald)] opacity-20" />
                  </div>
                  <p className="text-[8px] md:text-[10px] font-black text-[var(--c-emerald)] opacity-70 uppercase tracking-widest">No digital books yet.</p>
                </div>
              )}
            </div>
          )}

          {libraryTab === 'wishlist' && (
            <div className="space-y-6 md:space-y-8 max-w-2xl">
              <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--c-emerald)]" />
                  <input
                    placeholder="Search for a book..."
                    className="w-full pl-12 pr-4 py-3 nm-inset focus:nm-flat transition-all outline-none font-bold text-xs text-[var(--c-ink)] rounded-xl placeholder:opacity-30"
                  />
                </div>
                <button className="nm-flat text-[var(--c-emerald)] px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                  Add Item
                </button>
              </div>
              <div className="nm-flat p-16 text-center rounded-3xl">
                <div className="nm-inset w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Heart size={32} className="text-[var(--c-emerald)] opacity-20" />
                </div>
                <p className="text-[10px] font-bold text-[var(--c-emerald)] opacity-70 uppercase tracking-widest">Your wishlist is currently empty.</p>
              </div>
            </div>
          )}
        </div>
      )}

  {showAddForm && (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[1000] flex items-center justify-center p-2 sm:p-6 overflow-hidden no-scrollbar">
      <div className="nm-flat bg-white rounded-[1.5rem] md:rounded-[3rem] w-[98vw] md:w-[90vw] max-w-none max-h-[98vh] md:max-h-[90vh] flex flex-col overflow-hidden animate-fade-up no-scrollbar">
        <div className="px-6 md:px-10 py-6 md:py-8 flex items-center justify-between relative z-10 shrink-0 nm-inset bg-white text-[var(--c-emerald)]">
          <div className="space-y-1">
            <div className="font-black text-lg md:text-xl uppercase tracking-tighter">
              ADD NEW VOLUME
            </div>
            <div className="text-[8px] md:text-[9px] font-bold uppercase tracking-[0.3em]">
              STEP {addStep} OF 3 <span className="mx-2 opacity-30">|</span> CATALOG SYSTEM
            </div>
          </div>
          <button
            onClick={() => setShowAddForm(false)}
            className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all bg-white nm-flat hover:nm-inset"
          >
            <X size={24} className="w-5 h-5 md:w-6 md:h-6 text-[var(--c-emerald)]" />
          </button>
        </div>

                <div className="p-6 md:p-12 space-y-6 md:space-y-12 overflow-y-auto flex-1 min-h-0 no-scrollbar">
                  <div className="flex gap-4">
                    {[1, 2, 3].map((step) => (
                      <div key={step} className={`flex-1 h-2.5 rounded-full transition-all duration-500 ${step <= addStep ? 'nm-flat bg-[var(--c-emerald)]' : 'nm-inset bg-gray-100'}`} />
                    ))}
                  </div>

                  {addStep === 1 && (
                    <>
                      <div className="space-y-8">
                        <div className="space-y-3">
                          <h3 className="font-black text-2xl text-[var(--c-ink)] uppercase tracking-tight">SEARCH DATABASE</h3>
                          <p className="text-[10px] font-bold text-[var(--c-ink)] opacity-90 uppercase tracking-[0.2em]">IDENTIFY YOUR VOLUME TO SYNC METADATA</p>
                        </div>

                        <div className="relative group">
                          <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--c-emerald)] z-20 pointer-events-none" />
                          <input
                            value={bookSearch}
                            onChange={(e) => {
                              setBookSearch(e.target.value);
                              setSelectedSuggestion(null);
                              setFormError(null);
                              setNewBook((current) => ({ ...current, title: '', author: '', genre: '' }));
                            }}
                            className="w-full pl-12 pr-6 py-3.5 nm-inset rounded-2xl font-bold text-[10px] md:text-sm text-[var(--c-ink)] focus:outline-none placeholder:opacity-60 uppercase tracking-tight relative z-10"
                            placeholder="TITLE, AUTHOR, OR ISBN..."
                          />
                        </div>
                          
                          {!selectedSuggestion && bookSuggestions.length > 0 && (
                            <div className="w-full mt-6 md:mt-10 nm-flat md:nm-none bg-white md:bg-transparent rounded-[2.5rem] md:rounded-0 z-[60] max-h-[400px] md:max-h-none overflow-y-auto md:overflow-visible p-3 md:p-0 shadow-2xl md:shadow-none grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-8 no-scrollbar overflow-x-hidden">
                              {bookSuggestions.map((suggestion) => (
                                <button
                                  key={suggestion.id}
                                  onClick={() => handleSelectSuggestion(suggestion)}
                                  className="w-full p-3 text-left nm-flat rounded-xl hover:nm-inset transition-all group border-0 flex flex-col"
                                >
                                  <div className="flex flex-col md:flex-col items-center md:items-start gap-4 md:gap-6">
                                    <div className="w-full h-32 md:w-full md:h-64 flex-shrink-0 nm-flat rounded-xl overflow-hidden p-2 flex items-center justify-center bg-gray-50">
                                      <BookCover
                                        isbn={suggestion.isbn}
                                        googleId={suggestion.googleId}
                                        initialCover={suggestion.cover}
                                        alt={suggestion.title}
                                        className="w-full h-full rounded-lg shadow-sm"
                                      />
                                      {!suggestion.cover && (
                                        <BookOpen className="absolute opacity-10 text-[var(--c-emerald)]" size={32} />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1 pt-0 md:pt-2 w-full text-center md:text-center">
                                      <div className="font-black text-[9px] md:text-xs uppercase tracking-tight text-[var(--c-ink)] line-clamp-2 h-7 md:h-12 mb-0.5 md:mb-1 group-hover:text-[var(--c-emerald)] transition-colors leading-tight">{suggestion.title}</div>
                                      <div className="text-[8px] md:text-[9px] font-bold text-[var(--c-ink)] opacity-50 uppercase tracking-widest truncate">{suggestion.author}</div>
                                      <div className="mt-2 md:mt-3 inline-block px-2 md:px-3 py-1 nm-inset rounded-lg text-[7px] md:text-[8px] font-bold text-[var(--c-emerald)] uppercase tracking-widest">{suggestion.genre}</div>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {isSearchingBooks && (
                          <div className="flex items-center gap-3 px-6 py-4 nm-inset rounded-2xl">
                            <Loader2 size={16} className="animate-spin text-[var(--c-emerald)]" />
                            <span className="text-[9px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-[0.3em]">QUERYING GLOBAL REPOSITORY...</span>
                          </div>
                        )}

                        {selectedSuggestion && (
                          <div className="nm-flat p-4 sm:p-6 rounded-2xl md:rounded-[2rem] relative overflow-hidden bg-white group animate-fade-in">
                            <button 
                              onClick={handleResetSelectedBook}
                              className="absolute top-2 sm:top-4 right-2 sm:right-4 p-2 nm-flat rounded-full text-red-500 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity z-20 hidden sm:flex"
                            >
                              <X size={16} />
                            </button>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--c-emerald)] opacity-5 blur-2xl rounded-full -mr-16 -mt-16"></div>
                            
                            <div className="flex flex-row gap-4 sm:gap-8 relative z-10">
                              {/* Left Column: Text Info & Mobile Reset */}
                              <div className="flex-1 flex flex-col justify-between">
                                <div className="inline-block px-3 py-1 nm-inset rounded-lg text-[7px] sm:text-[8px] font-black text-[var(--c-emerald)] uppercase tracking-widest mb-4 w-max">AUTO-SYNC</div>
                                
                                <div className="space-y-3 sm:space-y-4">
                                  <div>
                                    <div className="text-[7px] sm:text-[8px] font-bold text-[var(--c-ink)] opacity-30 uppercase tracking-widest mb-1 sm:mb-2">VOLUME TITLE</div>
                                    <div className="font-black text-[var(--c-ink)] uppercase tracking-tight text-xs sm:text-sm leading-tight line-clamp-2">{selectedSuggestion.title}</div>
                                  </div>
                                  <div>
                                    <div className="text-[7px] sm:text-[8px] font-bold text-[var(--c-ink)] opacity-30 uppercase tracking-widest mb-1 sm:mb-2">AUTHOR</div>
                                    <div className="font-black text-[var(--c-ink)] uppercase tracking-tight text-[10px] sm:text-xs leading-tight line-clamp-1">{selectedSuggestion.author}</div>
                                  </div>
                                  <div>
                                    <div className="text-[7px] sm:text-[8px] font-bold text-[var(--c-ink)] opacity-30 uppercase tracking-widest mb-1 sm:mb-2">GENRE</div>
                                    <div className="font-black text-[var(--c-emerald)] uppercase tracking-tight text-[10px] sm:text-xs">{selectedSuggestion.genre.toUpperCase()}</div>
                                  </div>
                                </div>

                                <div className="mt-5 sm:hidden">
                                  <button 
                                    onClick={handleResetSelectedBook}
                                    className="w-full nm-flat py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest text-red-500 active:nm-inset"
                                  >
                                    RESET SELECTION
                                  </button>
                                </div>
                              </div>

                              {/* Right Column: Book Image */}
                              <div className="w-24 sm:w-32 shrink-0 self-start">
                                <div className="w-full aspect-[2/3] nm-inset rounded-xl overflow-hidden flex items-center justify-center bg-[var(--c-bg)] p-2">
                                  {selectedSuggestion.cover ? (
                                    <BookCover
                                      isbn={selectedSuggestion.isbn}
                                      googleId={selectedSuggestion.googleId}
                                      initialCover={selectedSuggestion.cover}
                                      alt={selectedSuggestion.title}
                                      className="w-full h-full object-cover rounded-lg shadow-sm"
                                    />
                                  ) : (
                                    <Book size={32} className="text-[var(--c-emerald)] opacity-20" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                    </>
                  )}

                  {addStep === 2 && (
                    <div className="space-y-10">
                      <div className="space-y-3">
                        <h3 className="font-black text-2xl text-[var(--c-ink)] uppercase tracking-tight">CONDITION & LOCALITY</h3>
                        <p className="text-[10px] font-bold text-[var(--c-ink)] opacity-90 uppercase tracking-[0.2em]">CALIBRATE VOLUME INTEGRITY AND POSITION</p>
                      </div>

                      <div className="space-y-6">
                        <label className="text-[9px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-[0.4em] ml-4">VOLUME STATE</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {['like_new', 'good', 'fair', 'worn'].map((condition) => (
                            <button 
                              key={condition} 
                              onClick={() => setNewBook({ ...newBook, condition })} 
                              className={`py-5 px-3 rounded-2xl transition-all text-[9px] font-black uppercase tracking-widest text-center ${newBook.condition === condition ? 'nm-inset text-[var(--c-emerald)]' : 'nm-flat text-[var(--c-ink)] opacity-80 hover:nm-inset hover:opacity-100'}`}
                            >
                              {CONDITION_STYLES[condition].label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="flex justify-between items-center px-4">
                          <label className="text-[9px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-[0.4em]">GEOGRAPHIC ANCHOR</label>
                          <button 
                            type="button"
                            onClick={detectLocation}
                            disabled={isDetectingLocation}
                            className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--c-emerald)] nm-flat px-4 py-2 rounded-lg hover:nm-inset transition-all disabled:opacity-20"
                          >
                            {isDetectingLocation ? 'DETECTING...' : 'SYNC GPS'}
                          </button>
                        </div>
                        <input
                          placeholder="CITY OR NEIGHBORHOOD..."
                          value={newBook.city}
                          onChange={(e) => setNewBook({ ...newBook, city: e.target.value })}
                          className="w-full nm-inset rounded-[2rem] p-6 text-sm font-bold uppercase tracking-tight text-[var(--c-ink)] focus:outline-none placeholder:opacity-60"
                        />
                      </div>
                    </div>
                  )}

                  {addStep === 3 && (
                    <div className="space-y-10">
                      <div className="space-y-3">
                        <h3 className="font-black text-2xl text-[var(--c-ink)] uppercase tracking-tight">EXCHANGE CRITERIA</h3>
                        <p className="text-[10px] font-bold text-[var(--c-ink)] opacity-90 uppercase tracking-[0.2em]">DEFINE NEGOTIATION PREFERENCES</p>
                      </div>

                      <div className="space-y-6">
                        <label className="text-[9px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-[0.4em] ml-4">WISH-LIST PARAMETERS</label>
                        <textarea 
                          value={newBook.wants} 
                          onChange={(e) => setNewBook({ ...newBook, wants: e.target.value })} 
                          className="w-full nm-inset rounded-[2.5rem] p-8 text-sm font-bold text-[var(--c-ink)] focus:outline-none h-44 resize-none placeholder:opacity-60 uppercase tracking-tight" 
                          placeholder="DESCRIBE TITLES OR GENRES YOU SEEK..." 
                        />
                      </div>
                    </div>
                  )}

                  {formError && (
                    <div className="nm-inset p-6 rounded-2xl bg-red-500 bg-opacity-5 border border-red-500 border-opacity-10">
                      <div className="text-[9px] font-black text-red-500 uppercase tracking-widest text-center">{formError}</div>
                    </div>
                  )}

                  <div className="hidden md:flex gap-6 pt-6">
                    {addStep > 1 && (
                      <button onClick={() => setAddStep((step) => step - 1)} className="flex-1 nm-inset py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-[var(--c-ink)] opacity-70 hover:opacity-100 transition-all">
                        BACK
                      </button>
                    )}
                    {addStep < 3 ? (
                      <button onClick={() => {
                        if (addStep === 1) handleContinueFromStepOne();
                        else if (addStep === 2 && !newBook.city?.trim()) setFormError("Please enter your location.");
                        else {
                          setFormError(null);
                          setAddStep((step) => step + 1);
                        }
                      }} className="flex-1 nm-flat text-[var(--c-emerald)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">
                        CONTINUE
                      </button>
                    ) : (
                      <button onClick={handleAddBook} className="flex-1 nm-flat text-[var(--c-emerald)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4">
                        SAVE TO REPOSITORY <BookOpen size={20} />
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="md:hidden px-6 py-6 nm-flat bg-gray-50 shrink-0 flex gap-4">
                  {addStep > 1 && (
                    <button onClick={() => setAddStep((step) => step - 1)} className="flex-1 nm-inset py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-[var(--c-ink)] opacity-70 hover:opacity-100 transition-all">
                      BACK
                    </button>
                  )}
                  {addStep < 3 ? (
                    <button onClick={() => {
                      if (addStep === 1) handleContinueFromStepOne();
                      else if (addStep === 2 && !newBook.city?.trim()) setFormError("Please enter your location.");
                      else {
                        setFormError(null);
                        setAddStep((step) => step + 1);
                      }
                    }} className="flex-1 nm-flat text-[var(--c-emerald)] bg-white py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">
                      CONTINUE
                    </button>
                  ) : (
                    <button onClick={handleAddBook} className="flex-1 nm-flat text-[var(--c-emerald)] bg-white py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
                      SAVE <BookOpen size={18} />
                    </button>
                  )}
                </div>
            </div>
          </div>
        )}
    </div>
  );
}
