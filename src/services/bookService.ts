import { normalizeBookCover } from '../lib/bookCovers';

export interface BookResult {
  id: string;
  title: string;
  author: string;
  genre: string;
  cover?: string;
  isbn?: string;
  googleId?: string;
  source: 'google' | 'openlibrary' | 'gutendex' | 'internetarchive';
  description?: string;
  language?: string;
  pageCount?: number;
  epubId?: string;
  iaId?: string;
}

export interface SearchTerms {
  raw: string;
  normalized: string;
  isbnMode: boolean;
  isbn: string | null;
  author: string;
  titleOnly: string;
  words: string[];
}

const normalizeLoose = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const isLikelyIsbn = (value: string) => /^[\dXx-\s]{10,17}$/.test(value.trim());

export const getSearchTerms = (rawQuery: string): SearchTerms => {
  const trimmed = rawQuery.trim();
  const isbnMode = isLikelyIsbn(trimmed);
  const parts = trimmed.split(/\s+by\s+/i).map((part) => part.trim()).filter(Boolean);
  const titlePart = parts[0] || trimmed;
  const authorPart = parts[1] || '';

  return {
    raw: trimmed,
    normalized: normalizeLoose(trimmed),
    isbnMode,
    isbn: isbnMode ? trimmed.replace(/[-\s]/g, '') : null,
    author: authorPart,
    titleOnly: titlePart,
    words: normalizeLoose(trimmed).split(/\s+/).filter(w => w.length > 2)
  };
};

export const searchGoogleBooks = async (terms: SearchTerms, signal?: AbortSignal): Promise<BookResult[]> => {
  const googleBase = 'https://www.googleapis.com/books/v1/volumes';
  const googleQueries = terms.isbnMode
    ? [`isbn:${terms.isbn}`]
    : terms.author
      ? [`intitle:${terms.title} inauthor:${terms.author}`, `inauthor:${terms.author}`, `intitle:${terms.title}`]
      : [terms.raw, `inauthor:${terms.raw}`, `intitle:${terms.raw}`];

  try {
    const promises = googleQueries.map(q =>
      fetch(`${googleBase}?q=${encodeURIComponent(q)}&maxResults=20&printType=books&orderBy=relevance&langRestrict=en`, { signal })
        .then(res => res.json())
        .catch(() => ({ items: [] }))
    );

    const results = await Promise.all(promises);
    const items = results.flatMap((data: any) => data.items ?? []);

    return items.map((item: any): BookResult => {
      const identifiers = item.volumeInfo?.industryIdentifiers ?? [];
      const isbn13 = identifiers.find((id: any) => id.type === 'ISBN_13')?.identifier;
      const isbn10 = identifiers.find((id: any) => id.type === 'ISBN_10')?.identifier;
      const isbn = isbn13 || isbn10;
      
      const googleCover = 
        item.volumeInfo?.imageLinks?.extraLarge ||
        item.volumeInfo?.imageLinks?.large ||
        item.volumeInfo?.imageLinks?.medium ||
        item.volumeInfo?.imageLinks?.thumbnail;

      // STRICT: If Google only provides a smallThumbnail or nothing, we reject it
      // Standard thumbnails are often the "image not available" placeholders
      const cover = googleCover ? normalizeBookCover(googleCover) : undefined;

      return {
        id: item.id,
        title: item.volumeInfo?.title || 'Unknown Title',
        author: item.volumeInfo?.authors?.[0] || 'Unknown Author',
        genre: item.volumeInfo?.categories?.[0] || 'Fiction',
        cover,
        isbn,
        googleId: item.id,
        source: 'google',
        description: item.volumeInfo?.description,
        language: item.volumeInfo?.language,
        pageCount: item.volumeInfo?.pageCount,
      };
    });
  } catch (err) {
    console.error('Google Books search failed:', err);
    return [];
  }
};

export const searchOpenLibrary = async (terms: SearchTerms, signal?: AbortSignal): Promise<BookResult[]> => {
  const url = terms.isbnMode
    ? `https://openlibrary.org/search.json?isbn=${encodeURIComponent(terms.isbn)}&limit=20`
    : terms.author
      ? `https://openlibrary.org/search.json?title=${encodeURIComponent(terms.title)}&author=${encodeURIComponent(terms.author)}&limit=20`
      : `https://openlibrary.org/search.json?q=${encodeURIComponent(terms.raw)}&limit=20`;

  try {
    const res = await fetch(url, { signal });
    const data = await res.json();

    return (data.docs ?? []).map((doc: any): BookResult => {
      const isbn = doc.isbn?.[0];
      let cover = undefined;
      
      if (doc.cover_i) {
        cover = normalizeBookCover(`https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg?default=false`);
      }

      // Check for EPUB availability
      const epubId = doc.ia?.[0] || doc.ia_collection_s?.[0];

      return {
        id: doc.key.split('/').pop() || Math.random().toString(),
        title: doc.title || 'Unknown Title',
        author: doc.author_name?.[0] || 'Unknown Author',
        genre: doc.subject?.[0] || 'General',
        cover: normalizeBookCover(cover),
        isbn,
        source: 'openlibrary',
        language: doc.language?.[0],
        epubId: epubId,
      };
    });
  } catch (err) {
    console.error('Open Library search failed:', err);
    return [];
  }
};

