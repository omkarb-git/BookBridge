import { useState, useRef, useEffect } from 'react';
import { ReactReader } from 'react-reader';
import { X, ChevronLeft, ChevronRight, Settings, Book, Type, Moon, Sun, Maximize2, Loader2 } from 'lucide-react';

interface EpubReaderProps {
  url: string | ArrayBuffer;
  title: string;
  onClose: () => void;
}

export default function EpubReader({ url, title, onClose }: EpubReaderProps) {
  const [location, setLocation] = useState<string | number>(0);
  const [firstRenderDone, setFirstRenderDone] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [fontSize, setFontSize] = useState(100);
  const [loadError, setLoadError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const renditions = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!firstRenderDone) {
        setLoadError(true);
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [firstRenderDone]);

  const locationChanged = (epubcifi: string | number) => {
    setLocation(epubcifi);
  };

  const applyTheme = (newTheme: 'light' | 'dark' | 'sepia') => {
    setTheme(newTheme);
    if (renditions.current) {
      const styles = {
        light: { background: '#ffffff', color: '#000000' },
        dark: { background: '#1a1a1a', color: '#ffffff' },
        sepia: { background: '#f4ecd8', color: '#5b4636' }
      };
      
      renditions.current.themes.override('background', styles[newTheme].background);
      renditions.current.themes.override('color', styles[newTheme].color);
      renditions.current.themes.override('font-family', 'Inter, sans-serif');
      
      renditions.current.themes.register('custom', {
        'body': { background: styles[newTheme].background, color: styles[newTheme].color },
        'p': { color: styles[newTheme].color },
        'span': { color: styles[newTheme].color },
        'h1': { color: styles[newTheme].color },
        'h2': { color: styles[newTheme].color },
        'h3': { color: styles[newTheme].color }
      });
      renditions.current.themes.select('custom');
    }
  };

  const themeStyles = {
    light: { bg: 'bg-[#f8f8f8]', header: 'bg-white', text: 'text-[var(--c-ink)]' },
    sepia: { bg: 'bg-[#f4ecd8]', header: 'bg-[#ede3cc]', text: 'text-[#5b4636]' },
    dark: { bg: 'bg-[#121212]', header: 'bg-[#1a1a1a]', text: 'text-white' }
  };

  const changeFontSize = (delta: number) => {
    const newSize = Math.max(80, Math.min(200, fontSize + delta));
    setFontSize(newSize);
    if (renditions.current) {
      renditions.current.themes.fontSize(`${newSize}%`);
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-black/90 flex flex-col animate-fade-in backdrop-blur-xl">
      {/* Header */}
      <div className={`${themeStyles[theme].header} px-6 py-4 flex items-center justify-between z-10 transition-colors duration-300`}>
        <div className="flex items-center gap-6">
          <button 
            onClick={onClose}
            className={`w-12 h-12 nm-flat flex items-center justify-center rounded-2xl hover:nm-inset transition-all ${themeStyles[theme].text}`}
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 nm-inset flex items-center justify-center rounded-2xl hidden sm:flex text-[var(--c-emerald)]">
              <Book size={24} />
            </div>
            <div>
              <h2 className={`font-black ${themeStyles[theme].text} text-sm sm:text-base uppercase tracking-tight line-clamp-1 max-w-[200px] sm:max-w-md`}>
                {title}
              </h2>
              <p className={`text-[9px] font-black tracking-[0.2em] uppercase ${theme === 'dark' ? 'text-[var(--c-ink)]' : 'text-[var(--c-ink)]'}`}>
                SYSTEM READING PROTOCOL
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden md:flex items-center p-1 nm-inset rounded-2xl gap-2">
            <button 
              onClick={() => changeFontSize(-10)}
              className={`w-10 h-10 flex items-center justify-center transition-all ${themeStyles[theme].text} opacity-70 hover:opacity-100`}
            >
              <Type size={14} />
            </button>
            <div className={`px-4 font-black text-xs ${themeStyles[theme].text}`}>{fontSize}%</div>
            <button 
              onClick={() => changeFontSize(10)}
              className={`w-10 h-10 flex items-center justify-center transition-all ${themeStyles[theme].text} opacity-70 hover:opacity-100`}
            >
              <Type size={20} />
            </button>
          </div>

          <div className="flex items-center p-1 nm-inset rounded-2xl gap-2">
            <button 
              onClick={() => applyTheme('light')}
              className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${theme === 'light' ? 'nm-flat bg-white text-[var(--c-emerald)]' : 'text-[var(--c-ink)] hover:text-gray-600'}`}
              title="Light Mode"
            >
              <Sun size={18} />
            </button>
            <button 
              onClick={() => applyTheme('sepia')}
              className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${theme === 'sepia' ? 'nm-flat bg-[#f4ecd8] text-[#5b4636]' : 'text-[var(--c-ink)] hover:text-[#5b4636]'}`}
              title="Sepia Mode"
            >
              <div className="w-4 h-4 bg-[#f4ecd8] border border-gray-300 rounded-full" />
            </button>
            <button 
              onClick={() => applyTheme('dark')}
              className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${theme === 'dark' ? 'nm-flat bg-gray-800 text-white' : 'text-[var(--c-ink)] hover:text-white'}`}
              title="Dark Mode"
            >
              <Moon size={18} />
            </button>
          </div>

          <button 
            onClick={toggleFullscreen}
            className={`w-12 h-12 nm-flat hidden sm:flex items-center justify-center rounded-2xl transition-all ${themeStyles[theme].text} opacity-80 hover:opacity-100 hover:nm-inset`}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            <Maximize2 size={20} />
          </button>

          <button 
            onClick={onClose}
            className="w-12 h-12 nm-flat bg-white text-red-500 rounded-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Reader Container */}
      <div className={`flex-1 relative ${themeStyles[theme].bg} overflow-hidden transition-colors duration-300 p-4`}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
           <Book size={400} className="text-black rotate-12" />
        </div>
        
        <div className="h-full relative z-10 nm-flat bg-white rounded-[3rem] overflow-hidden">
          <ReactReader
            url={url}
            location={location}
            locationChanged={locationChanged}
            title={title}
            epubOptions={{
              openAs: 'epub',
              allowScriptedContent: true,
              flow: 'scrolled'
            }}
            getRendition={(rendition) => {
              renditions.current = rendition;
              rendition.themes.fontSize(`${fontSize}%`);
              
              const styles = {
                light: { background: '#ffffff', color: '#000000' },
                dark: { background: '#1a1a1a', color: '#ffffff' },
                sepia: { background: '#f4ecd8', color: '#5b4636' }
              };
              
              rendition.themes.override('background', styles[theme].background);
              rendition.themes.override('color', styles[theme].color);
              rendition.themes.override('font-family', 'Inter, sans-serif');

              rendition.themes.register('custom', {
                'body': { background: styles[theme].background, color: styles[theme].color },
                'p': { color: styles[theme].color },
                'span': { color: styles[theme].color },
                'h1': { color: styles[theme].color },
                'h2': { color: styles[theme].color },
                'h3': { color: styles[theme].color }
              });
              rendition.themes.select('custom');
              
              setFirstRenderDone(true);
            }}
            loadingView={
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <Loader2 size={48} className="text-[var(--c-emerald)] animate-spin" />
                <div className="nm-flat bg-white px-6 py-3 rounded-xl">
                  <p className="font-black uppercase tracking-[0.3em] text-[10px] text-[var(--c-ink)]">Synchronizing Archive...</p>
                </div>
              </div>
            }
          />
          
          {loadError && (
            <div className="absolute inset-0 bg-white flex flex-col items-center justify-center p-12 text-center z-50">
               <div className="w-20 h-20 nm-inset flex items-center justify-center mb-8 rounded-[2rem] text-red-500">
                  <X size={40} />
               </div>
               <h3 className="text-2xl font-black text-[var(--c-ink)] uppercase tracking-tight mb-4">PROTOCOL BREACH</h3>
               <p className="text-xs font-bold text-[var(--c-ink)] mb-10 uppercase tracking-widest max-w-sm leading-relaxed">
                  The volume's structural integrity is compromised for digital projection. Use local download for manual access.
               </p>
               <div className="flex gap-6">
                 <button 
                   onClick={() => window.location.reload()}
                   className="nm-flat bg-white px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] hover:nm-inset transition-all"
                 >
                   REBOOT
                 </button>
                 <a 
                   href={url} 
                   download={`${title.replace(/\s+/g, '_')}.epub`}
                   className="nm-flat bg-[var(--c-emerald)] text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-3 shadow-xl hover:scale-105 transition-all"
                 >
                   <Settings size={18} /> DOWNLOAD
                 </a>
               </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="absolute bottom-8 left-12 right-12 h-2 nm-inset rounded-full z-20 overflow-hidden p-0.5 bg-white bg-opacity-20 backdrop-blur-sm">
          <div className="h-full bg-[var(--c-emerald)] rounded-full transition-all shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: '33%' }}></div>
        </div>
      </div>

      {/* Mobile Controls */}
      <div className="bg-white p-6 flex sm:hidden items-center justify-between z-10 gap-6">
        <button className="flex-1 nm-flat py-4 rounded-xl flex items-center justify-center gap-3 font-black uppercase text-[9px] tracking-widest text-[var(--c-ink)] hover:nm-inset transition-all">
          <ChevronLeft size={16} /> PREV
        </button>
        <button className="flex-1 nm-flat py-4 rounded-xl flex items-center justify-center gap-3 font-black uppercase text-[9px] tracking-widest text-[var(--c-ink)] hover:nm-inset transition-all">
          NEXT <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
