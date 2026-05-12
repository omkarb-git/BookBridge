import { BookOpen, ArrowRight, Heart } from 'lucide-react';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export default function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="bg-[var(--c-bg)] px-4 pb-12 pt-8">
      <div className="max-w-7xl mx-auto nm-flat p-8 md:p-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-10">
          {/* Brand */}
          <div className="space-y-6">
            <button onClick={() => onNavigate('landing')} className="flex items-center gap-2 group">
              <div className="w-9 h-9 bg-[var(--c-emerald)] flex items-center justify-center rounded-xl shadow-lg group-hover:scale-105 transition-transform">
                <BookOpen size={18} className="text-[var(--c-mint)]" />
              </div>
              <span className="font-bold text-[var(--c-emerald)] tracking-tight uppercase">BookBridge</span>
            </button>
            <p className="text-[var(--c-ink)] font-medium text-sm leading-relaxed opacity-80">
              Where Books Find New Homes, and Readers Find Each Other.
            </p>
            <div className="space-y-3">
              <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase opacity-80">Join our newsletter</div>
              <div className="flex p-1 nm-inset rounded-xl">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-2 bg-transparent text-sm focus:outline-none"
                />
                <button className="p-2 bg-[var(--c-emerald)] text-[var(--c-mint)] rounded-lg nm-flat hover:scale-105 transition-transform flex items-center justify-center">
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-[var(--c-ink)] text-xs mb-6 uppercase opacity-80">Explore</h3>
            <ul className="space-y-4">
              {[
                { label: 'Home', page: 'landing' },
                { label: 'About', page: 'about' },
                { label: 'How It Works', page: 'how-it-works' },
                { label: 'Community', page: 'community' },
                { label: 'Contact', page: 'contact' },
              ].map(link => (
                <li key={link.page}>
                  <button
                    onClick={() => onNavigate(link.page)}
                    className="group flex items-center gap-0 hover:gap-2 text-sm font-bold text-[var(--c-ink)] opacity-70 hover:opacity-100 hover:text-[var(--c-emerald-deep)] transition-all duration-300 active:scale-95"
                  >
                    <div className="w-0 group-hover:w-1.5 h-1.5 rounded-full bg-[var(--c-emerald-deep)] transition-all duration-300" />
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-bold text-[var(--c-ink)] text-xs mb-6 uppercase opacity-80">Resources</h3>
            <ul className="space-y-4">
              {['Blog', 'Help Center', 'Privacy', 'Terms', 'API Docs'].map(item => (
                <li key={item}>
                  <button 
                    onClick={() => onNavigate(item.toLowerCase().replace(' ', '-'))}
                    className="group flex items-center gap-0 hover:gap-2 text-sm font-bold text-[var(--c-ink)] opacity-70 hover:opacity-100 hover:text-[var(--c-emerald-deep)] transition-all duration-300 active:scale-95 text-left"
                  >
                    <div className="w-0 group-hover:w-1.5 h-1.5 rounded-full bg-[var(--c-emerald-deep)] transition-all duration-300" />
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="font-bold text-[var(--c-ink)] text-xs mb-6 uppercase opacity-80">Connect</h3>
            <div className="flex gap-4 mb-8">
              {[
                { label: 'Twitter', initial: 'X' },
                { label: 'Instagram', initial: 'IG' },
                { label: 'Facebook', initial: 'FB' },
              ].map(({ label, initial }) => (
                <button
                  key={label}
                  className="w-10 h-10 nm-flat rounded-full flex items-center justify-center text-[var(--c-emerald)] hover:nm-inset transition-all active:scale-90 text-xs font-bold"
                  title={label}
                >
                  {initial}
                </button>
              ))}
            </div>

            {/* Stats mini */}
            <div className="space-y-3 nm-inset p-4 rounded-2xl">
              {[
                { label: 'Books', value: '50K+' },
                { label: 'Cities', value: '200+' },
              ].map(stat => (
                <div key={stat.label} className="flex justify-between items-center text-xs">
                  <span className="text-[var(--c-ink)] font-bold opacity-80">{stat.label}</span>
                  <span className="font-bold text-[var(--c-emerald)]">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-[var(--c-ink)] border-opacity-5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center text-xs font-bold text-[var(--c-ink)] opacity-80">
            © 2024 BookBridge. Made with <Heart size={14} className="mx-1 text-red-500 fill-red-500" /> for readers.
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--c-ink)] opacity-70">
            Cultivating the Global Library
          </span>
        </div>
      </div>
    </footer>
  );
}
