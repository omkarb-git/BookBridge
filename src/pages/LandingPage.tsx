import { useState, useEffect, useRef } from 'react';
import { MapPin, RefreshCw, Shield, BookOpen, MessageSquare, Star, Search, Repeat, CheckCircle, CheckCircle2, Zap, ArrowRight } from 'lucide-react';
import { TESTIMONIALS } from '../data/mockData';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, getDocs, where, limit, addDoc } from 'firebase/firestore';

interface LandingPageProps {
  onNavigate: (page: string) => void;
  onAuthClick: (type: 'login' | 'signup') => void;
  scrollTarget?: string | null;
}

const FEATURES = [
  {
    icon: MapPin,
    title: 'Location-Based Discovery',
    desc: 'Find books within your neighborhood or set a radius you\'re comfortable traveling',
    color: 'text-[var(--c-forest)]',
    bg: 'bg-[var(--c-mint)]/20',
  },
  {
    icon: RefreshCw,
    title: 'Smart Matching System',
    desc: 'We match you with users who have what you want AND want what you have',
    color: 'text-[var(--c-emerald)]',
    bg: 'bg-[var(--c-teal)]/20',
  },
  {
    icon: Shield,
    title: 'Real-Time Exchange Tracking',
    desc: 'See each other on map as you head to the meeting point for safety',
    color: 'text-[var(--c-forest)]',
    bg: 'bg-[var(--c-emerald)]/20',
  },
  {
    icon: BookOpen,
    title: 'Digital Library',
    desc: 'Upload & read EPUBs directly in browser. Share knowledge, earn points',
    color: 'text-[var(--c-forest)]',
    bg: 'bg-[var(--c-teal)]/20',
  },
  {
    icon: MessageSquare,
    title: 'Built-in Chat',
    desc: 'Coordinate safely before your meet. No personal info shared until ready',
    color: 'text-[var(--c-emerald)]',
    bg: 'bg-[var(--c-mint)]/20',
  },
  {
    icon: Star,
    title: 'Points & Rewards',
    desc: 'Earn BookPoints for exchanges, uploads, downloads & reviews',
    color: 'text-[var(--c-forest)]',
    bg: 'bg-[var(--c-teal)]/20',
  },
];

const STEPS = [
  { icon: BookOpen, title: 'Create Your Library', desc: 'Upload the books you own, their condition, and what you\'re looking for in return' },
  { icon: Search, title: 'Discover & Match', desc: 'Browse books near you or across the country. Our smart matching shows mutual exchange opportunities' },
  { icon: MessageSquare, title: 'Connect & Chat', desc: 'Message your exchange partner directly, just like your favorite delivery app — but you both show up!' },
  { icon: Repeat, title: 'Meet & Exchange', desc: 'Choose a safe public meeting point. Track each other in real-time until you complete the swap' },
];

