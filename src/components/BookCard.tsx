import { useState, useEffect } from 'react';
import { MapPin, ArrowLeftRight, BookOpen, Loader2, CheckCircle2, X } from 'lucide-react';
import { useExchangeActions } from '../hooks/useExchangeActions';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import BookCover from './BookCover';
import CustomDropdown from './CustomDropdown';

interface BookCardProps {
  book: {
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
  };
  onRequestExchange?: (bookId: string) => void;
  onViewDetails?: (bookId: string) => void;
  compact?: boolean;
}

const CONDITION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  like_new: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'Like New' },
  good: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Good' },
  fair: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', label: 'Fair' },
  worn: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Worn' },
};

export default function BookCard({ book, onRequestExchange, onViewDetails, compact }: BookCardProps) {
  const condition = CONDITION_STYLES[book.condition] || CONDITION_STYLES.good;
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'fetching_books' | 'sending' | 'success' | 'error'>('idle');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [myBooks, setMyBooks] = useState<any[]>([]);
  const [selectedMyBookId, setSelectedMyBookId] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setCurrentUser);
    return () => unsubscribe();
  }, []);

  const { sendExchangeRequest } = useExchangeActions({ currentUser });

  const handleExchangeClick = async () => {
    if (!currentUser) return;
    
    setRequestStatus('fetching_books');
    try {
      const q = query(collection(db, 'books'), where('ownerId', '==', currentUser.uid));
      const snap = await getDocs(q);
      const books = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyBooks(books);
      if (books.length > 0) setSelectedMyBookId(books[0].id);
      setIsModalOpen(true);
      setRequestStatus('idle');
    } catch (err) {
      console.error(err);
      setRequestStatus('error');
      setTimeout(() => setRequestStatus('idle'), 2000);
    }
  };

  const submitExchange = async () => {
    if (!selectedMyBookId) return;

    const bookForHook = {
      id: book.id,
      title: book.title,
      author: book.author,
      ownerId: book.ownerId || book.owner?.avatar || '',
      ownerName: book.ownerName || book.owner?.name || 'Unknown',
    };

    const offeredBook = myBooks.find(b => b.id === selectedMyBookId);
    if (!offeredBook) return;

    if (!bookForHook.ownerId) {
      // Mock data fallback
      setRequestStatus('sending');
      setIsModalOpen(false);
      setTimeout(() => {
        setRequestStatus('success');
        onRequestExchange?.(book.id);
      }, 1000);
      return;
    }

    setRequestStatus('sending');
    const result = await sendExchangeRequest(bookForHook, offeredBook.id, offeredBook.title);
    setIsModalOpen(false);
    if (result === 'success' || result === 'already_sent') {
      setRequestStatus('success');
      onRequestExchange?.(book.id);
    } else {
      setRequestStatus('error');
      setTimeout(() => setRequestStatus('idle'), 2000);
    }
  };

  return (
    <>
      <div className="nm-flat hover:scale-[1.02] transition-all flex flex-col overflow-hidden group p-2">
        {/* Cover */}
        <div className="relative flex items-center justify-center h-[180px] sm:h-[320px] nm-inset group-hover:nm-flat transition-all p-3 sm:p-6 overflow-hidden rounded-xl">
          <div className="w-full h-full rounded-lg overflow-hidden transition-all">
            <BookCover
              isbn={book.isbn}
              googleId={book.googleId}
              initialCover={book.cover}
              alt={book.title}
              className="w-full h-full object-contain"
            />
          </div>
          {book.isMutualMatch && (
            <div className="absolute top-4 right-4 bg-[var(--c-emerald)] text-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider flex items-center gap-2 rounded-full shadow-lg">
              <ArrowLeftRight size={12} /> Match
            </div>
          )}
          <div
            className={`absolute bottom-4 left-4 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-full shadow-md ${condition.bg} ${condition.text}`}
          >
            {condition.label}
          </div>
        </div>

        {/* Info */}
        <div className="p-3 sm:p-5 flex-1 flex flex-col gap-2 sm:gap-4">
          <div>
            <h3 className="font-bold text-[var(--c-emerald)] leading-tight line-clamp-1 mb-1 uppercase tracking-tight text-[11px] sm:text-base">
              {book.title}
            </h3>
            <p className="text-[10px] sm:text-sm font-semibold text-[var(--c-ink)] uppercase opacity-80 truncate">{book.author}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="nm-inset text-[var(--c-emerald)] px-4 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] rounded-full">
              {book.genre}
            </span>
          </div>

          {/* Removed distance and wants from here, now in Details modal */}

          <div className="mt-auto pt-3 sm:pt-5 flex gap-3 sm:gap-4">
            <button
              onClick={() => onViewDetails?.(book.id)}
              className="flex-1 nm-flat py-2 sm:py-3 text-[10px] sm:text-xs font-bold uppercase text-[var(--c-ink)] hover:nm-inset transition-all rounded-xl"
            >
              Details
            </button>
            <button
              onClick={handleExchangeClick}
              disabled={requestStatus === 'sending' || requestStatus === 'success' || requestStatus === 'fetching_books'}
              className={`flex-1 py-2 sm:py-3 text-[10px] sm:text-xs font-bold uppercase transition-all rounded-xl flex items-center justify-center gap-2 ${
                requestStatus === 'success'
                  ? 'nm-inset text-emerald-600'
                  : requestStatus === 'error'
                  ? 'bg-red-500 text-white shadow-lg'
                  : 'nm-flat text-[var(--c-emerald)] hover:nm-inset transition-all active:scale-95 shadow-2xl'
              } ${(requestStatus === 'sending' || requestStatus === 'fetching_books') ? 'opacity-70 cursor-wait' : ''}`}
            >
              {requestStatus === 'fetching_books' || requestStatus === 'sending' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : requestStatus === 'success' ? (
                <CheckCircle2 size={14} />
              ) : (
                'SWAP'
              )}
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="nm-flat w-full max-w-md animate-fade-up relative z-50 p-2 overflow-visible">
            <div className="px-6 py-5 nm-inset mb-4 flex items-center justify-between rounded-2xl">
              <h3 className="font-bold text-[var(--c-emerald)] uppercase text-lg tracking-tight">Offer Exchange</h3>
              <button onClick={() => setIsModalOpen(false)} className="nm-flat p-2 hover:nm-inset transition-all rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-8">
              <div>
                <label className="block text-xs font-bold text-[var(--c-ink)] uppercase opacity-80 mb-4 ml-2">Select a book to offer</label>
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
                  <div className="nm-inset p-5 text-red-500 font-bold text-xs uppercase rounded-2xl border-l-4 border-red-500">
                    Your library is empty! Add books first.
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-2">
                <button onClick={() => setIsModalOpen(false)} className="flex-1 nm-flat text-[var(--c-ink)] py-4 text-xs font-bold uppercase rounded-2xl hover:nm-inset transition-all">
                  Cancel
                </button>
                <button
                  onClick={submitExchange}
                  disabled={!selectedMyBookId}
                  className="flex-1 nm-flat text-[var(--c-emerald)] py-4 text-xs font-bold uppercase rounded-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-70"
                >
                  Send Offer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