export const searchInternetArchive = async (terms: SearchTerms, signal?: AbortSignal): Promise<BookResult[]> => {
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(terms.raw)}%20AND%20mediatype:(texts)&fl[]=identifier,title,creator,subject,language,description&rows=20&output=json`;

  try {
    const res = await fetch(url, { signal });
    const data = await res.json();

    return (data.response?.docs ?? []).map((doc: any): BookResult => {
      return {
        id: doc.identifier,
        title: doc.title || 'Unknown Title',
        author: doc.creator?.[0] || doc.creator || 'Unknown Author',
        genre: doc.subject?.[0] || 'Archive',
        cover: `https://archive.org/services/img/${doc.identifier}`,
        source: 'internetarchive',
        language: doc.language?.[0],
        description: doc.description,
        epubId: doc.identifier,
        iaId: doc.identifier
      };
    });
  } catch (err) {
    console.error('Internet Archive search failed:', err);
    return [];
  }
};

export const searchGutendex = async (terms: SearchTerms, signal?: AbortSignal): Promise<BookResult[]> => {
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(terms.raw)}`;

  try {
    const res = await fetch(url, { signal });
    const data = await res.json();

    return (data.results ?? []).map((item: any): BookResult => {
      return {
        id: `gutenberg-${item.id}`,
        title: item.title || 'Unknown Title',
        author: item.authors?.[0]?.name || 'Unknown Author',
        genre: item.subjects?.[0] || 'Public Domain',
        cover: item.formats?.['image/jpeg'],
        source: 'gutendex',
        language: item.languages?.[0],
      };
    });
  } catch (err) {
    console.error('Gutendex search failed:', err);
    return [];
  }
};

export const scoreResult = (result: BookResult, terms: SearchTerms) => {
  const title = normalizeLoose(result.title);
  const author = normalizeLoose(result.author);
  let score = 0;

  // JUNK FILTER - High quality books only
  const junkKeywords = [
    'coloring book', 'notebook', 'journal', 'workbook', 'study guide', 
    'summary of', 'unofficial', 'blank book', 'sketchbook', 'box set', 
    'collection', 'bundle', 'complete set', 'set of', 'test prep', 'exam prep',
    'coloring', 'calendar', 'diary', 'blank'
  ];
  if (junkKeywords.some(kw => title.includes(kw))) score -= 800;
  
  // Penalize "Unknown" data heavily
  if (author.includes('unknown author') || author.length < 3) score -= 600;
  if (title.length < 3) score -= 600;

  // ISBN MATCH - Absolute priority
  if (terms.isbnMode && result.isbn?.replace(/[-\s]/g, '') === terms.isbn) {
    score += 2000;
  }
  
  // EXACT MATCHES (Mimic Google Search behavior)
  if (title === terms.normalized) score += 1000; // Exact full query match
  if (terms.titleOnly && title === normalizeLoose(terms.titleOnly)) score += 800;
  if (terms.author && author === normalizeLoose(terms.author)) score += 600;

  // POSITION & PARTIAL MATCHES
  if (title.startsWith(terms.normalized)) score += 300;
  if (title.includes(terms.normalized)) score += 150;

  // WORD FREQUENCY MATCH
  const matchesEveryWord = terms.words.every(word => title.includes(word) || author.includes(word));
  if (matchesEveryWord && terms.words.length > 0) score += 400;

  // AUTHOR MATCH
  if (terms.author && author.includes(normalizeLoose(terms.author))) score += 200;
  if (author.includes(terms.normalized)) score += 100;

  // SOURCE RANKING (Google Books is the Gold Standard for relevance)
  if (result.source === 'google') score += 100;
  if (result.source === 'openlibrary') score += 50;

  // COVER QUALITY CHECK
  if (result.cover) {
    score += 50;
    // Penalize known generic placeholders
    if (result.cover.includes('placeholder') || result.cover.includes('no_image')) score -= 1000;
  } else {
    score -= 2000; // No cover = No display
  }

  // RELEVANCE GUARD - Hard drop for zero word matches
  const anyWordMatches = terms.words.some(word => title.includes(word) || author.includes(word));
  if (!anyWordMatches && terms.words.length > 0 && !terms.isbnMode) score -= 1000;

  return score;
};

export const searchAll = async (query: string, signal?: AbortSignal): Promise<BookResult[]> => {
  const terms = getSearchTerms(query);
  if (!terms.normalized && !terms.isbnMode) return [];

  const [google, ol, guten, ia] = await Promise.all([
    searchGoogleBooks(terms, signal),
    searchOpenLibrary(terms, signal),
    searchGutendex(terms, signal),
    searchInternetArchive(terms, signal),
  ]);

  const allResults = [...google, ...ol, ...guten, ...ia];
  const seen = new Set<string>();
  const uniqueResults: BookResult[] = [];

  for (const res of allResults) {
    const key = res.isbn || `${normalizeLoose(res.title)}-${normalizeLoose(res.author)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(res);
    }
  }

  return uniqueResults
    .map(res => ({ res, score: scoreResult(res, terms) }))
    .filter(({ score, res }) => {
      // Must have a cover
      if (!res.cover) return false;
      
      // Keep results that have at least some relevance
      if (score < -500) return false;
      
      return true;
    })
    .sort((a, b) => b.score - a.score)
    .map(({ res }) => res);
};
