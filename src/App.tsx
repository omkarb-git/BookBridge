import { useState, useEffect, createContext, useContext, useRef } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import DiscoverPage from './pages/DiscoverPage';
import ProfilePage from './pages/ProfilePage';
import ExchangesPage from './pages/ExchangesPage';
import NotificationOverlay from './components/NotificationOverlay';
import EpubReader from './components/EpubReader';
import MessagesPage from './pages/MessagesPage';
import AuthPage from './pages/AuthPage';
import EpubLibrary from './pages/EpubLibrary';
import LeaderboardPage from './pages/LeaderboardPage';
import ResourcesPage from './pages/ResourcesPage';
import { BookMarked, BookOpen } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useGeolocation } from './hooks/useGeolocation';

type Page =
  | 'landing'
  | 'home'
  | 'discover'
  | 'profile'
  | 'library'
  | 'exchanges'
  | 'messages'
  | 'epubs'
  | 'epub-library'
  | 'read'
  | 'epub-reader'
  | 'leaderboard'
  | 'about'
  | 'how-it-works'
  | 'community'
  | 'pricing'
  | 'contact'
  | 'login'
  | 'signup'
  | 'blog'
  | 'help-center'
  | 'privacy'
  | 'terms'
  | 'api-docs';

// Scroll target sections for landing page
const LANDING_SCROLL_MAP: Record<string, string> = {
  about: 'features-section',
  'how-it-works': 'how-it-works-section',
  community: 'community-section',
  pricing: 'cta-section',
  contact: 'cta-section',
};

interface LocationContextValue {
  location: { lat: number; lng: number } | null;
  loading: boolean;
  error: string | null;
}

export const LocationContext = createContext<LocationContextValue>({
  location: null,
  loading: true,
  error: null,
});

export const useLocationContext = () => useContext(LocationContext);

