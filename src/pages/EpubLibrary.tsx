import { useState, useEffect } from 'react';
import { Upload, BookOpen, Download, Search, X, Loader2, FileUp, CheckCircle2, Trash2 } from 'lucide-react';
import { collection, doc, getDocs, query, orderBy, serverTimestamp, setDoc, deleteDoc, updateDoc, increment, where, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable, getBlob } from 'firebase/storage';
import { app, db, storage, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { downloadEpubFromFirestoreChunks, uploadEpubToFirestoreChunks, getEpubBlobUrlFromFirestore, deleteEpubFromFirestoreChunks } from '../lib/epubFiles';
import { searchAll, BookResult } from '../services/bookService';
import CustomDropdown from '../components/CustomDropdown';

interface EpubLibraryProps {
  onRead?: (data: string | ArrayBuffer, title: string) => void;
}


interface Epub {
  id: string;
  title: string;
  author: string;
  genre: string;
  description: string;
  fileUrl?: string;
  fileName: string;
  uploadedBy: string;
  uploaderName: string;
  downloads: number;
  createdAt: any;
  storageMode?: 'firebase-storage' | 'firestore';
  mimeType?: string;
}

export default function EpubLibrary({ onRead }: EpubLibraryProps) {
  const [epubs, setEpubs] = useState<Epub[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [onlineResults, setOnlineResults] = useState<BookResult[]>([]);
  const [searchMode, setSearchMode] = useState<'local' | 'online'>('local');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    author: '',
    genre: 'Fiction',
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const autofillFromFile = async (file: File) => {
    setIsAutofilling(true);

    try {
      const baseName = file.name.replace(/\.epub$/i, '');
      const normalizedName = baseName
        .replace(/[_]+/g, ' ')
        .replace(/[.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const parts = normalizedName.split(/\s+-\s+/);
      const guessedTitle = parts.length >= 2 ? parts[0].trim() : normalizedName;
      const alternateGuessedTitle = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : normalizedName;
      const guessedAuthor = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : '';
      const alternateGuessedAuthor = parts.length >= 2 ? parts[0].trim() : '';

      setFormData((current) => ({
        ...current,
        title: guessedTitle || current.title,
        author: guessedAuthor || current.author,
      }));

      // 1. Check Cache First
      const cacheQuery = query(collection(db, 'book_cache'), where('searchQuery', '==', normalizedName));
      const cacheSnap = await getDocs(cacheQuery);
      
      if (!cacheSnap.empty) {
        const cacheData = cacheSnap.docs[0].data();
        setFormData((current) => ({
          ...current,
          title: cacheData.title || current.title,
          author: cacheData.author || current.author,
          genre: cacheData.genre || current.genre,
          description: cacheData.description || current.description,
        }));
        return;
      }

      const candidates = Array.from(new Set([
        normalizedName,
        guessedTitle,
        alternateGuessedTitle,
      ].filter(Boolean)));

      let googleMatch: any = null;
      let olMatch: any = null;

      for (const candidate of candidates) {
        const queryStr = encodeURIComponent(candidate);
        const googlePromise = fetch(`https://www.googleapis.com/books/v1/volumes?q=${queryStr}&maxResults=5&printType=books`)
          .then((res) => res.json())
          .catch(() => ({ items: [] }));
        const openLibraryPromise = fetch(`https://openlibrary.org/search.json?q=${queryStr}&limit=5`)
          .then((res) => res.json())
          .catch(() => ({ docs: [] }));

        const [googleData, openLibraryData] = await Promise.all([googlePromise, openLibraryPromise]);

        googleMatch = (googleData?.items ?? []).find((item: any) => {
          const title = item.volumeInfo?.title?.toLowerCase?.() ?? '';
          const author = item.volumeInfo?.authors?.[0]?.toLowerCase?.() ?? '';
          const candidateLower = candidate.toLowerCase();
          return candidateLower.includes(title) || title.includes(candidateLower) || candidateLower.includes(author);
        }) ?? googleData?.items?.[0] ?? googleMatch;

        olMatch = (openLibraryData?.docs ?? []).find((doc: any) => {
          const title = doc.title?.toLowerCase?.() ?? '';
          const author = doc.author_name?.[0]?.toLowerCase?.() ?? '';
          const candidateLower = candidate.toLowerCase();
          return candidateLower.includes(title) || title.includes(candidateLower) || candidateLower.includes(author);
        }) ?? openLibraryData?.docs?.[0] ?? olMatch;

        if (googleMatch?.volumeInfo?.title || olMatch?.title) {
          break;
        }
      }

      let matchData: any = null;

      if (googleMatch?.volumeInfo?.title) {
        matchData = {
          title: googleMatch.volumeInfo.title || guessedTitle,
          author: googleMatch.volumeInfo.authors?.[0] || guessedAuthor || alternateGuessedAuthor || '',
          genre: googleMatch.volumeInfo.categories?.[0] || 'Fiction',
          description: googleMatch.volumeInfo.description || '',
        };
      } else if (olMatch?.title) {
        matchData = {
          title: olMatch.title || guessedTitle,
          author: olMatch.author_name?.[0] || guessedAuthor || alternateGuessedAuthor || '',
          genre: olMatch.subject?.[0] || 'Fiction',
          description: '', 
        };
      }

      if (matchData) {
        setFormData((current) => ({
          ...current,
          ...matchData
        }));

        // 2. Save to Cache
        await addDoc(collection(db, 'book_cache'), {
          searchQuery: normalizedName,
          ...matchData,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error in autofillFromFile:", error);
    } finally {
      setIsAutofilling(false);
    }
  };

  const sanitizeFileName = (fileName: string) => {
    const ext = fileName.toLowerCase().endsWith('.epub') ? '.epub' : '';
    const nameWithoutExt = ext ? fileName.slice(0, -ext.length) : fileName;
    const cleaned = nameWithoutExt
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    return `${cleaned || `book-${Date.now()}`}${ext}`;
  };

  const withTimeout = async <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`Upload timed out after ${Math.round(ms / 1000)} seconds.`)), ms);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const getStorageCandidates = () => {
    const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined;
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
    const candidates = [storage];

    if (bucket?.endsWith('.firebasestorage.app') && projectId) {
      candidates.push(getStorage(app, `gs://${projectId}.appspot.com`));
    }

    return candidates;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    fetchEpubs();
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (searchMode === 'online' && searchQuery.trim().length >= 3) {
      const controller = new AbortController();
      const timeout = setTimeout(async () => {
        setIsSearchingOnline(true);
        try {
          const results = await searchAll(searchQuery, controller.signal);
          setOnlineResults(results);
        } catch (err) {
          console.error("Online search failed:", err);
        } finally {
          setIsSearchingOnline(false);
        }
      }, 500);
      return () => {
        controller.abort();
        clearTimeout(timeout);
      };
    } else {
      setOnlineResults([]);
    }
  }, [searchQuery, searchMode]);

  const fetchEpubs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'epubs'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedEpubs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Epub[];
      setEpubs(fetchedEpubs);
    } catch (error) {
      console.error("Error fetching epubs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        
        if (file.name.toLowerCase().endsWith('.epub')) {
          // Force modal open immediately before any complex processing
          setShowUploadModal(true);
          setSelectedFile(file);
          setUploadError(null);
          
          // Background processing shouldn't block the UI
          setTimeout(() => {
            void autofillFromFile(file);
          }, 0);
        } else {
          alert("Please select a valid EPUB file.");
          e.target.value = '';
        }
      }
    } catch (err) {
      console.error("Error in handleFileChange:", err);
      setShowUploadModal(true); // Fallback to show modal anyway
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setUploading(true);
    setUploadProgress(10);
    setUploadError(null);

    try {
      // Parallel Firestore Chunking for "Instant" feel
      const arrayBuffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const CHUNK_SIZE = 500 * 1024; // 500KB chunks (safe for Base64 in Firestore)
      const chunks: string[] = [];
      
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.slice(i, i + CHUNK_SIZE);
        let binary = '';
        const len = chunk.byteLength;
        for (let j = 0; j < len; j++) binary += String.fromCharCode(chunk[j]);
        chunks.push(window.btoa(binary));
      }

      setUploadProgress(30);
      const epubRef = doc(collection(db, 'epubs'));
      
      // Parallel upload all chunks for maximum speed
      await Promise.all(chunks.map((chunkData, index) => {
        const chunkRef = doc(db, 'epubs', epubRef.id, 'chunks', `chunk_${index}`);
        return setDoc(chunkRef, {
          data: chunkData,
          index: index,
          createdAt: serverTimestamp()
        });
      }));

      setUploadProgress(90);
      
      // Save metadata
      await setDoc(epubRef, {
        ...formData,
        fileName: selectedFile.name,
        uploadedBy: user.uid,
        uploaderName: user.displayName || user.email,
        downloads: 0,
        createdAt: serverTimestamp(),
        storageMode: 'firestore',
        mimeType: selectedFile.type || 'application/epub+zip',
        chunkCount: chunks.length,
        byteSize: bytes.length,
      });

      setUploadProgress(100);
      setTimeout(() => {
        setUploading(false);
        setShowUploadModal(false);
        setSelectedFile(null);
        setFormData({ title: '', author: '', genre: 'Fiction', description: '' });
        fetchEpubs();
      }, 500);
    } catch (error) {
      console.error("Error in handleUpload:", error);
      setUploading(false);
      setUploadError(error instanceof Error ? error.message : 'Upload could not start. Please verify Firebase Storage is enabled for this project.');
    }
  };

  const handleDownload = async (epub: Epub) => {
    if (epub.storageMode === 'firestore') {
      setDownloadingId(epub.id);
      try {
        await downloadEpubFromFirestoreChunks(db, epub.id, epub.fileName || epub.title, epub.mimeType);
      } catch (error) {
        console.error('Error downloading Firestore EPUB:', error);
        setUploadError(error instanceof Error ? error.message : 'Download failed.');
      } finally {
        setDownloadingId(null);
        // Increment download count
        await updateDoc(doc(db, 'epubs', epub.id), {
          downloads: increment(1)
        });
        fetchEpubs();
      }
      return;
    }

    if (epub.fileUrl) {
      window.open(epub.fileUrl, '_blank', 'noopener,noreferrer');
      await updateDoc(doc(db, 'epubs', epub.id), {
        downloads: increment(1)
      });
      fetchEpubs();
    }
  };

  const handleRead = async (epub: Epub) => {
    if (!onRead) return;
    
    setDownloadingId(epub.id);
    try {
      if (epub.storageMode === 'firestore') {
        const chunksSnap = await getDocs(query(collection(db, 'epubs', epub.id, 'chunks'), orderBy('index', 'asc')));
        if (chunksSnap.empty) throw new Error("No book data found.");
        
        const parts = chunksSnap.docs.map((entry) => {
          const data = entry.data() as { data?: string };
          // Base64 to Uint8Array to ArrayBuffer
          const binary = atob(data.data || '');
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          return bytes;
        });

        const blob = new Blob(parts, { type: epub.mimeType || 'application/epub+zip' });
        const buffer = await blob.arrayBuffer();
        onRead(buffer, epub.title);
      } else if (epub.fileUrl) {
        // Use Firebase SDK getBlob and convert to ArrayBuffer
        const storageRef = ref(storage, epub.fileUrl);
        const blob = await getBlob(storageRef);
        const buffer = await blob.arrayBuffer();
        onRead(buffer, epub.title);
        
        // Increment read/download count
        await updateDoc(doc(db, 'epubs', epub.id), {
          downloads: increment(1)
        });
        fetchEpubs();
      }
    } catch (error) {
      console.error('Error opening reader:', error);
      alert('Could not open the book reader. Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (epub: Epub) => {
    if (!user || user.uid !== epub.uploadedBy) return;
    
    const confirmDelete = window.confirm(`Are you sure you want to delete "${epub.title}"? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      // 1. Delete file/data from storage
      if (epub.storageMode === 'firestore') {
        await deleteEpubFromFirestoreChunks(db, epub.id);
      } else if (epub.fileUrl) {
        // Try to extract storage path or just use the known structure
        // Since we use epubs/[timestamp]_[filename], it's better to store the path or handle carefully
        // For now, if it's firebase-storage, we try to delete it
        try {
          const storageRef = ref(storage, epub.fileUrl);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.warn("Storage deletion failed, continuing with doc deletion:", storageErr);
        }
      }

      // 2. Delete document from Firestore
      await deleteDoc(doc(db, 'epubs', epub.id));
      
      // 3. Refresh list
      fetchEpubs();
    } catch (error) {
      console.error('Error deleting EPUB:', error);
      alert('Failed to delete book. Please try again.');
    }
  };

  const filteredEpubs = epubs.filter(epub => 
    epub.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    epub.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-2 sm:p-4 space-y-12 animate-fade-up">
      {/* Hero Section */}
      <div className="nm-flat rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 relative overflow-hidden bg-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--c-emerald)] opacity-5 blur-[80px] rounded-full -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <div className="inline-flex nm-inset px-4 py-1.5 rounded-full text-[8px] font-black text-[var(--c-emerald)] uppercase tracking-[0.2em] mb-6">
            DIGITAL COMMONS
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-[var(--c-ink)] uppercase tracking-tighter leading-none mb-4">
            Digital <span className="text-[var(--c-emerald)]">E-Library</span>
          </h1>
          <p className="text-sm md:text-lg font-medium text-[var(--c-ink)] opacity-80 max-w-xl uppercase tracking-widest leading-snug">
            Contribute to the collective knowledge base.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            {user && (
              <label className="nm-flat bg-[var(--c-bg)] text-[var(--c-emerald)] px-8 py-4 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-xl">
                <Upload size={20} className="text-[var(--c-emerald)]" /> Transmit EPUB
                <input 
                  type="file" 
                  accept=".epub"
                  className="hidden"
                  onChange={(e) => {
                    handleFileChange(e);
                    setShowUploadModal(true);
                  }}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
          <div className="flex-1 relative group">
            <Search size={18} className="absolute left-6 top-1/2 -translate-y-1/2 text-[var(--c-ink)] opacity-20 group-focus-within:text-[var(--c-emerald)] group-focus-within:opacity-100 transition-all" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SEARCH ARCHIVE..."
              className="w-full pl-14 pr-6 py-4 nm-inset rounded-2xl md:rounded-[2.5rem] bg-[var(--c-bg)] text-[var(--c-ink)] font-black text-sm md:text-lg focus:outline-none transition-all uppercase tracking-tight placeholder:opacity-20"
            />
          </div>
          <div className="nm-flat bg-white rounded-2xl md:rounded-[2.5rem] px-8 py-4 flex items-center justify-center gap-4 min-w-[180px]">
            <span className="text-3xl font-black text-[var(--c-emerald)] leading-none">{epubs.length}</span>
            <div className="flex flex-col">
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-[var(--c-ink)] opacity-70 leading-tight">
                ACTIVE
              </span>
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-[var(--c-ink)] opacity-70 leading-tight">
                RECORDS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* EPUB Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
          <div className="w-16 h-16 nm-inset rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[var(--c-emerald)] animate-spin" />
          </div>
          <p className="text-[10px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-[0.4em]">SYNCHRONIZING ARCHIVE...</p>
        </div>
      ) : filteredEpubs.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-8">
          {filteredEpubs.map((epub) => (
            <div 
              key={epub.id}
              className="nm-flat bg-white rounded-2xl md:rounded-[3rem] overflow-hidden flex flex-col group hover:scale-[1.02] transition-all"
            >
              <div className="bg-[var(--c-bg)] h-40 md:h-56 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 nm-inset opacity-70 rounded-xl md:rounded-[3rem] m-2 md:m-4"></div>
                <BookOpen className="w-12 h-12 md:w-20 md:h-20 text-[var(--c-emerald)] opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                <div className="absolute bottom-3 left-3 md:bottom-6 md:left-6 nm-flat bg-white px-2 md:px-4 py-1 md:py-2 rounded-lg md:rounded-xl text-[7px] md:text-[9px] font-black uppercase tracking-widest text-[var(--c-emerald)]">
                  {epub.genre}
                </div>
                {user?.uid === epub.uploadedBy && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(epub); }}
                    className="absolute top-2 right-2 md:top-6 md:right-6 nm-flat bg-white text-red-500 p-2 md:p-3 rounded-lg md:rounded-xl hover:bg-red-50 transition-all z-10"
                    title="Delete Book"
                  >
                    <Trash2 className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" />
                  </button>
                )}
              </div>
              <div className="p-4 md:p-8 flex flex-col flex-1 space-y-4">
                <div>
                  <h3 className="font-black text-[var(--c-ink)] text-xs md:text-lg uppercase tracking-tight leading-tight mb-1 line-clamp-2">
                    {epub.title}
                  </h3>
                  <p className="text-[8px] md:text-[10px] font-black text-[var(--c-ink)] opacity-30 uppercase tracking-widest">BY {epub.author}</p>
                </div>
                
                <div className="mt-auto pt-4 flex flex-col gap-2 md:gap-3">
                  <button
                    onClick={() => handleRead(epub)}
                    className="w-full nm-flat bg-[var(--c-bg)] text-[var(--c-emerald)] py-3 md:py-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 text-[9px] md:text-[11px] font-black uppercase tracking-widest md:tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl"
                  >
                    <BookOpen className="w-4 h-4 text-[var(--c-emerald)]" /> {downloadingId === epub.id ? '...' : 'READ VOLUME'}
                  </button>
                  <button
                    onClick={() => handleDownload(epub)}
                    className="w-full nm-flat bg-white text-[var(--c-ink)] py-3 md:py-4 rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 text-[9px] md:text-[11px] font-black uppercase tracking-widest md:tracking-[0.2em] hover:nm-inset transition-all"
                  >
                    <Download className="w-4 h-4" /> {downloadingId === epub.id ? '...' : 'GET EPUB'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="nm-flat bg-white rounded-[4rem] p-32 text-center">
          <div className="w-24 h-24 nm-inset rounded-[3rem] flex items-center justify-center mx-auto mb-10 text-[var(--c-emerald)] opacity-20">
            <BookOpen size={56} />
          </div>
          <h3 className="text-2xl font-black text-[var(--c-ink)] uppercase tracking-tight mb-4">ARCHIVE EMPTY</h3>
          <p className="text-[10px] font-black text-[var(--c-emerald)] uppercase tracking-[0.4em] opacity-80">CONTRIBUTE TO INITIALIZE LIBRARY</p>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4 md:p-6">
          <div className="nm-flat bg-white rounded-[2rem] md:rounded-[4rem] w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-fade-up">
            <div className="nm-flat bg-[var(--c-bg)] p-6 md:p-10 flex justify-between items-center text-[var(--c-emerald)] flex-shrink-0">
              <div className="space-y-2">
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter">DATA TRANSMISSION</h2>
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] opacity-80 text-[var(--c-emerald)]">EPUB UPLOAD PROTOCOL</p>
              </div>
              <button onClick={() => !uploading && setShowUploadModal(false)} className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl nm-flat flex items-center justify-center hover:nm-inset transition-all">
                <X size={20} className="md:hidden text-[var(--c-emerald)]" />
                <X size={32} className="hidden md:block text-[var(--c-emerald)]" />
              </button>
            </div>
            
            <form onSubmit={handleUpload} className="p-6 md:p-12 space-y-6 md:space-y-10 overflow-y-auto flex-1 scroll-smooth">
              {!uploading ? (
                <>
                  {uploadError && (
                    <div className="nm-inset bg-red-50 p-6 rounded-2xl text-red-600 text-[10px] font-black uppercase tracking-widest text-center">
                      {uploadError}
                    </div>
                  )}
                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-4">BOOK TITLE</label>
                      <input 
                        required
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full nm-inset rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 text-xs md:text-sm font-black uppercase tracking-tight text-[var(--c-ink)] focus:outline-none"
                        placeholder="ENTER TITLE..."
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-4">AUTHOR NAME</label>
                      <input 
                        required
                        type="text"
                        value={formData.author}
                        onChange={(e) => setFormData({...formData, author: e.target.value})}
                        className="w-full nm-inset rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-6 text-xs md:text-sm font-black uppercase tracking-tight text-[var(--c-ink)] focus:outline-none"
                        placeholder="ENTER AUTHOR..."
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-4">GENRE</label>
                      <div className="nm-inset rounded-[2rem] overflow-visible">
                        <CustomDropdown
                          options={[
                            { label: 'Fiction', value: 'Fiction' },
                            { label: 'Non-Fiction', value: 'Non-Fiction' },
                            { label: 'Fantasy', value: 'Fantasy' },
                            { label: 'Mystery', value: 'Mystery' },
                            { label: 'Sci-Fi', value: 'Sci-Fi' },
                            { label: 'Biography', value: 'Biography' },
                            { label: 'Philosophy', value: 'Philosophy' },
                          ]}
                          value={formData.genre}
                          onChange={(val) => setFormData({ ...formData, genre: val })}
                          placeholder="Select Genre"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-4">FILE SELECTION</label>
                      <div className="relative nm-inset rounded-[2rem] p-6 group cursor-pointer overflow-hidden transition-all hover:bg-[var(--c-emerald)] hover:bg-opacity-5">
                        <input 
                          type="file" 
                          accept=".epub"
                          onChange={handleFileChange}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex items-center gap-4">
                          {selectedFile ? (
                            <>
                              <CheckCircle2 size={24} className="text-[var(--c-emerald)]" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-emerald)] break-all">{selectedFile.name}</span>
                            </>
                          ) : (
                            <>
                              <FileUp size={24} className="text-[var(--c-ink)] opacity-20" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-ink)] opacity-20">CHOOSE EPUB...</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 ml-4">DESCRIPTION</label>
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full nm-inset rounded-[2.5rem] p-8 text-sm font-medium text-[var(--c-ink)] h-40 resize-none focus:outline-none placeholder:opacity-20 uppercase tracking-tight"
                      placeholder="TELL THE COMMUNITY ABOUT THIS WORK..."
                    />
                  </div>

                  {isAutofilling && (
                    <div className="flex items-center justify-center gap-3 animate-pulse">
                      <Loader2 size={16} className="animate-spin text-[var(--c-emerald)]" />
                      <span className="text-[9px] font-black text-[var(--c-emerald)] uppercase tracking-[0.3em]">AI METADATA AUTO-SCAN IN PROGRESS...</span>
                    </div>
                  )}

                  <button 
                    type="submit"
                    disabled={!selectedFile || !user}
                    className="w-full nm-flat bg-[var(--c-bg)] text-[var(--c-emerald)] py-6 rounded-[2rem] text-[12px] font-black uppercase tracking-[0.3em] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-20"
                  >
                    TRANSMIT TO VAULT
                  </button>
                </>
              ) : (
                <div className="py-12 space-y-12 text-center">
                  <div className="w-full nm-inset rounded-full h-8 relative overflow-hidden p-1">
                    <div 
                      className="h-full bg-[var(--c-emerald)] rounded-full transition-all duration-300 shadow-lg"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-3xl font-black text-[var(--c-ink)] uppercase tracking-tighter">UPLOADING: {Math.round(uploadProgress)}%</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--c-ink)] opacity-70">TRANSMITTING DATA FRAGMENTS TO SECURE STORAGE...</p>
                  </div>
                  <div className="w-20 h-20 nm-inset rounded-full flex items-center justify-center mx-auto">
                    <Loader2 size={40} className="text-[var(--c-emerald)] animate-spin" />
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
