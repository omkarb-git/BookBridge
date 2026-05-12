import { useState } from 'react';
import { ArrowRight, BookOpen, KeyRound, Mail, User as UserIcon } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthPageProps {
  mode: 'login' | 'signup';
  onNavigate: (page: string) => void;
}

const AUTH_COPY = {
  login: {
    eyebrow: 'Welcome Back',
    title: 'Pick Up Where Your Shelf Left Off',
    subtitle: 'Log in to swap books, track exchanges, and jump back into the BookBridge community.',
    cta: 'Log In',
    altPrompt: "Don't have an account yet?",
    altAction: 'Create one',
    altPage: 'signup',
  },
  signup: {
    eyebrow: 'Join BookBridge',
    title: 'Build Your Reading Network',
    subtitle: 'Create an account to list books, discover nearby readers, and start your first exchange.',
    cta: 'Create Account',
    altPrompt: 'Already have an account?',
    altAction: 'Log in',
    altPage: 'login',
  },
} as const;

export default function AuthPage({ mode, onNavigate }: AuthPageProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const copy = AUTH_COPY[mode];

  const handleEmailAuth = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      setError(err?.message ?? 'Google sign-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-8rem)] bg-[var(--c-bg)] py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_0.8fr] gap-12 items-stretch">
          {/* Left Panel: Brand & Copy */}
          <div className="hidden lg:flex nm-flat p-8 md:p-12 flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--c-mint)] opacity-10 blur-3xl rounded-full -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--c-teal)] opacity-10 blur-3xl rounded-full -ml-20 -mb-20"></div>
            
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 nm-inset text-[var(--c-emerald)] text-xs font-bold uppercase tracking-wider mb-10">
                <BookOpen size={16} />
                {copy.eyebrow}
              </div>
              <h1 className="text-4xl md:text-7xl font-extrabold text-[var(--c-emerald)] leading-[1.05] uppercase tracking-tight max-w-xl">
                {copy.title}
              </h1>
              <p className="mt-8 max-w-lg text-base md:text-xl font-medium text-[var(--c-ink)] leading-relaxed opacity-70">
                {copy.subtitle}
              </p>
            </div>

            <div className="relative z-10 grid sm:grid-cols-3 gap-6 mt-16">
              {[
                { label: 'Nearby Swaps', value: '247 Live' },
                { label: 'Books Listed', value: '50K+' },
                { label: 'Cities Active', value: '200+' },
              ].map((item) => (
                <div key={item.label} className="nm-inset p-5 rounded-2xl">
                  <div className="text-2xl font-extrabold text-[var(--c-emerald)] uppercase">{item.value}</div>
                  <div className="text-[10px] font-bold text-[var(--c-ink)] uppercase mt-2 opacity-80">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Form */}
          <div className="nm-flat p-8 md:p-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-12">
              <button
                onClick={() => onNavigate('landing')}
                className="text-[10px] font-bold uppercase text-[var(--c-ink)] opacity-80 hover:opacity-100 hover:text-[var(--c-emerald)] transition-all"
              >
                ← Back to home
              </button>
              <div className="flex p-1.5 nm-inset rounded-2xl w-full sm:w-auto">
                {(['login', 'signup'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => onNavigate(tab)}
                    className={`flex-1 sm:flex-none px-6 py-2.5 text-xs font-bold uppercase transition-all rounded-xl ${
                      mode === tab 
                        ? 'nm-flat text-[var(--c-emerald)]' 
                        : 'text-[var(--c-ink)] opacity-80 hover:opacity-100'
                    }`}
                  >
                    {tab === 'login' ? 'Log In' : 'Sign Up'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <span className="block text-[10px] font-bold text-[var(--c-ink)] uppercase opacity-80 ml-2">Display Name</span>
                  <div className="relative">
                    <UserIcon size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--c-emerald)] opacity-80" />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Priya Sharma"
                      className="w-full pl-14 pr-6 py-4 nm-inset focus:nm-flat transition-all outline-none font-bold text-[var(--c-ink)] rounded-2xl"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-[var(--c-ink)] uppercase opacity-80 ml-2">Email Address</span>
                <div className="relative">
                  <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--c-emerald)] opacity-80" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="reader@bookbridge.app"
                    className="w-full pl-14 pr-6 py-4 nm-inset focus:nm-flat transition-all outline-none font-bold text-[var(--c-ink)] rounded-2xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-[var(--c-ink)] uppercase opacity-80 ml-2">Secure Password</span>
                <div className="relative">
                  <KeyRound size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--c-emerald)] opacity-80" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                    className="w-full pl-14 pr-6 py-4 nm-inset focus:nm-flat transition-all outline-none font-bold text-[var(--c-ink)] rounded-2xl"
                  />
                </div>
              </div>

              {error && (
                <div className="nm-inset p-4 rounded-2xl text-xs font-bold text-red-500 border-l-4 border-red-500">
                  {error}
                </div>
              )}

              <button
                onClick={handleEmailAuth}
                disabled={isSubmitting || !email.trim() || !password.trim() || (mode === 'signup' && !name.trim())}
                className="w-full nm-flat py-5 bg-[var(--c-emerald)] text-[var(--c-mint)] flex items-center justify-center gap-3 text-sm font-bold uppercase rounded-2xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 mt-8"
              >
                {isSubmitting ? 'Working...' : copy.cta}
                {!isSubmitting && <ArrowRight size={20} />}
              </button>

              <div className="flex items-center gap-6 py-4">
                <div className="h-px flex-1 bg-[var(--c-ink)] opacity-10"></div>
                <span className="text-[10px] font-bold uppercase opacity-30">OR</span>
                <div className="h-px flex-1 bg-[var(--c-ink)] opacity-10"></div>
              </div>

              <button
                onClick={handleGoogleAuth}
                disabled={isSubmitting}
                className="w-full nm-flat py-5 bg-[var(--c-bg)] text-[var(--c-ink)] flex items-center justify-center gap-3 text-sm font-bold uppercase rounded-2xl hover:nm-inset transition-all disabled:opacity-70"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Continue with Google
              </button>

              <div className="pt-6 text-center text-xs font-bold text-[var(--c-ink)] opacity-70">
                {copy.altPrompt}{' '}
                <button
                  onClick={() => onNavigate(copy.altPage)}
                  className="text-[var(--c-emerald)] underline decoration-2 underline-offset-4"
                >
                  {copy.altAction}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
