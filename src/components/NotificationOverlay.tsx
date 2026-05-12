import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, limit, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Bell, Check, MapPin, Repeat, Star, MessageCircle, Navigation, X } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  icon: string;
  read: boolean;
  createdAt: Timestamp;
}

const ICON_MAP: Record<string, React.ElementType> = {
  repeat: Repeat,
  check: Check,
  'check-circle': Check,
  'map-pin': MapPin,
  star: Star,
  'message-circle': MessageCircle,
  navigation: Navigation,
  bell: Bell,
  x: X,
};

export default function NotificationOverlay() {
  const [toasts, setToasts] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<number>(Date.now());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
      setLastSeen(Date.now());
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifs: Notification[] = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const createdAt = data.createdAt as Timestamp;
          if (createdAt && createdAt.toMillis && createdAt.toMillis() > lastSeen) {
            newNotifs.push({
              id: change.doc.id,
              title: data.title,
              body: data.body,
              type: data.type,
              icon: data.icon || 'bell',
              read: false,
              createdAt,
            });
          }
        }
      });

      if (newNotifs.length > 0) {
        setToasts((prev) => [...newNotifs, ...prev].slice(0, 3));
        newNotifs.forEach((notif) => {
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== notif.id));
          }, 5000);
        });
      }
    });

    return () => unsubscribe();
  }, [userId, lastSeen]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-8 right-8 z-[9999] space-y-6 pointer-events-none" style={{ maxWidth: '400px' }}>
      {toasts.map((toast, index) => {
        const IconComp = ICON_MAP[toast.icon] || Bell;
        return (
          <div
            key={toast.id}
            className="nm-flat bg-white p-6 rounded-[2.5rem] flex items-start gap-5 pointer-events-auto animate-fade-left relative overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--c-emerald)] opacity-5 blur-2xl rounded-full -mr-12 -mt-12"></div>
            
            <div className="w-14 h-14 nm-inset rounded-2xl flex items-center justify-center flex-shrink-0 text-[var(--c-emerald)]">
              <IconComp size={24} />
            </div>
            
            <div className="flex-1 min-w-0 pt-1">
              <div className="font-black text-[var(--c-ink)] text-xs uppercase tracking-tight leading-tight">
                {toast.title}
              </div>
              <div className="text-[10px] font-bold text-[var(--c-ink)] opacity-70 mt-2 line-clamp-2 uppercase tracking-wide">
                {toast.body}
              </div>
              <div className="h-1.5 nm-inset rounded-full mt-4 overflow-hidden p-0.5 bg-gray-50">
                <div
                  className="h-full bg-[var(--c-emerald)] rounded-full transition-all shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                  style={{
                    animation: 'shrink 5s linear forwards',
                  }}
                />
              </div>
            </div>
            
            <button
              onClick={() => dismissToast(toast.id)}
              className="w-8 h-8 nm-flat rounded-full flex items-center justify-center hover:nm-inset transition-all flex-shrink-0"
            >
              <X size={14} className="text-[var(--c-ink)] opacity-70" />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