export default function LandingPage({ onNavigate, onAuthClick, scrollTarget }: LandingPageProps) {
  const [testimonialsIdx, setTestimonialsIdx] = useState(0);
  const [testimonials, setTestimonials] = useState(TESTIMONIALS);
  const [email, setEmail] = useState('');
  const [liveCount, setLiveCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [counter, setCounter] = useState({ books: 0, cities: 0, readers: 0, epubs: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch real data for counters
  useEffect(() => {
    const fetchStats = async () => {
      setStatsLoading(true);
      try {
        const booksSnap = await getDocs(collection(db, 'books'));
        const epubsSnap = await getDocs(collection(db, 'epubs'));
        const usersSnap = await getDocs(collection(db, 'users'));
        const citiesSnap = await getDocs(collection(db, 'cities'));
        
        // Derived cities (fallback)
        const userCities = usersSnap.docs.map(d => d.data().city).filter(Boolean);
        const bookCities = booksSnap.docs.map(d => d.data().city).filter(Boolean);
        const derivedCities = new Set([...userCities, ...bookCities]);
        
        setCounter({
          books: booksSnap.size,
          cities: citiesSnap.size || derivedCities.size,
          readers: usersSnap.size,
          epubs: epubsSnap.size
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Scroll reveal animation
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach(el => observer.observe(el));

    return () => {
      revealElements.forEach(el => observer.unobserve(el));
    };
  }, []);

  // Real-time "Live" count (books added today)
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const q = query(collection(db, 'books'), where('createdAt', '>=', today));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        setLiveCount(snapshot.size);
      } catch (err) {
        console.error("Error in liveCount snapshot:", err);
      }
    }, (err) => {
      console.error("Firestore onSnapshot error:", err);
    });

    return () => unsubscribe();
  }, []);
  // Fetch testimonials
  useEffect(() => {
    const fetchTestimonials = async () => {
      try {
        const q = query(collection(db, 'testimonials'), limit(5));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setTestimonials(snap.docs.map(d => ({ id: d.id, ...d.data() })) as any);
        }
      } catch (err) {
        console.error("Error fetching testimonials:", err);
      }
    };
    fetchTestimonials();
  }, []);

  const handleJoin = async () => {
    if (!email || !email.includes('@')) {
      onAuthClick('signup');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'leads'), {
        email,
        createdAt: new Date(),
        source: 'landing_page'
      });
    } catch (err) {
      console.error("Error saving lead:", err);
    } finally {
      setIsSubmitting(false);
      onAuthClick('signup');
    }
  };

  // Scroll to section when scrollTarget changes
  useEffect(() => {
    if (!scrollTarget) return;
    const el = document.getElementById(scrollTarget);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [scrollTarget]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialsIdx(i => (i + 1) % testimonials.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  return (
    <div className="min-h-screen bg-[var(--c-bg)]">
      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-16 sm:pb-32">
        <div className="absolute top-[5%] right-[10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-[var(--c-mint)] opacity-[0.2] blur-[80px] sm:blur-[120px] rounded-full pointer-events-none animate-slow-drift"></div>
        <div className="absolute bottom-[10%] left-[5%] w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-[var(--c-teal)] opacity-[0.2] blur-[70px] sm:blur-[100px] rounded-full pointer-events-none animate-slow-drift" style={{ animationDelay: '-7s' }}></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="space-y-6 sm:space-y-10 animate-fade-up">
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 sm:py-2.5 nm-flat rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-widest text-[var(--c-emerald)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                LIVE: {liveCount} BOOKS DISCOVERED TODAY
              </div>

              <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter text-[var(--c-ink)] leading-[0.9] uppercase">
                Where Books
                <br />
                <span className="text-[var(--c-emerald)]">Find New</span>
                <br />
                Homes.
              </h1>

              <p className="text-sm sm:text-lg md:text-xl text-[var(--c-ink)] opacity-80 font-medium max-w-lg leading-relaxed">
                A premium community-driven book exchange. Swap physical books, read digital EPUBs, and track meetups with precision.
              </p>

              <div className="flex flex-col xs:flex-row gap-4 sm:gap-6 pt-4">
                <button
                  onClick={() => onAuthClick('signup')}
                  className="nm-flat bg-[var(--c-emerald)] text-[var(--c-mint)] px-8 sm:px-10 py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 text-xs sm:text-sm font-bold uppercase hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                  Join Community <ArrowRight size={18} />
                </button>
                <button
                  onClick={() => onNavigate('epub-library')}
                  className="nm-flat bg-white text-[var(--c-emerald)] px-8 sm:px-10 py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-3 text-xs sm:text-sm font-bold uppercase hover:scale-105 active:scale-95 transition-all"
                >
                  <BookOpen size={20} /> Digital Library
                </button>
              </div>

              <div className="flex flex-wrap gap-4 sm:gap-8 text-[8px] sm:text-[10px] font-bold text-[var(--c-ink)] opacity-70 pt-4 sm:pt-6 uppercase tracking-[0.2em]">
                <span className="flex items-center gap-2"><Shield size={12} className="text-[var(--c-emerald)]" /> ALWAYS FREE</span>
                <span className="flex items-center gap-2"><Zap size={12} className="text-[var(--c-emerald)]" /> INSTANT START</span>
                <span className="flex items-center gap-2"><Star size={12} className="text-[var(--c-emerald)]" /> TOP RATED</span>
              </div>
            </div>

            {/* Visual Container */}
            <div className="relative animate-fade-up mt-12 lg:mt-0" style={{ animationDelay: '0.2s' }}>
              <div className="nm-flat w-full aspect-square rounded-[2rem] md:rounded-[4rem] p-6 md:p-12 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(var(--c-teal) 2px, transparent 2px)', backgroundSize: '40px 40px' }} />
                
                <div className="w-32 h-32 md:w-64 md:h-64 nm-inset rounded-[1.5rem] md:rounded-[3rem] flex items-center justify-center relative z-10">
                   <BookOpen size={50} className="text-[var(--c-emerald)] opacity-20 md:hidden" />
                   <BookOpen size={100} className="text-[var(--c-emerald)] opacity-20 hidden md:block" />
                </div>
              </div>

              {/* Neumorphic floating cards with shared images */}
              <div className="absolute top-5 left-0 md:-left-16 w-32 md:w-40 animate-float">
                <div className="nm-flat p-2 md:p-4 rounded-xl md:rounded-3xl rotate-6">
                  <div className="border-2 md:border-4 border-[var(--c-ink)] rounded-lg md:rounded-2xl overflow-hidden">
                    <img 
                      src="/images/Alchemised_book_cover.webp" 
                      alt="The Alchemist" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="absolute bottom-5 right-0 md:-right-16 w-32 md:w-40 animate-float" style={{ animationDelay: '1.5s' }}>
                <div className="nm-flat p-2 md:p-4 rounded-xl md:rounded-3xl -rotate-6">
                  <div className="border-2 md:border-4 border-[var(--c-ink)] rounded-lg md:rounded-2xl overflow-hidden">
                    <img 
                      src="/images/the-midnight-library-matt-haig.jpg" 
                      alt="The Midnight Library" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="absolute -top-5 md:-top-10 right-0 md:right-5 w-32 md:w-40 animate-float" style={{ animationDelay: '0.5s' }}>
                <div className="nm-flat p-2 md:p-4 rounded-xl md:rounded-3xl -rotate-12">
                  <div className="border-2 md:border-4 border-[var(--c-ink)] rounded-lg md:rounded-2xl overflow-hidden">
                    <img 
                      src="/images/o-NEW-HARRY-POTTER-COVER-facebook.jpg" 
                      alt="Harry Potter" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-5 md:-bottom-10 left-0 md:left-5 w-32 md:w-40 animate-float" style={{ animationDelay: '2s' }}>
                <div className="nm-flat p-2 md:p-4 rounded-xl md:rounded-3xl rotate-12">
                  <div className="border-2 md:border-4 border-[var(--c-ink)] rounded-lg md:rounded-2xl overflow-hidden">
                    <img 
                      src="/images/catching-fire-book-cover.jpg" 
                      alt="Catching Fire" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="py-12 sm:py-20 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="nm-flat rounded-[2rem] sm:rounded-[3rem] p-2 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { val: counter.books > 1000 ? `${(counter.books / 1000).toFixed(1)}K+` : counter.books, label: 'BOOKS LISTED' },
              { val: counter.cities, label: 'CITIES ACTIVE' },
              { val: '99%', label: 'SATISFACTION' },
              { val: counter.epubs > 1000 ? `${(counter.epubs / 1000).toFixed(1)}K+` : counter.epubs, label: 'SHARED EPUBS' },
            ].map((stat, i) => (
              <div key={i} className="nm-inset rounded-[1.5rem] sm:rounded-[2.5rem] py-8 sm:py-12 text-center group hover:nm-flat transition-all cursor-default reveal" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className={`text-2xl sm:text-4xl font-black text-[var(--c-emerald)] tracking-tighter group-hover:scale-110 transition-transform ${statsLoading ? 'skeleton w-20 h-8 mx-auto' : ''}`}>
                  {stat.val}
                </div>
                <div className="text-[8px] sm:text-[10px] text-[var(--c-ink)] opacity-70 font-bold uppercase tracking-[0.3em] mt-2 sm:mt-3">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works-section" className="py-16 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12 sm:mb-24 space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black text-[var(--c-ink)] tracking-tight uppercase leading-none">
              Simple. Soft. <span className="text-[var(--c-emerald)]">Social.</span>
            </h2>
            <p className="text-[10px] sm:text-sm font-bold opacity-70 uppercase tracking-[0.4em]">EXCHANGE IN FOUR SIMPLE STEPS</p>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="group reveal" style={{ transitionDelay: `${i * 150}ms` }}>
                <div className="nm-flat p-8 sm:p-10 rounded-[2rem] sm:rounded-[3rem] h-full flex flex-col items-center text-center group-hover:scale-[1.02] transition-all">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 nm-inset text-[var(--c-emerald)] flex items-center justify-center mb-6 sm:mb-10 rounded-xl sm:rounded-2xl group-hover:nm-flat transition-all">
                    <step.icon size={24} />
                  </div>
                  <div className="text-[9px] font-black text-[var(--c-emerald)] tracking-[0.3em] uppercase mb-3 sm:mb-4">STEP 0{i + 1}</div>
                  <h3 className="font-extrabold text-base sm:text-lg text-[var(--c-ink)] mb-3 sm:mb-4 uppercase tracking-tight">{step.title}</h3>
                  <p className="text-xs sm:text-sm font-medium text-[var(--c-ink)] opacity-80 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FEATURES GRID ═══ */}
      <section id="features-section" className="py-16 sm:py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[var(--c-emerald)] opacity-5 -skew-y-6 transform origin-top-left"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 sm:mb-24 gap-6 sm:gap-8">
            <div className="space-y-4 text-center md:text-left">
              <h2 className="text-3xl sm:text-5xl font-black text-[var(--c-ink)] tracking-tight uppercase leading-none">
                Beyond Just <span className="text-[var(--c-emerald)]">Swapping</span>
              </h2>
              <p className="text-[10px] sm:text-sm font-bold opacity-70 uppercase tracking-[0.4em]">POWERFUL UTILITIES FOR THE MODERN READER</p>
            </div>
            <button className="nm-flat px-6 sm:px-8 py-3 sm:py-4 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-[var(--c-emerald)] hover:nm-inset transition-all mx-auto md:mx-0">
              VIEW ALL FEATURES
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-10">
            {FEATURES.map((feature, i) => (
              <div key={i} className="nm-flat p-8 sm:p-12 rounded-[2.5rem] sm:rounded-[3.5rem] group hover:scale-[1.02] transition-all reveal" style={{ transitionDelay: `${i * 150}ms` }}>
                <div className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center mb-6 sm:mb-10 nm-inset rounded-xl sm:rounded-2xl text-[var(--c-emerald)] group-hover:nm-flat transition-all`}>
                  <feature.icon size={20} sm:size={24} />
                </div>
                <h3 className="font-extrabold text-lg sm:text-xl text-[var(--c-ink)] mb-3 sm:mb-5 uppercase tracking-tight">{feature.title}</h3>
                <p className="text-xs sm:text-sm font-medium text-[var(--c-ink)] opacity-80 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section id="community-section" className="py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-24 space-y-4">
            <h2 className="text-4xl md:text-5xl font-black text-[var(--c-ink)] tracking-tight uppercase leading-none">
              The <span className="text-[var(--c-emerald)]">Reader's</span> Choice
            </h2>
            <p className="text-sm font-bold opacity-70 uppercase tracking-[0.4em]">VOICES FROM OUR GLOBAL COMMUNITY</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-10">
             <div className="lg:col-span-2 nm-flat p-12 md:p-20 rounded-[4rem] relative overflow-hidden reveal">
                <div className="absolute top-0 right-0 p-12 opacity-5">
                   <Repeat size={200} />
                </div>
                <div className="relative z-10 space-y-10">
                  <div className="flex gap-2">
                    {Array(5).fill(null).map((_, i) => (
                      <Star key={i} size={18} className="text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  {testimonials[testimonialsIdx] && (
                    <p className="text-2xl md:text-4xl font-extrabold text-[var(--c-ink)] leading-[1.2] italic opacity-80">
                      "{testimonials[testimonialsIdx].text}"
                    </p>
                  )}
                  <div className="flex items-center gap-6 pt-6">
                    <div className="w-16 h-16 nm-inset flex items-center justify-center font-black text-xl text-[var(--c-emerald)] rounded-2xl">
                      {testimonials[testimonialsIdx]?.avatar || '?'}
                    </div>
                    <div>
                      <div className="font-black text-lg text-[var(--c-ink)] uppercase tracking-tight">{testimonials[testimonialsIdx]?.name || 'Anonymous'}</div>
                      <div className="text-xs font-bold text-[var(--c-emerald)] uppercase tracking-widest opacity-80 mt-1">{testimonials[testimonialsIdx]?.city || 'Global'}</div>
                    </div>
                  </div>
                </div>
             </div>

             <div className="flex flex-col gap-10">
                {testimonials.length > 1 ? (
                  testimonials.filter((_, i) => i !== testimonialsIdx).slice(0, 2).map((t, index) => (
                    <div key={t.id} className="nm-flat p-10 rounded-[3rem] group hover:nm-inset transition-all cursor-pointer reveal" style={{ transitionDelay: `${index * 150}ms` }} onClick={() => setTestimonialsIdx(testimonials.indexOf(t))}>
                      <p className="text-sm font-bold text-[var(--c-ink)] opacity-80 leading-relaxed mb-8">"{t.text}"</p>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 nm-inset flex items-center justify-center font-black text-[var(--c-emerald)] rounded-xl">
                          {t.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[var(--c-ink)] uppercase tracking-tight">{t.name}</div>
                          <div className="text-[9px] font-bold opacity-70 uppercase tracking-widest mt-0.5">{t.city}</div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="nm-flat p-10 rounded-[3rem] opacity-80 flex flex-col items-center justify-center text-center py-20">
                    <div className="text-[var(--c-emerald)] mb-4">
                      <Star size={32} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest">More Stories Coming Soon</p>
                  </div>
                )}
                
                <div className="flex items-center justify-center gap-4 mt-auto py-6">
                  {testimonials.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setTestimonialsIdx(i)}
                      className={`h-2 rounded-full transition-all duration-500 ${i === testimonialsIdx ? 'w-12 bg-[var(--c-emerald)] nm-flat' : 'w-2 bg-[var(--c-ink)] opacity-10'}`}
                    />
                  ))}
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* ═══ JOIN CTA ═══ */}
      <section id="cta-section" className="py-16 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="nm-flat bg-[var(--c-emerald)] rounded-[2.5rem] sm:rounded-[4rem] p-8 sm:p-24 relative overflow-hidden text-center">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
            
            <div className="relative z-10 max-w-3xl mx-auto space-y-6 sm:space-y-10">
              <h2 className="text-4xl sm:text-7xl font-black text-[var(--c-mint)] tracking-tighter uppercase leading-none">
                Start Your <br className="hidden sm:block" />New <span className="text-[var(--c-ink)] opacity-20">Chapter.</span>
              </h2>
              <p className="text-[var(--c-ink)] opacity-80 font-medium text-sm sm:text-lg max-w-xl mx-auto">
                Join a premium network of 50,000+ readers. Exchange books for free, build your digital library, and meet your community.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto pt-4">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your Email"
                  className="flex-1 nm-inset bg-[var(--c-bg)] rounded-xl sm:rounded-2xl px-6 py-4 sm:py-5 text-[var(--c-ink)] placeholder:text-[var(--c-ink)] placeholder:opacity-30 focus:outline-none transition-all font-bold text-sm"
                />
                <button
                  onClick={handleJoin}
                  disabled={isSubmitting}
                  className="nm-flat bg-[var(--c-emerald)] text-[var(--c-mint)] px-8 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black uppercase text-[10px] sm:text-xs tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-2xl disabled:opacity-80"
                >
                  {isSubmitting ? 'WORKING...' : 'GET ACCESS'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pt-4 sm:pt-6">
                <div className="flex items-center gap-2 sm:gap-3 text-[8px] sm:text-[10px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-widest"><CheckCircle size={14} className="text-[var(--c-emerald)]" /> FREE ACCOUNT</div>
                <div className="flex items-center gap-2 sm:gap-3 text-[8px] sm:text-[10px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-widest"><CheckCircle size={14} className="text-[var(--c-emerald)]" /> NO HIDDEN FEES</div>
                <div className="flex items-center gap-2 sm:gap-3 text-[8px] sm:text-[10px] font-black text-[var(--c-ink)] opacity-70 uppercase tracking-widest"><CheckCircle size={14} className="text-[var(--c-emerald)]" /> GLOBAL COMMUNITY</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

  );
}
