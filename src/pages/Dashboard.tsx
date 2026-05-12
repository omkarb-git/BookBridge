import { ArrowRight, TrendingUp, Repeat, Star, Trophy, Book, MessageCircle, MapPin, Target, Bell, Download } from 'lucide-react';
import { MOCK_EPUBS, MOCK_EXCHANGES, MOCK_NOTIFICATIONS } from '../data/mockData';
import BookCard from '../components/BookCard';
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

const EXCHANGE_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending' },
  accepted: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Accepted' },
  meeting_scheduled: { bg: 'bg-green-100', text: 'text-green-800', label: 'Meeting Set' },
  in_transit: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'In Progress' },
  completed: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Completed' },
};

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [nearbyBooks, setNearbyBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const activeExchanges = MOCK_EXCHANGES.filter(e => e.status !== 'completed');
  const newNotifs = MOCK_NOTIFICATIONS.filter(n => !n.read);

  useEffect(() => {
    const fetchLatestBooks = async () => {
      try {
        const booksRef = collection(db, 'books');
        const q = query(booksRef, where('status', '==', 'available'), limit(20));
        const snapshot = await getDocs(q);
        const fetchedBooks = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(book => book.ownerId !== auth.currentUser?.uid)
          .slice(0, 3);
        setNearbyBooks(fetchedBooks);
      } catch (err) {
        console.error('Error fetching latest books:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLatestBooks();
  }, []);

  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'repeat': return <Repeat size={20} className="text-[var(--c-ink)]" />;
      case 'star': return <Star size={20} className="text-[var(--c-ink)]" />;
      case 'message-circle': return <MessageCircle size={20} className="text-[var(--c-ink)]" />;
      case 'target': return <Target size={20} className="text-[var(--c-ink)]" />;
      case 'book': return <Book size={20} className="text-[var(--c-ink)]" />;
      default: return <Bell size={20} className="text-[var(--c-ink)]" />;
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-10 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <div className="nm-flat rounded-[3.5rem] p-10 md:p-14 relative overflow-hidden bg-white">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[var(--c-emerald)] opacity-5 blur-[80px] rounded-full -mr-40 -mt-40"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-10">
          <div>
            <div className="inline-flex nm-inset px-5 py-1.5 rounded-full text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-[0.2em] mb-6">
              CENTRAL COMMAND
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-[var(--c-ink)] uppercase tracking-tighter leading-none mb-6">
              Good morning, <span className="text-[var(--c-emerald)]">Explorer</span>
            </h1>
            <p className="text-sm md:text-base font-medium text-[var(--c-ink)] opacity-80 uppercase tracking-widest max-w-xl leading-relaxed">
              You have <span className="text-[var(--c-emerald)] font-black">{activeExchanges.length} ACTIVE EXCHANGES</span> AND <span className="text-[var(--c-emerald)] font-black">{newNotifs.length} NEW ALERTS</span> REQUIRING ATTENTION.
            </p>
          </div>
          <button
            onClick={() => onNavigate('library')}
            className="nm-flat bg-[var(--c-emerald)] text-white px-10 py-5 rounded-[2rem] flex items-center gap-4 text-[12px] font-black uppercase tracking-[0.2em] self-start hover:scale-105 active:scale-95 transition-all shadow-2xl"
          >
            ADD TO COLLECTION <ArrowRight size={20} />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { label: 'My Collection', value: '12', icon: Book, page: 'library', color: 'text-[var(--c-emerald)]' },
          { label: 'Exchanges', value: '8', icon: Repeat, page: 'exchanges', color: 'text-[var(--c-emerald)]' },
          { label: 'Karma Points', value: '2,450', icon: Star, page: 'leaderboard', color: 'text-[var(--c-emerald)]' },
          { label: 'Global Rank', value: '#234', icon: Trophy, page: 'leaderboard', color: 'text-[var(--c-emerald)]' },
        ].map((stat, i) => (
          <button
            key={i}
            onClick={() => onNavigate(stat.page)}
            className="nm-flat bg-white rounded-[2.5rem] p-8 text-left hover:nm-inset transition-all flex flex-col items-start group"
          >
            <div className="w-14 h-14 nm-inset rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <stat.icon size={24} className={stat.color} />
            </div>
            <div className="text-3xl font-black text-[var(--c-ink)] mb-2 tracking-tight">{stat.value}</div>
            <div className="text-[10px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.2em]">{stat.label}</div>
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 nm-inset rounded-xl flex items-center justify-center text-[var(--c-emerald)]">
                <MapPin size={20} />
              </div>
              <h2 className="text-xl font-black text-[var(--c-ink)] uppercase tracking-tight">New Additions</h2>
            </div>
            <button 
              onClick={() => onNavigate('discover')} 
              className="nm-flat px-6 py-2 rounded-full text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-widest hover:nm-inset transition-all"
            >
              EXPLORE ALL
            </button>
          </div>

          {loading ? (
            <div className="nm-inset rounded-[3rem] h-64 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 nm-flat bg-white rounded-full flex items-center justify-center">
                <TrendingUp size={24} className="text-[var(--c-emerald)] animate-pulse" />
              </div>
              <p className="text-[10px] font-black text-[var(--c-ink)] opacity-20 uppercase tracking-[0.3em]">SCANNING GRID...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {nearbyBooks.map(book => (
                <BookCard
                  key={book.id}
                  book={book}
                  onRequestExchange={() => onNavigate('exchanges')}
                  onViewDetails={() => onNavigate('discover')}
                  compact
                />
              ))}
              {nearbyBooks.length === 0 && (
                <div className="col-span-full nm-inset rounded-[3rem] py-20 text-center">
                  <p className="text-[10px] font-black text-[var(--c-ink)] opacity-20 uppercase tracking-[0.4em]">NO NEW SIGNALS DETECTED</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-10">
          {/* Mutual Match Card */}
          <div className="nm-flat bg-white rounded-[3rem] overflow-hidden group">
            <div className="bg-[var(--c-emerald)] px-8 py-4 flex items-center gap-4 text-white">
              <Target size={20} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">MUTUAL LINK FOUND</span>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-[11px] text-[var(--c-ink)] opacity-80 font-medium leading-relaxed uppercase tracking-wider">
                <span className="text-[var(--c-ink)] font-black">RAVI</span> POSSESSES <span className="text-[var(--c-emerald)] font-black">ATOMIC HABITS</span> AND SEEKS <span className="text-[var(--c-emerald)] font-black">IKIGAI</span> — YOU POSSESS BOTH MATCH CRITERIA.
              </p>
              <button
                onClick={() => onNavigate('exchanges')}
                className="w-full nm-flat bg-white text-[var(--c-emerald)] py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:nm-inset transition-all"
              >
                INITIALIZE EXCHANGE
              </button>
            </div>
          </div>

          {/* Active Exchanges Card */}
          <div className="nm-flat bg-white rounded-[3rem] overflow-hidden flex flex-col h-full">
            <div className="nm-inset mx-8 mt-8 mb-4 px-6 py-3 rounded-2xl flex items-center gap-4 text-[var(--c-emerald)]">
              <Repeat size={18} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">ACTIVE OPS</h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">
              {activeExchanges.map(ex => {
                const statusStyle = EXCHANGE_STATUS_STYLES[ex.status] || EXCHANGE_STATUS_STYLES.pending;
                return (
                  <button
                    key={ex.id}
                    onClick={() => onNavigate('exchanges')}
                    className="w-full p-6 text-left nm-flat bg-white hover:nm-inset rounded-[2rem] transition-all group"
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0">
                          <div className="font-black text-[var(--c-ink)] text-sm uppercase tracking-tight truncate">{ex.partner}</div>
                          <div className="text-[9px] font-bold text-[var(--c-ink)] opacity-30 mt-1 uppercase tracking-widest flex items-center gap-2">
                             SYNCING: {ex.myBook.substring(0,10)}... <Repeat size={10} className="text-[var(--c-emerald)]" />
                          </div>
                        </div>
                        <div className="nm-inset px-3 py-1 rounded-lg text-[8px] font-black text-[var(--c-emerald)] uppercase tracking-widest flex-shrink-0">
                          {statusStyle.label}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* EPUB Shelf */}
      <div className="space-y-8 pt-6 border-t border-[var(--c-ink)] border-opacity-5">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 nm-inset rounded-xl flex items-center justify-center text-[var(--c-emerald)]">
              <Download size={20} />
            </div>
            <h2 className="text-xl font-black text-[var(--c-ink)] uppercase tracking-tight">New Digital Books</h2>
          </div>
          <button 
            onClick={() => onNavigate('epub-library')} 
            className="nm-flat px-6 py-2 rounded-full text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-widest hover:nm-inset transition-all"
          >
            VIEW ALL
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {MOCK_EPUBS.map((epub, index) => (
            <button
              key={epub.id}
              onClick={() => onNavigate('epub-library')}
              className="nm-flat bg-white p-6 rounded-[2.5rem] hover:nm-inset transition-all text-left flex flex-col group h-full"
            >
              <div className="w-14 h-14 nm-inset rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Book className="text-[var(--c-emerald)] opacity-70" size={24} />
              </div>
              <div className="font-black text-[var(--c-ink)] text-sm uppercase tracking-tight leading-tight mb-2 line-clamp-2">
                {epub.title}
              </div>
              <div className="text-[9px] font-black text-[var(--c-ink)] opacity-20 uppercase tracking-widest">{epub.author}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
