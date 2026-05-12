import React, { useState, useEffect } from 'react';
import { BookOpen, Loader2 } from 'lucide-react';
import { getCoverFallbacks, normalizeBookCover } from '../lib/bookCovers';

interface BookCoverProps {
  isbn?: string;
  googleId?: string;
  initialCover?: string;
  alt: string;
  className?: string;
  onCoverError?: () => void;
}

export default function BookCover({ isbn, googleId, initialCover, alt, className, onCoverError }: BookCoverProps) {
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [triedDeepSearch, setTriedDeepSearch] = useState(false);
  const currentSrc = fallbacks[currentIndex];

  useEffect(() => {
    const list = getCoverFallbacks(isbn, googleId, initialCover);
    setFallbacks(list);
    setCurrentIndex(0);
    setError(false);
    setLoading(true);
    setTriedDeepSearch(false);
  }, [isbn, googleId, initialCover]);

  useEffect(() => {
    if (!currentSrc || error || !loading) return;

    const timeout = window.setTimeout(() => {
      void handleNextFallback();
    }, 4500);

    return () => window.clearTimeout(timeout);
  }, [currentSrc, error, loading]);

  const handleNextFallback = async () => {
    if (currentIndex < fallbacks.length - 1) {
      setLoading(true);
      setCurrentIndex(prev => prev + 1);
    } else if (!triedDeepSearch && alt) {
      setTriedDeepSearch(true);
      setLoading(true);
      try {
        const query = encodeURIComponent(alt);
        const [googleRes, openLibraryRes] = await Promise.all([
          fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5&printType=books`).then((res) => res.json()).catch(() => ({ items: [] })),
          fetch(`https://openlibrary.org/search.json?q=${query}&limit=5`).then((res) => res.json()).catch(() => ({ docs: [] })),
        ]);

        const candidates: string[] = [];

        (googleRes.items ?? []).forEach((item: any) => {
          const links = item.volumeInfo?.imageLinks;
          const googleCover =
            links?.extraLarge ||
            links?.large ||
            links?.medium ||
            links?.thumbnail ||
            links?.smallThumbnail;

          if (googleCover) {
            candidates.push(normalizeBookCover(googleCover));
          }

          if (item.id) {
            candidates.push(normalizeBookCover(`https://books.google.com/books/content?id=${item.id}&printsec=frontcover&img=1&zoom=3`));
          }
        });

        (openLibraryRes.docs ?? []).forEach((doc: any) => {
          if (doc.cover_i) {
            candidates.push(normalizeBookCover(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`));
          }
          if (doc.isbn?.[0]) {
            candidates.push(normalizeBookCover(`https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg?default=false`));
          }
        });

        const nextCandidates = Array.from(new Set(candidates)).filter(Boolean);
        if (nextCandidates.length > 0) {
          setFallbacks((prev) => [...prev, ...nextCandidates]);
          setCurrentIndex((prev) => prev + 1);
          return;
        }
      } catch (err) {
        console.error('Deep search failed:', err);
      }
      
      setError(true);
      setLoading(false);
      onCoverError?.();
    } else {
      setError(true);
      setLoading(false);
      onCoverError?.();
    }
  };

  if (error || fallbacks.length === 0) {
    if (onCoverError) {
      onCoverError();
    }
    
    if (className?.includes('no-procedural')) {
      return <div className={`bg-gray-50 flex items-center justify-center ${className}`}>
        <BookOpen size={20} className="text-gray-200" />
      </div>;
    }

    // Procedural Neumorphic Cover
    const colors = ['bg-emerald-50', 'bg-blue-50', 'bg-teal-50', 'bg-indigo-50'];
    const textColors = ['text-emerald-600', 'text-blue-600', 'text-teal-600', 'text-indigo-600'];
    const colorIndex = (alt.length + (isbn?.length || 0)) % colors.length;
    const bgColor = colors[colorIndex];
    const textColor = textColors[colorIndex];

    return (
      <div className={`flex flex-col items-center justify-between p-6 text-center nm-flat rounded-2xl ${bgColor} ${className}`}>
        <div className="w-full">
          <div className={`text-[8px] font-black uppercase tracking-[0.3em] mb-4 opacity-70 ${textColor}`}>SYSTEM REPOSITORY</div>
          <h3 className={`font-black uppercase tracking-tight text-[11px] leading-tight line-clamp-4 mb-2 ${textColor}`}>
            {alt}
          </h3>
        </div>
        <div className="w-full nm-inset rounded-xl p-3 bg-white bg-opacity-70">
          <BookOpen size={24} className={`mx-auto mb-2 opacity-30 ${textColor}`} />
          <div className={`text-[7px] font-black uppercase tracking-[0.2em] opacity-70 ${textColor}`}>
            ARCHIVE ID: {isbn?.substring(0, 8) || 'GENERIC'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-transparent rounded-xl ${className}`}>
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 z-10 transition-opacity duration-500">
          <Loader2 size={24} className="animate-spin text-[var(--c-emerald)] opacity-20" />
        </div>
      )}
      <img
        key={currentSrc}
        src={fallbacks[currentIndex]}
        alt={alt}
        className={`w-full h-full object-contain transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
        onLoad={(e) => {
          if ((e.target as HTMLImageElement).naturalWidth <= 1) {
            void handleNextFallback();
          } else {
            setLoading(false);
          }
        }}
        onError={() => {
          void handleNextFallback();
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
