import { Home, User, ArrowLeftRight, MessageSquare, BookOpen, Trophy, LogOut, ChevronRight, BookMarked, Plus } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  user?: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  } | null;
  onClose?: () => void;
}

const NAV_ITEMS = [
  { icon: Home, label: 'Home', page: 'home' },
  { icon: User, label: 'Profile', page: 'profile' },
  { icon: ArrowLeftRight, label: 'Exchanges', page: 'exchanges' },
  { icon: MessageSquare, label: 'Messages', page: 'messages' },
  { icon: BookOpen, label: 'Read EPUBs', page: 'epub-library' },
  { icon: Trophy, label: 'Leaderboard', page: 'leaderboard' },
];

export default function Sidebar({ currentPage, onNavigate, onLogout, isOpen, user, onClose }: SidebarProps) {
  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Reader';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'R';

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-[80]
          lg:top-20 lg:h-[calc(100vh-6rem)]
          lg:m-4
          flex flex-col
          bg-[var(--c-bg)] 
          transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0 w-[280px] sm:w-80 lg:w-64' : '-translate-x-full lg:translate-x-0 w-0 lg:w-[72px]'}
          overflow-hidden
          nm-flat
        `}
      >
        <div className={`p-4 mb-2 ${isOpen ? '' : 'lg:flex lg:justify-center'}`}>
          {isOpen ? (
            <div className="flex items-center gap-3 p-2 nm-inset">
              <div className="w-10 h-10 rounded-full bg-white overflow-hidden nm-flat flex-shrink-0">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-[var(--c-emerald)] text-[var(--c-mint)] flex items-center justify-center font-bold text-sm">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm text-[var(--c-ink)] truncate uppercase">{displayName}</div>
                <div className="text-xs text-[var(--c-ink)] mt-0.5 font-medium opacity-80">Member</div>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-white overflow-hidden nm-flat">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-[var(--c-emerald)] text-white flex items-center justify-center font-bold text-sm">
                  {initials}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-3">
          {NAV_ITEMS.map(({ icon: Icon, label, page }) => {
            const isActive = currentPage === page || (page === 'epub-library' && currentPage === 'epubs');
            return (
              <button
                key={page}
                onClick={() => {
                  onNavigate(page);
                  if (window.innerWidth < 1024) onClose?.();
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 group
                  ${isOpen ? '' : 'lg:justify-center'}
                  active:scale-95
                  ${isActive
                    ? 'nm-inset text-[var(--c-emerald)] font-bold'
                    : 'text-[var(--c-ink)] hover:nm-flat hover:scale-[1.05] opacity-70 hover:opacity-100'
                  }
                `}
                title={!isOpen ? label : undefined}
              >
                <Icon size={20} className={`flex-shrink-0 ${isActive ? 'text-[var(--c-emerald)]' : 'text-[var(--c-ink)]'}`} />
                {isOpen && (
                  <>
                    <span className="text-sm flex-1 text-left uppercase tracking-tight">{label}</span>
                    {isActive && <ChevronRight size={16} className="text-[var(--c-emerald)]" />}
                  </>
                )}
              </button>
            );
          })}
          
          {/* Add Book Button */}
          <button
            onClick={() => {
              onNavigate('profile-add-book');
              if (window.innerWidth < 1024) onClose?.();
            }}
            className={`
              w-full flex items-center gap-3 px-4 py-3 mt-2 transition-all duration-200 group
              ${isOpen ? '' : 'lg:justify-center'}
              active:scale-95
              text-[var(--c-emerald)] font-bold nm-flat hover:nm-inset
            `}
            title={!isOpen ? 'Add Book' : undefined}
          >
            <Plus size={20} className="flex-shrink-0 text-[var(--c-emerald)]" />
            {isOpen && (
              <span className="text-sm flex-1 text-left uppercase tracking-tight">Add Book</span>
            )}
          </button>
        </nav>

        {isOpen && (
          <div className="p-4 mx-3 mb-4 nm-inset">
            <div className="flex items-center gap-2 text-[var(--c-emerald)] mb-2">
              <BookMarked size={16} />
              <span className="text-xs font-bold uppercase">Your Shelf</span>
            </div>
            <div className="text-[10px] text-[var(--c-ink)] font-medium opacity-70 leading-tight">Live account data is shown here now, not demo seed data.</div>
          </div>
        )}

        <div className="p-3 mt-auto">
          <button
            onClick={onLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 text-[var(--c-ink)] nm-flat hover:nm-inset active:scale-95 transition-all group ${isOpen ? '' : 'lg:justify-center'}`}
            title={!isOpen ? 'Logout' : undefined}
          >
            <LogOut size={20} className="flex-shrink-0 text-red-500" />
            {isOpen && <span className="text-sm font-bold uppercase">Log out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
