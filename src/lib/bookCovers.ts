/**
 * Centralized utility to fetch and normalize book covers from multiple sources.
 */

export const BOOK_COVER_SOURCES = {
  OPEN_LIBRARY: (isbn: string) => `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
  GOOGLE_BOOKS: (id: string, zoom = 1) => `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=${zoom}`,
  GOOGLE_PUBLISHER: (id: string) => `https://books.google.com/books/publisher/content/images/frontcover/${id}?fife=w400-h600`,
  OPEN_LIBRARY_ID: (id: string) => `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`,
  PROXY: (url: string) => `https://images.weserv.nl/?url=${encodeURIComponent(url.replace('https://', '').replace('http://', ''))}&n=-1`
};

/**
 * Returns an array of potential cover URLs for a given book, in order of preference.
 */
export const getCoverFallbacks = (isbn?: string, googleId?: string, currentCover?: string): string[] => {
  const fallbacks: string[] = [];

  // 1. If we already have a cover URL (e.g. from Google API), keep it as high priority
  if (currentCover && currentCover.trim()) {
    fallbacks.push(normalizeBookCover(currentCover));
  }

  // 2. Google Books variants (ordered by reliability/quality)
  if (googleId) {
    fallbacks.push(BOOK_COVER_SOURCES.GOOGLE_BOOKS(googleId, 2));
    fallbacks.push(BOOK_COVER_SOURCES.GOOGLE_BOOKS(googleId, 1));
    fallbacks.push(BOOK_COVER_SOURCES.GOOGLE_PUBLISHER(googleId));
  }

  if (isbn) {
    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    // 3. Open Library Large
    fallbacks.push(BOOK_COVER_SOURCES.OPEN_LIBRARY(cleanIsbn));
  }

  // 4. Try proxied versions of the most likely candidates as a last resort
  const candidates = [...fallbacks];
  candidates.forEach(url => {
    if (url.includes('google.com') || url.includes('openlibrary.org')) {
      fallbacks.push(BOOK_COVER_SOURCES.PROXY(url));
    }
  });

  // Deduplicate and filter out empty strings
  return Array.from(new Set(fallbacks)).filter(url => url && url.length > 10);
};

/**
 * Normalizes a single cover URL for display.
 */
export const normalizeBookCover = (cover: unknown): string => {
  if (typeof cover !== 'string' || !cover.trim()) return '';
  
  let normalized = cover
    .replace('http://', 'https://')
    .replace('&edge=curl', '')
    .replace('zoom=5', 'zoom=1'); // Try to get higher quality from Google

  if (normalized.includes('books.google.com/books/content')) {
    // Keep original zoom or default to 1, handled by fallbacks
  }

  // If it's an Open Library URL, ensure it's Large
  if (normalized.includes('covers.openlibrary.org') && normalized.includes('-S.jpg')) {
    normalized = normalized.replace('-S.jpg', '-L.jpg');
  }
  if (normalized.includes('covers.openlibrary.org') && normalized.includes('-M.jpg')) {
    normalized = normalized.replace('-M.jpg', '-L.jpg');
  }

  return normalized;
};