export default function App() {
  const mainRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('landing');
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [scrollTarget, setScrollTarget] = useState<string | null>(null);
  const [readingBook, setReadingBook] = useState<{ url: string | ArrayBuffer; title: string } | null>(null);
  const [profileAddFormOpen, setProfileAddFormOpen] = useState(false);

  // Geolocation — only starts when user is authenticated
  const { location, loading: geoLoading, error: geoError } = useGeolocation(
    isAuthenticated ? user?.uid : null
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsAuthenticated(true);
        setCurrentPage((page) => (page === 'landing' || page === 'login' || page === 'signup' ? 'home' : page));

        // Create/update user document in Firestore
        try {
          await setDoc(
            doc(db, 'users', firebaseUser.uid),
            {
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Reader',
              email: firebaseUser.email,
              photoURL: firebaseUser.photoURL,
              lastLoginAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (err) {
          console.error('Error creating user document:', err);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavigate = (page: string) => {
    if (page === 'profile-add-book') {
      setCurrentPage('profile');
      setProfileAddFormOpen(true);
      return;
    }

    // Handle landing page section scrolling
    if (LANDING_SCROLL_MAP[page] && !isAuthenticated) {
      setCurrentPage(page as Page);
      setScrollTarget(LANDING_SCROLL_MAP[page]);
      return;
    }

    const pageMap: Record<string, string> = {
      discover: 'home',
      library: 'profile',
      'epub-library': 'epubs',
      'epubs': 'epubs',
      'epub-reader': 'read',
    };

    const protectedPages: Page[] = ['home', 'profile', 'exchanges', 'messages', 'leaderboard'];
    const targetPage = (pageMap[page] ?? page) as Page;

    if (!isAuthenticated && protectedPages.includes(targetPage)) {
      setCurrentPage('login');
      mainRef.current?.scrollTo(0, 0);
      return;
    }

    setScrollTarget(null);
    setCurrentPage(targetPage);
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAuth = async (type: 'login' | 'signup') => {
    setCurrentPage(type);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Landing page (not authenticated)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[var(--c-bg)] text-[var(--c-ink)]">
        <Navbar 
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isAuthenticated={false}
          onAuthClick={handleAuth}
        />
        {(currentPage === 'login' || currentPage === 'signup') ? (
          <AuthPage mode={currentPage} onNavigate={handleNavigate} />
        ) : (currentPage === 'epubs' || currentPage === 'epub-library') ? (
          <div className="pt-16">
            <EpubLibrary 
              onRead={(url, title) => {
                setReadingBook({ url, title });
                setCurrentPage('read');
              }} 
            />
          </div>
        ) : (currentPage === 'read' || currentPage === 'epub-reader') && readingBook ? (
          <EpubReader 
            url={readingBook.url} 
            title={readingBook.title} 
            onClose={() => {
              setReadingBook(null);
              setCurrentPage('epubs');
            }} 
          />
        ) : ['blog', 'help-center', 'privacy', 'terms', 'api-docs'].includes(currentPage) ? (
          <ResourcesPage type={currentPage} onBack={() => handleNavigate('landing')} />
        ) : (
          <LandingPage onNavigate={handleNavigate} onAuthClick={handleAuth} scrollTarget={scrollTarget} />
        )}
        <Footer onNavigate={handleNavigate} />
      </div>
    );
  }

  // Authenticated app
  return (
    <LocationContext.Provider value={{ location, loading: geoLoading, error: geoError }}>
      <div className="flex h-screen bg-[var(--c-bg)] text-[var(--c-ink)]">
        <NotificationOverlay />
        <Sidebar 
          currentPage={currentPage} 
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={user}
        />
        
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar
            currentPage={currentPage}
            onNavigate={handleNavigate}
            isAuthenticated={isAuthenticated}
            onAuthClick={handleAuth}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            user={user}
          />

          <main ref={mainRef} className={`flex-1 ${(currentPage === 'home' || currentPage === 'discover') ? 'overflow-hidden' : 'overflow-auto scroll-smooth'} transition-all duration-300 ease-in-out ${sidebarOpen ? 'lg:pl-72' : 'lg:pl-[104px]'}`}>
            {(currentPage === 'home' || currentPage === 'discover') && <DiscoverPage onNavigate={handleNavigate} />}
            {currentPage === 'profile' && (
              <ProfilePage 
                onNavigate={handleNavigate} 
                onRead={(url, title) => {
                  setReadingBook({ url, title });
                  setCurrentPage('read');
                }} 
                openAddForm={profileAddFormOpen}
                onCloseAddForm={() => setProfileAddFormOpen(false)}
              />
            )}
            {currentPage === 'exchanges' && <ExchangesPage onNavigate={handleNavigate} />}
            {currentPage === 'messages' && <MessagesPage onNavigate={handleNavigate} />}
            
            {(currentPage === 'epubs' || currentPage === 'epub-library') && (
              <EpubLibrary 
                onRead={(url, title) => {
                  setReadingBook({ url, title });
                  setCurrentPage('read');
                }} 
              />
            )}
            
            {(currentPage === 'read' || currentPage === 'epub-reader') && readingBook ? (
              <EpubReader 
                url={readingBook.url} 
                title={readingBook.title} 
                onClose={() => {
                  setReadingBook(null);
                  setCurrentPage('epubs');
                }} 
              />
            ) : (currentPage === 'read' || currentPage === 'epub-reader') && (
              <div className="max-w-7xl mx-auto px-6 py-12 animate-fade-in">
                <div className="nm-flat bg-white rounded-[3rem] p-20 flex flex-col items-center text-center">
                  <div className="w-24 h-24 nm-inset rounded-[2rem] flex items-center justify-center text-[var(--c-emerald)] mb-10">
                    <BookMarked size={48} />
                  </div>
                  <h2 className="text-4xl font-black text-[var(--c-ink)] uppercase tracking-tight mb-4">Volume Required</h2>
                  <p className="text-sm font-bold text-[var(--c-ink)] uppercase tracking-widest max-w-sm mb-12">
                    Please select a digital asset from the repository to initiate reading protocols.
                  </p>
                  <button
                    onClick={() => handleNavigate('epub-library')}
                    className="nm-flat bg-[var(--c-emerald)] text-white px-12 py-6 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
                  >
                    <BookOpen size={20} /> ACCESS REPOSITORY
                  </button>
                </div>
              </div>
            )}
            
            {currentPage === 'leaderboard' && <LeaderboardPage />}
            
            {['blog', 'help-center', 'privacy', 'terms', 'api-docs'].includes(currentPage) && (
              <ResourcesPage type={currentPage} onBack={() => handleNavigate('home')} />
            )}
          </main>
        </div>
      </div>
    </LocationContext.Provider>
  );
}
