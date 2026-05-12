import { useState, useEffect } from 'react';
import { BookOpen, Menu, X, Bell, Search, User, Repeat, Star, MessageCircle, Target, Book, Check, Loader2 } from 'lucide-react';
import { collection, onSnapshot, orderBy, query, updateDoc, doc, where, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  isAuthenticated: boolean;
  onAuthClick: (type: 'login' | 'signup') => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  user?: any;
}

export default function Navbar({ currentPage, onNavigate, isAuthenticated, onAuthClick, sidebarOpen, onToggleSidebar, user }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!isAuthenticated || !user?.uid) {
      setNotifications([]);
      return;
    }

    setLoadingNotifs(true);
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      limit(20)
    );

    const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      notifs.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      setNotifications(notifs);
      setLoadingNotifs(false);
    }, (err) => {
      console.error("Notifications error:", err);
      setLoadingNotifs(false);
    });

    // Safety timeout to prevent infinite loader if snapshot hangs
    const timeout = setTimeout(() => setLoadingNotifs(false), 5000);

    return () => {
      unsubscribeNotifs();
      clearTimeout(timeout);
    };
  }, [isAuthenticated, user?.uid]);

  const handleMarkRead = async (notifId: string) => {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
  };

  const publicLinks = [
    { label: 'Home', page: 'landing' },
    { label: 'How It Works', page: 'how-it-works' },
    { label: 'About', page: 'about' },
    { label: 'Community', page: 'community' },
    { label: 'Pricing', page: 'pricing' },
  ];

  // Helper to map notification icons string to Lucide component
  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'repeat': return <Repeat size={18} className="text-blue-500" />;
      case 'star': return <Star size={18} className="text-yellow-500" />;
      case 'message-circle': return <MessageCircle size={18} className="text-green-500" />;
      case 'target': return <Target size={18} className="text-red-500" />;
      case 'book': return <Book size={18} className="text-purple-500" />;
      case 'check': return <Check size={18} className="text-green-500" />;
      default: return <Bell size={18} className="text-[var(--c-ink)]" />;
    }
  };

  if (isAuthenticated) {
    return (
      <nav className="sticky top-0 z-50 bg-[var(--c-bg)] p-2 sm:px-4 sm:py-2">
        <div className="nm-flat px-2 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-1 sm:gap-3">
            {onToggleSidebar && (
              <button 
                onClick={onToggleSidebar} 
                className={`p-2 text-[var(--c-ink)] transition-all rounded-full active:scale-90 ${sidebarOpen ? 'nm-inset' : 'nm-flat'}`}
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            )}
            <button onClick={() => onNavigate('home')} className="flex items-center gap-1.5 sm:gap-2 group active:scale-95 transition-all">
              <div className="w-7 h-7 sm:w-9 sm:h-9 bg-[var(--c-emerald)] flex items-center justify-center rounded-lg sm:rounded-xl shadow-lg group-hover:scale-105 transition-transform">
                <BookOpen size={14} sm:size={18} className="text-[var(--c-mint)]" />
              </div>
              <span className="font-bold text-[var(--c-emerald)] hidden xs:block text-[10px] sm:text-sm tracking-tight uppercase">BookBridge</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <button
              onClick={() => onNavigate('home')}
              className="p-2 sm:p-2.5 text-[var(--c-ink)] nm-flat hover:nm-inset active:scale-90 transition-all rounded-full hidden sm:flex"
            >
              <Search size={16} />
            </button>

            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className={`p-2.5 sm:p-3 text-[var(--c-ink)] transition-all rounded-full relative active:scale-90 ${notifOpen ? 'nm-inset' : 'nm-flat hover:nm-inset'}`}
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border border-[var(--c-bg)] shadow-sm animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-[-20px] xs:right-0 top-full mt-4 w-[280px] sm:w-80 nm-flat bg-white z-[100] overflow-hidden p-2 border border-[var(--c-ink)]/5 shadow-2xl">
                  <div className="p-3 sm:p-4 mb-2 flex justify-between items-center nm-inset bg-[var(--c-bg)]">
                    <span className="font-bold text-[10px] sm:text-xs text-[var(--c-ink)] uppercase tracking-widest">
                      Notifications {unreadCount > 0 && <span className="bg-red-500 text-white px-1.5 py-0.5 rounded-full text-[9px] ml-1">{unreadCount}</span>}
                    </span>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button onClick={handleMarkAllRead} className="text-[9px] sm:text-[10px] font-bold text-[var(--c-emerald)] hover:underline uppercase">Clear</button>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="text-[var(--c-ink)] opacity-80 hover:opacity-100 transition-opacity"><X size={14} /></button>
                    </div>
                  </div>
                  <div className="max-h-[300px] sm:max-h-[360px] overflow-y-auto space-y-2 p-1">
                    {loadingNotifs ? (
                      <div className="flex items-center justify-center py-6 sm:py-8"><Loader2 size={20} className="animate-spin text-[var(--c-emerald)]" /></div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 sm:p-6 text-center text-[9px] sm:text-[10px] font-bold uppercase text-[var(--c-ink)]">No notifications yet</div>
                    ) : notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => { handleMarkRead(n.id); if (n.exchangeId) onNavigate('exchanges'); setNotifOpen(false); }}
                        className={`p-2.5 sm:p-3 nm-flat hover:nm-inset flex gap-2 sm:gap-3 transition-all cursor-pointer ${!n.read ? 'border-l-4 border-[var(--c-emerald)]' : ''}`}
                      >
                        <div className="mt-0.5 flex-shrink-0">{getIcon(n.icon)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-[var(--c-ink)]">{n.title}</div>
                          <div className="text-[10px] sm:text-[11px] text-[var(--c-ink)] mt-1 leading-snug line-clamp-2">{n.body}</div>
                        </div>
                        {!n.read && <div className="w-1.5 h-1.5 bg-[var(--c-emerald)] rounded-full flex-shrink-0 mt-1.5" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => onNavigate('profile')}
              className="ml-1 sm:ml-2 w-10 h-10 sm:w-11 sm:h-11 nm-flat hover:nm-inset p-1 active:scale-95 transition-all rounded-full overflow-hidden"
            >
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover rounded-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User size={18} className="text-[var(--c-emerald)]" />
                </div>
              )}
            </button>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 bg-[var(--c-bg)] p-4">
      <div className="max-w-7xl mx-auto nm-flat px-6 h-16 flex items-center justify-between">
        <button onClick={() => onNavigate('landing')} className="flex items-center gap-2 group active:scale-95 transition-all">
          <div className="w-9 h-9 bg-[var(--c-emerald)] flex items-center justify-center rounded-xl shadow-lg group-hover:scale-105 transition-transform">
            <BookOpen size={18} className="text-[var(--c-mint)]" />
          </div>
          <span className="font-bold text-[var(--c-emerald)] tracking-tight uppercase">BookBridge</span>
        </button>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-4 text-[10px] font-black uppercase tracking-wider">
          {publicLinks.map(link => (
            <button
              key={link.page}
              onClick={() => onNavigate(link.page)}
              className={`px-6 py-2.5 transition-all duration-300 rounded-xl active:scale-95 ${
                currentPage === link.page
                  ? 'bg-white nm-flat text-[var(--c-emerald)] scale-110 shadow-2xl z-10'
                  : 'nm-inset text-[var(--c-ink)] hover:nm-flat hover:scale-105 hover:text-[var(--c-emerald)]'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => onAuthClick('login')}
            className="px-5 py-2.5 text-[11px] font-bold uppercase text-[var(--c-ink)] nm-flat hover:nm-inset active:scale-95 transition-all rounded-lg"
          >
            Log in
          </button>
          <button
            onClick={() => onAuthClick('signup')}
            className="px-5 py-2.5 text-[11px] font-bold uppercase bg-[var(--c-emerald)] text-[var(--c-mint)] nm-flat hover:scale-105 active:scale-95 transition-all rounded-lg"
          >
            Sign up
          </button>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-3 text-[var(--c-ink)] nm-flat hover:nm-inset active:scale-95 transition-all rounded-full"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden mt-4 nm-flat overflow-hidden p-2">
          <div className="space-y-4 mb-6">
            {publicLinks.map(link => (
              <button
                key={link.page}
                onClick={() => { onNavigate(link.page); setMobileOpen(false); }}
                className={`block w-full text-left px-6 py-4 text-[13px] font-black uppercase tracking-wider transition-all active:scale-95 ${
                  currentPage === link.page
                    ? 'bg-white nm-flat text-[var(--c-emerald)] shadow-xl'
                    : 'nm-inset text-[var(--c-ink)]'
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>
          <div className="p-2 space-y-3 nm-inset rounded-xl">
            <button 
              onClick={() => { onAuthClick('login'); setMobileOpen(false); }} 
              className="w-full nm-flat px-4 py-3 text-sm font-bold uppercase text-[var(--c-ink)] rounded-lg"
            >
              Log in
            </button>
            <button 
              onClick={() => { onAuthClick('signup'); setMobileOpen(false); }} 
              className="w-full bg-[var(--c-emerald)] text-[var(--c-mint)] px-4 py-3 text-sm font-bold uppercase rounded-lg shadow-lg"
            >
              Sign up
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
