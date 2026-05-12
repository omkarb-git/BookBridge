import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, Upload, BookOpen, Search, X, Book, Smartphone, Heart, Image as ImageIcon, Loader2, Repeat } from 'lucide-react';
import { MOCK_EPUBS } from '../data/mockData';

interface LibraryPageProps {
  onNavigate: (page: string) => void;
}

type Tab = 'physical' | 'digital' | 'wishlist';
type StatusFilter = 'all' | 'available' | 'in_exchange' | 'exchanged';

const CONDITION_STYLES: Record<string, { label: string }> = {
  like_new: { label: 'Like New' },
  good: { label: 'Good' },
  fair: { label: 'Fair' },
  worn: { label: 'Worn' },
};

const WISHLIST = [
  { id: '1', title: 'The Midnight Library', author: 'Matt Haig' },
  { id: '2', title: 'Shoe Dog', author: 'Phil Knight' },
  { id: '3', title: 'Project Hail Mary', author: 'Andy Weir' },
  { id: '4', title: 'Kafka on the Shore', author: 'Haruki Murakami' },
  { id: '5', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman' },
];

import { auth, db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';

export default function LibraryPage({ onNavigate }: LibraryPageProps) {
  const [tab, setTab] = useState<Tab>('physical');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [addStep, setAddStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [condition, setCondition] = useState('good');
  const [wants, setWants] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [myBooks, setMyBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'books'),
      where('ownerId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const books = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyBooks(books);
      setLoading(false);
      
      // Background sync removed to prevent performance bottlenecks and rate limiting.
      // Metadata enrichment is now handled more selectively in the discovery flow.
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

  const TABS: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: 'physical', label: 'Physical Books', icon: Book, count: 12 },
    { id: 'digital', label: 'Digital EPUBs', icon: Smartphone, count: 3 },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, count: 5 },
  ];

  const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'available', label: 'Available' },
    { id: 'in_exchange', label: 'In Exchange' },
    { id: 'exchanged', label: 'Exchanged' },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=5&printType=books`);
      const data = await res.json();
      const results = data.items?.map((item: any) => ({
        id: item.id,
        title: item.volumeInfo.title,
        author: item.volumeInfo.authors?.[0] || 'Unknown',
        genre: item.volumeInfo.categories?.[0] || 'Fiction',
        cover: item.volumeInfo.imageLinks?.thumbnail || null,
        isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier || ''
      })) || [];
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveBook = async () => {
    if (!selectedBook || !auth.currentUser) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'books'), {
        title: selectedBook.title,
        author: selectedBook.author,
        genre: selectedBook.genre,
        condition,
        cover: selectedBook.cover,
        isbn: selectedBook.isbn,
        ownerId: auth.currentUser.uid,
        ownerName: auth.currentUser.displayName || 'Reader',
        wants,
        status: 'available',
        city: locationQuery || 'Bangalore',
        createdAt: serverTimestamp()
      });
      setShowAddForm(false);
      setSelectedBook(null);
      setSearchQuery('');
      setSearchResults([]);
      setAddStep(1);
      setFormError(null);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleContinueFromStepOne = () => {
    if (!selectedBook) {
      setFormError("Please select a book first.");
      return;
    }
    setFormError(null);
    setAddStep(2);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-10 animate-fade-in">
      {/* Header */}
      <div className="nm-flat p-8 rounded-[3rem] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--c-emerald)] opacity-5 blur-3xl rounded-full -mr-10 -mt-10"></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-[var(--c-emerald)] uppercase tracking-tight leading-none">
              My Library
            </h1>
            <p className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 uppercase tracking-[0.3em]">MANAGE YOUR COLLECTION & WISHLIST</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => { setShowAddForm(true); setAddStep(1); }}
              className="nm-flat bg-[var(--c-emerald)] text-white px-6 py-4 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              <Plus size={20} /> Add Book
            </button>
            <button
              onClick={() => onNavigate('epub-library')}
              className="nm-flat bg-white text-[var(--c-ink)] px-6 py-4 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-widest hover:nm-inset transition-all"
            >
              <Upload size={20} className="text-[var(--c-emerald)]" /> Upload EPUB
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-2 nm-inset rounded-[2.5rem]">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-5 px-4 text-[11px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all rounded-[1.5rem] ${
              tab === t.id 
                ? 'nm-flat text-[var(--c-emerald)]' 
                : 'text-[var(--c-ink)] opacity-70 hover:opacity-100'
            }`}
          >
            <t.icon size={20} />
            <span className="hidden sm:inline">{t.label}</span>
            <span className={`px-3 py-1 nm-inset text-[9px] rounded-lg ${
              tab === t.id ? 'text-[var(--c-emerald)]' : 'text-[var(--c-ink)]'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Physical Books */}
      {tab === 'physical' && (
        <div className="space-y-10">
          {/* Status filter */}
          <div className="flex p-1.5 nm-inset rounded-2xl self-start overflow-x-auto no-scrollbar">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-6 py-3 text-[9px] font-black uppercase tracking-widest transition-all rounded-xl whitespace-nowrap ${
                  statusFilter === f.id 
                    ? 'nm-flat text-[var(--c-emerald)]' 
                    : 'text-[var(--c-ink)] opacity-70 hover:opacity-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Book grid */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {(loading ? [] : myBooks).length === 0 && !loading && (
              <div className="col-span-full py-20 text-center nm-inset rounded-[3rem]">
                <div className="text-[10px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.5em]">
                  NO PHYSICAL VOLUMES IN REPOSITORY
                </div>
              </div>
            )}
            
            {myBooks
              .filter(b => statusFilter === 'all' || b.status === statusFilter)
              .map((book) => {
              const cond = CONDITION_STYLES[book.condition] || CONDITION_STYLES.good;
              return (
                <div
                  key={book.id}
                  className="nm-flat p-2 flex flex-col group rounded-[2.5rem] transition-transform hover:scale-[1.02]"
                >
                  <div className="nm-inset h-64 flex items-center justify-center relative rounded-[2rem] overflow-hidden p-6 bg-[var(--c-bg)]">
                    {book.cover ? (
                      <img src={book.cover} alt="" className="w-full h-full object-contain drop-shadow-2xl group-hover:scale-110 transition-transform" />
                    ) : (
                      <BookOpen size={48} className="text-[var(--c-emerald)] opacity-20" />
                    )}
                    <div className="absolute top-4 right-4 px-3 py-1.5 nm-flat text-[8px] font-black uppercase tracking-widest text-[var(--c-emerald)] rounded-full z-10">
                      {cond.label}
                    </div>
                  </div>

                  <div className="p-6 flex flex-col flex-1">
                    <div className="font-black text-[var(--c-ink)] text-sm uppercase tracking-tight leading-tight mb-1 line-clamp-1 group-hover:text-[var(--c-emerald)] transition-colors">
                      {book.title}
                    </div>
                    <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest mb-1 line-clamp-1">{book.author}</div>
                    <div className="text-[8px] font-black text-[var(--c-emerald)] uppercase tracking-[0.2em] mb-6 opacity-60">{book.genre}</div>
                    
                    <div className="mt-auto space-y-5">
                      <div className="text-[9px] font-bold text-[var(--c-ink)] opacity-80 uppercase tracking-widest px-4 py-2.5 nm-inset rounded-xl truncate">
                        Wants: {book.wants}
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <button className="py-3 nm-flat hover:nm-inset text-[var(--c-emerald)] transition-all rounded-xl flex items-center justify-center" title="View">
                          <Eye size={18} />
                        </button>
                        <button className="py-3 nm-flat hover:nm-inset text-[var(--c-emerald)] transition-all rounded-xl flex items-center justify-center" title="Edit">
                          <Edit2 size={18} />
                        </button>
                        <button className="py-3 nm-flat hover:text-red-500 transition-all rounded-xl flex items-center justify-center" title="Remove">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add new book card */}
            <button
              onClick={() => { setShowAddForm(true); setAddStep(1); }}
              className="nm-flat hover:nm-inset transition-all min-h-[340px] flex flex-col items-center justify-center gap-6 group rounded-[2.5rem]"
            >
              <div className="w-16 h-16 nm-inset flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform text-[var(--c-emerald)]">
                <Plus size={32} />
              </div>
              <span className="text-[10px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-[0.4em]">ADD BOOK</span>
            </button>
          </div>
        </div>
      )}

      {/* Digital EPUBs */}
      {tab === 'digital' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
            {MOCK_EPUBS.map((epub) => (
              <div
                key={epub.id}
                className="nm-flat p-2 flex flex-col group rounded-[2.5rem] transition-transform hover:scale-[1.02]"
              >
                <div className="nm-inset h-64 flex items-center justify-center relative rounded-[2rem] overflow-hidden p-6 bg-[var(--c-bg)]">
                   {epub.cover ? <span className="text-6xl drop-shadow-2xl">{epub.cover}</span> : <BookOpen className="text-[var(--c-emerald)] opacity-20 w-16 h-16" />}
                   <div className="absolute top-4 right-4 px-3 py-1.5 nm-flat text-[8px] font-black uppercase tracking-widest text-[var(--c-emerald)] rounded-full">
                     EPUB
                   </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="font-black text-[var(--c-ink)] text-sm uppercase tracking-tight mb-1 line-clamp-2 group-hover:text-[var(--c-emerald)] transition-colors">{epub.title}</div>
                  <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest mb-6">{epub.author}</div>
                  
                  <div className="mt-auto space-y-5">
                    <div className="flex flex-col gap-3">
                      <div className="text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Repeat size={14} className="text-[var(--c-emerald)]" />
                        {epub.downloads.toLocaleString()} DOWNLOADS
                      </div>
                      <div className="nm-inset px-4 py-2 rounded-xl text-[10px] font-black text-[var(--c-emerald)] text-center uppercase tracking-widest">
                        +{Math.min(epub.downloads, 100) * 5} KARMA
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <button onClick={() => onNavigate('epub-reader')} className="flex-1 nm-flat bg-[var(--c-emerald)] text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
                        Read
                      </button>
                      <button className="flex-1 nm-flat bg-white text-[var(--c-ink)] py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:nm-inset transition-all">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => onNavigate('epub-library')}
              className="nm-flat hover:nm-inset transition-all min-h-[340px] flex flex-col items-center justify-center gap-6 group rounded-[2.5rem]"
            >
              <div className="w-16 h-16 nm-inset flex items-center justify-center rounded-2xl group-hover:scale-110 transition-transform text-[var(--c-emerald)]">
                <Upload size={32} />
              </div>
              <span className="text-[10px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-[0.4em]">UPLOAD EPUB</span>
            </button>
          </div>
        </div>
      )}

      {/* Wishlist */}
      {tab === 'wishlist' && (
        <div className="space-y-10 max-w-4xl">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 relative">
              <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--c-emerald)]" />
              <input 
                placeholder="SEARCH FOR A VOLUME TO ADD..." 
                className="w-full pl-16 pr-8 py-5 nm-inset rounded-2xl font-bold text-sm text-[var(--c-ink)] focus:outline-none placeholder:opacity-20 uppercase tracking-tight" 
              />
            </div>
            <button className="nm-flat bg-[var(--c-emerald)] text-white px-10 py-5 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">
              <Plus size={20} /> ADD ITEM
            </button>
          </div>

          <div className="nm-flat rounded-[3rem] overflow-hidden p-2">
            {WISHLIST.map((item, i) => (
              <div
                key={item.id}
                className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:nm-inset transition-all rounded-[2rem] group"
              >
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 nm-flat flex items-center justify-center rounded-2xl text-[var(--c-emerald)] font-black text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-black text-[var(--c-ink)] text-sm uppercase tracking-tight group-hover:text-[var(--c-emerald)] transition-colors">{item.title}</div>
                    <div className="text-[10px] font-bold text-[var(--c-ink)] mt-1 uppercase tracking-widest">{item.author}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={() => onNavigate('discover')} className="nm-flat bg-white text-[var(--c-emerald)] px-6 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:nm-inset transition-all">
                    FIND AVAILABLE
                  </button>
                  <button className="w-11 h-11 nm-flat flex items-center justify-center rounded-xl text-red-400 hover:text-red-500 hover:nm-inset transition-all">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Book Modal */}
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
              <button onClick={() => setShowAddForm(false)} className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all bg-white nm-flat hover:nm-inset">
                <X size={24} className="w-5 h-5 md:w-6 md:h-6 text-[var(--c-emerald)]" />
              </button>
            </div>

            <div className="p-6 md:p-12 space-y-6 md:space-y-12 overflow-y-auto flex-1 min-h-0 no-scrollbar">
              <div className="flex gap-4">
                {[1, 2, 3].map(s => (
                  <div
                    key={s}
                    className={`flex-1 h-2.5 rounded-full transition-all duration-500 ${s <= addStep ? 'nm-flat bg-[var(--c-emerald)]' : 'nm-inset bg-gray-100'}`}
                  />
                ))}
              </div>

              {addStep === 1 && (
                <div className="space-y-10">
                  <div className="space-y-3">
                    <h3 className="font-black text-2xl text-[var(--c-ink)] uppercase tracking-tight">VOLUME IDENTIFICATION</h3>
                    <p className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 uppercase tracking-[0.2em]">QUERY GLOBAL REPOSITORY FOR METADATA SYNC</p>
                  </div>
                  
                  <div className="space-y-6">
                    <label className="text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.4em] ml-4">SEARCH PARAMETERS</label>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="relative flex-1 group">
                        <Search size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--c-emerald)] z-20 pointer-events-none" />
                        <input 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          className="w-full pl-14 pr-8 py-5 nm-inset rounded-2xl font-bold text-[11px] md:text-sm text-[var(--c-ink)] focus:outline-none placeholder:opacity-30 uppercase tracking-tight relative z-10" 
                          placeholder="TITLE, AUTHOR, OR ISBN..." 
                        />
                      </div>
                      <button 
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="nm-flat bg-[var(--c-emerald)] text-white px-8 py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isSearching ? <Loader2 className="animate-spin" size={18} /> : 'SEARCH'}
                      </button>
                    </div>
                  </div>

                   {searchResults.length > 0 && !selectedBook && (
                    <div className="w-full grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-8 overflow-y-auto md:overflow-visible pr-1 no-scrollbar overflow-x-hidden">
                      {searchResults.map((book) => (
                        <button
                          key={book.id}
                          onClick={() => setSelectedBook(book)}
                          className="w-full nm-flat p-3 md:p-6 rounded-xl md:rounded-2xl flex flex-col items-center md:items-start gap-4 md:gap-6 hover:nm-inset transition-all group"
                        >
                          <div className="w-full h-32 md:h-64 nm-inset bg-gray-50 flex items-center justify-center rounded-lg md:rounded-2xl overflow-hidden flex-shrink-0">
                            {book.cover ? (
                              <img src={book.cover} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <BookOpen className="opacity-20 text-[var(--c-emerald)]" size={32} />
                            )}
                          </div>
                          <div className="text-center md:text-center flex-1 min-w-0 w-full">
                            <div className="font-black text-[9px] md:text-xs uppercase tracking-tight text-[var(--c-ink)] line-clamp-2 h-7 md:h-12 mb-0.5 md:mb-1 group-hover:text-[var(--c-emerald)] transition-colors leading-tight">{book.title}</div>
                            <div className="text-[8px] md:text-[9px] font-bold text-[var(--c-ink)] opacity-50 uppercase tracking-widest truncate">{book.author}</div>
                          </div>
                          <div className="text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Select</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {selectedBook && (
                    <div className="nm-flat p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[3rem] relative overflow-hidden bg-white group animate-fade-in">
                      <button 
                        onClick={() => setSelectedBook(null)}
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
                              <div className="font-black text-[var(--c-ink)] uppercase tracking-tight text-xs sm:text-sm leading-tight line-clamp-2">{selectedBook.title}</div>
                            </div>
                            <div>
                              <div className="text-[7px] sm:text-[8px] font-bold text-[var(--c-ink)] opacity-30 uppercase tracking-widest mb-1 sm:mb-2">AUTHOR</div>
                              <div className="font-black text-[var(--c-ink)] uppercase tracking-tight text-[10px] sm:text-xs leading-tight line-clamp-1">{selectedBook.author}</div>
                            </div>
                            <div>
                              <div className="text-[7px] sm:text-[8px] font-bold text-[var(--c-ink)] opacity-30 uppercase tracking-widest mb-1 sm:mb-2">GENRE</div>
                              <div className="font-black text-[var(--c-emerald)] uppercase tracking-tight text-[10px] sm:text-xs">{selectedBook.genre.toUpperCase()}</div>
                            </div>
                          </div>

                          <div className="mt-5 sm:hidden">
                            <button 
                              onClick={() => setSelectedBook(null)}
                              className="w-full nm-flat py-2.5 rounded-xl text-[8px] font-black uppercase tracking-widest text-red-500 active:nm-inset"
                            >
                              RESET SELECTION
                            </button>
                          </div>
                        </div>

                        {/* Right Column: Book Image */}
                        <div className="w-24 sm:w-32 shrink-0 self-start">
                          <div className="w-full aspect-[2/3] nm-inset rounded-xl overflow-hidden flex items-center justify-center bg-gray-50">
                            {selectedBook.cover ? (
                              <img src={selectedBook.cover} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Book size={32} className="text-[var(--c-emerald)] opacity-20" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {addStep === 2 && (
                <div className="space-y-10">
                  <div className="space-y-3">
                    <h3 className="font-black text-2xl text-[var(--c-ink)] uppercase tracking-tight">VOLUME INTEGRITY</h3>
                    <p className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 uppercase tracking-[0.2em]">CALIBRATE PHYSICAL STATE FOR ACCURACY</p>
                  </div>
                  
                  <div className="space-y-6">
                    <label className="text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.4em] ml-4">STATE ASSESSMENT</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {[
                        { id: 'like_new', label: 'Like New' },
                        { id: 'good', label: 'Good' },
                        { id: 'fair', label: 'Fair' },
                        { id: 'worn', label: 'Worn' }
                      ].map((c) => (
                         <button
                           key={c.id}
                           onClick={() => setCondition(c.id)}
                           className={`py-5 px-3 rounded-2xl transition-all text-[9px] font-black uppercase tracking-widest text-center ${condition === c.id ? 'nm-inset bg-[var(--c-emerald)] text-white' : 'nm-flat text-[var(--c-ink)] opacity-80 hover:nm-inset hover:opacity-100 hover:text-[var(--c-emerald)]'}`}
                         >
                           {c.label}
                         </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <label className="text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.4em] ml-4">VISUAL DOCUMENTATION</label>
                    <button className="w-full h-44 nm-inset rounded-[2.5rem] flex flex-col items-center justify-center gap-4 group transition-all hover:nm-flat">
                      <ImageIcon size={40} className="text-[var(--c-emerald)] opacity-30 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--c-ink)] opacity-70">UPLOAD VOLUME IMAGERY</span>
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    <label className="text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.4em] ml-4">ANNOTATIONS</label>
                    <textarea 
                      className="w-full nm-inset rounded-[2rem] p-6 text-sm font-bold text-[var(--c-ink)] focus:outline-none h-32 resize-none placeholder:opacity-20 uppercase tracking-tight" 
                      placeholder="DESCRIBE ANY IMPERFECTIONS..." 
                    />
                  </div>
                  
                  <div className="space-y-6">
                    <label className="text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.4em] ml-4">LOCATION</label>
                    <input 
                      value={locationQuery}
                      onChange={(e) => setLocationQuery(e.target.value)}
                      className="w-full nm-inset rounded-2xl px-6 py-4 font-bold text-sm text-[var(--c-ink)] focus:outline-none placeholder:opacity-20 uppercase tracking-tight" 
                      placeholder="ENTER YOUR LOCATION..." 
                    />
                  </div>
                </div>
              )}

              {addStep === 3 && (
                <div className="space-y-10">
                  <div className="space-y-3">
                    <h3 className="font-black text-2xl text-[var(--c-ink)] uppercase tracking-tight">EXCHANGE PARAMETERS</h3>
                    <p className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 uppercase tracking-[0.2em]">ESTABLISH NEGOTIATION BOUNDARIES</p>
                  </div>
                  
                  <div className="space-y-6">
                    <label className="text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.4em] ml-4">ACQUISITION TARGETS</label>
                     <div className="flex flex-col sm:flex-row gap-4">
                       <input 
                         value={wants}
                         onChange={(e) => setWants(e.target.value)}
                         className="flex-1 nm-inset rounded-2xl px-6 py-4 font-bold text-sm text-[var(--c-ink)] focus:outline-none placeholder:opacity-20 uppercase tracking-tight" 
                         placeholder="TITLE, AUTHOR, OR GENRE..." 
                       />
                     </div>
                    <div className="flex flex-wrap gap-4 mt-6">
                      <span className="inline-flex items-center gap-3 px-4 py-2 nm-flat rounded-xl text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-widest">
                        SCI-FI <button className="text-red-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                      </span>
                      <span className="inline-flex items-center gap-3 px-4 py-2 nm-flat rounded-xl text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-widest">
                        DUNE <button className="text-red-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-8 mt-10">
                    <label className="text-[9px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.4em] ml-4">GEOGRAPHIC RADIUS</label>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { id: 'local', title: 'LOCAL PROXIMITY', desc: 'WITHIN 5KM NEIGHBORHOOD' },
                        { id: 'city', title: 'CITY-WIDE METRO', desc: 'ALL ACCESSIBLE REGIONS' },
                        { id: 'any', title: 'GLOBAL LOGISTICS', desc: 'Willing TO SHIP/MAIL' }
                      ].map((opt, i) => (
                        <label key={i} className={`flex items-center gap-6 p-6 nm-flat rounded-[2rem] cursor-pointer transition-all hover:nm-inset group`}>
                          <div className="relative flex h-6 w-6">
                            <input type="radio" name="scope" defaultChecked={i === 0} className="peer absolute h-full w-full opacity-0 cursor-pointer" />
                            <div className="h-full w-full nm-inset rounded-full group-hover:nm-flat transition-all flex items-center justify-center p-1.5">
                              <div className="h-full w-full rounded-full bg-[var(--c-emerald)] opacity-0 peer-checked:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          <div>
                            <div className="font-black text-[var(--c-ink)] text-sm uppercase tracking-tight group-hover:text-[var(--c-emerald)] transition-colors">{opt.title}</div>
                            <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase tracking-widest mt-1">{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
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
                      <button onClick={() => setAddStep(s => s - 1)} className="flex-1 nm-inset py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-[var(--c-ink)] opacity-70 hover:opacity-100 transition-all">
                        BACK
                      </button>
                    )}
                    {addStep < 3 ? (
                      <button onClick={() => {
                        if (addStep === 1) handleContinueFromStepOne();
                        else if (addStep === 2 && !condition) setFormError("Please select a physical condition.");
                        else if (addStep === 2 && !locationQuery.trim()) setFormError("Please enter your location.");
                        else {
                          setFormError(null);
                          setAddStep(s => s + 1);
                        }
                      }} className="flex-1 nm-flat text-[var(--c-emerald)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">
                        CONTINUE
                      </button>
                    ) : (
                      <button onClick={handleSaveBook} disabled={isSaving} className="flex-1 nm-flat text-[var(--c-emerald)] py-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-4">
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : 'SAVE TO REPOSITORY'} <BookOpen size={20} />
                      </button>
                    )}
                  </div>
                </div>

            <div className="md:hidden px-6 py-6 nm-flat bg-gray-50 shrink-0 flex gap-4">
              {addStep > 1 && (
                <button onClick={() => setAddStep(s => s - 1)} className="flex-1 nm-inset py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-[var(--c-ink)] opacity-70 hover:opacity-100 transition-all">
                  BACK
                </button>
              )}
              {addStep < 3 ? (
                <button onClick={() => {
                  if (addStep === 1) handleContinueFromStepOne();
                  else if (addStep === 2 && !condition) setFormError("Please select a physical condition.");
                  else if (addStep === 2 && !locationQuery.trim()) setFormError("Please enter your location.");
                  else {
                    setFormError(null);
                    setAddStep(s => s + 1);
                  }
                }} className="flex-1 nm-flat text-[var(--c-emerald)] bg-white py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all">
                  CONTINUE
                </button>
              ) : (
                <button onClick={handleSaveBook} disabled={isSaving} className="flex-1 nm-flat text-[var(--c-emerald)] bg-white py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {isSaving ? <Loader2 className="animate-spin" size={14} /> : 'SAVE'} <BookOpen size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
