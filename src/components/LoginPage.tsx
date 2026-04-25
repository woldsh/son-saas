'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { getCleanUrlForRole } from '../utils/routeConfig';
import {
  Mail,
  Lock,
  LogIn,
  ShieldAlert,
  Loader2,
  Building2,
  Fingerprint,
  LockKeyhole,
  ChevronRight,
  ShieldCheck,
  Globe2,
  Eye,
  EyeOff,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';

import { useLanguage } from '../contexts/LanguageContext';

export default function LoginPage() {
  const { language, setLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const { login, resetPassword } = useAuth();
  const router = useRouter();

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);

  useEffect(() => {
    const storedLockout = localStorage.getItem('loginLockoutEnd');
    if (storedLockout) {
      const expirationTime = parseInt(storedLockout, 10);
      if (Date.now() < expirationTime) {
        setLockoutEnd(expirationTime);
        const minutesLeft = Math.ceil((expirationTime - Date.now()) / 60000);
        setError(`Too many failed attempts. Please wait ${minutesLeft} minutes.`);
      } else {
        localStorage.removeItem('loginLockoutEnd');
        localStorage.removeItem('loginFailedAttempts');
      }
    } else {
      const storedAttempts = localStorage.getItem('loginFailedAttempts');
      if (storedAttempts) {
        setFailedAttempts(parseInt(storedAttempts, 10));
      }
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockoutEnd) {
      timer = setInterval(() => {
        if (Date.now() >= lockoutEnd) {
          setLockoutEnd(null);
          setFailedAttempts(0);
          setError('');
          localStorage.removeItem('loginLockoutEnd');
          localStorage.removeItem('loginFailedAttempts');
        } else {
          const minutesLeft = Math.ceil((lockoutEnd - Date.now()) / 60000);
          setError(`Too many failed attempts. Please wait ${minutesLeft} minutes.`);
        }
      }, 60000);
    }
    return () => clearInterval(timer);
  }, [lockoutEnd]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (lockoutEnd && Date.now() < lockoutEnd) {
      const minutesLeft = Math.ceil((lockoutEnd - Date.now()) / 60000);
      setError(`Too many failed attempts. Please wait ${minutesLeft} minutes.`);
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (!db) throw new Error("Firebase not initialized");
      // Login user
      await login(email, password);
      // Redirection is handled by the parent component (src/app/login/page.tsx)
      // once AuthContext confirms the user is verified and active.
      localStorage.removeItem('loginFailedAttempts');
      localStorage.removeItem('loginLockoutEnd');
      setFailedAttempts(0);
      setLockoutEnd(null);
    } catch (err: any) {
      console.error('Login error:', err);
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      localStorage.setItem('loginFailedAttempts', newAttempts.toString());

      if (newAttempts >= 5) {
        const expiration = Date.now() + 30 * 60 * 1000;
        setLockoutEnd(expiration);
        localStorage.setItem('loginLockoutEnd', expiration.toString());
        setError(`You have made 5 failed attempts. Please wait 30 minutes before trying again.`);
      } else {
        const remaining = 5 - newAttempts;
        setError(`${err.message || 'Verification failed. Please check your credentials.'} (Warning: ${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`);
      }
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }

    if (!isConfirmingReset) {
      setError('');
      setMessage('');
      setIsConfirmingReset(true);
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);
    try {
      await resetPassword(email);
      setMessage('Password reset link sent! Check your inbox.');
      setIsConfirmingReset(false);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to send reset email.');
      setIsConfirmingReset(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6 bg-white selection:bg-indigo-500/20">

      {/* Subtle Background Accents */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] rounded-full bg-indigo-50/60 blur-[120px]" />
        <div className="absolute -bottom-[150px] -left-[150px] w-[500px] h-[500px] rounded-full bg-blue-50/50 blur-[100px]" />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      {/* Back to Home */}
      <Link
        href="/"
        className="fixed top-6 left-6 z-20 flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft size={16} />
        <span className="hidden sm:inline">Home</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[520px]"
      >
        {/* Institutional Branding Above Card */}
        <div className="flex flex-col items-center mb-10">
          <Link href="/" className="group flex flex-col items-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-slate-200 mb-6 overflow-hidden border border-slate-100"
            >
              <img src="/logo.png" alt="DMU Logo" className="w-full h-full object-contain p-2.5" />
            </motion.div>
            <div className="text-center">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-tight mb-2">
                <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">Burie Campus</span>
              </h1>
              <h2 className="text-sm font-bold text-slate-700 uppercase tracking-widest mb-3">
                Property Management System
              </h2>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-50 border border-rose-100/50"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <ShieldAlert size={14} className="text-rose-500" />
                </motion.div>
                <span className="text-[10px] text-rose-600 font-black tracking-[0.2em] uppercase">
                  AUTHORIZED PERSONNEL ACCESS ONLY
                </span>
              </motion.div>
            </div>
          </Link>
        </div>

        {/* Clean White Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-10 relative overflow-hidden">

          {/* Subtle accent at top */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />

          <div className="relative z-10">
            <div className="mb-8">
              <h3 className="text-xl font-bold text-slate-900 mb-1.5 flex items-center gap-2.5">
                {t('loginErrorTitle') ? 'Institutional Login' : 'Institutional Login'}
                <Fingerprint size={20} className="text-indigo-500" />
              </h3>
              <p className="text-slate-400 text-sm">
                Sign in to access the management portal
              </p>
            </div>

            {showForgotPassword ? (
              <form onSubmit={handleResetPassword} className="space-y-5">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-red-50 border border-red-100 text-red-800 flex items-center gap-3 p-4 rounded-xl"
                    >
                      <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-0.5">{t('loginErrorTitle')}</h4>
                        <p className="text-xs font-medium text-red-700">{error}</p>
                      </div>
                    </motion.div>
                  )}
                  {message && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center gap-3 p-4 rounded-xl"
                    >
                      <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">Success</h4>
                        <p className="text-xs font-medium text-emerald-700">{message}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-6">
                  <div className="relative mt-2">
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder=" "
                      className="peer w-full bg-transparent border border-slate-300 rounded-full px-7 py-5 text-base tracking-wider text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                    <label
                      htmlFor="reset-email"
                      className={`absolute left-7 px-1 bg-white transition-all duration-200 pointer-events-none peer-focus:-top-2.5 peer-focus:text-[12px] peer-focus:text-blue-500 ${email ? '-top-2.5 text-[12px] text-slate-500' : 'top-5 text-base text-slate-400'
                        }`}
                    >
                      Account Email
                    </label>
                  </div>
                </div>

                <div className="pt-2 space-y-3">
                  <AnimatePresence mode="wait">
                    {isConfirmingReset ? (
                      <motion.div
                        key="confirm-box"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-3"
                      >
                        <p className="text-xs font-semibold text-indigo-800 text-center">
                          Are you sure you want to send a password reset link to this email?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => setIsConfirmingReset(false)}
                            className="flex-1 h-10 rounded-lg border border-indigo-200 bg-white text-indigo-600 font-semibold text-[11px] uppercase tracking-wider hover:bg-indigo-50 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 h-10 rounded-lg bg-indigo-600 text-white font-semibold text-[11px] uppercase tracking-wider hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Send It'}
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="send-btn"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm overflow-hidden transition-all hover:shadow-lg hover:shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5"
                      >
                        <>Send Reset Link <Mail size={16} /></>
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(false); setError(''); setMessage(''); setIsConfirmingReset(false); }}
                    className="w-full h-12 rounded-xl border border-slate-200 bg-white text-slate-600 font-semibold text-sm transition-all hover:bg-slate-50 active:scale-[0.98] flex items-center justify-center gap-2.5"
                  >
                    <ArrowLeft size={16} /> Back to Login
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-red-50 border border-red-100 text-red-800 flex items-center gap-3 p-4 rounded-xl"
                    >
                      <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <ShieldAlert className="w-4 h-4 text-red-500" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-0.5">{t('loginErrorTitle')}</h4>
                        <p className="text-xs font-medium text-red-700">{error}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4">
                  <div className="relative mt-2">
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder=" "
                      className="peer w-full bg-transparent border border-slate-300 rounded-full px-7 py-5 text-base tracking-wider text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                    <label
                      htmlFor="login-email"
                      className={`absolute left-7 px-1 bg-white transition-all duration-200 pointer-events-none peer-focus:-top-2.5 peer-focus:text-[12px] peer-focus:text-blue-500 ${email ? '-top-2.5 text-[12px] text-slate-500' : 'top-5 text-base text-slate-400'
                        }`}
                    >
                      Email address
                    </label>
                  </div>

                  <div className="relative mt-4">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder=" "
                      className="peer w-full bg-transparent border border-slate-300 rounded-full pl-7 pr-12 py-5 text-base tracking-wider text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                    />
                    <label
                      htmlFor="login-password"
                      className={`absolute left-7 px-1 bg-white transition-all duration-200 pointer-events-none peer-focus:-top-2.5 peer-focus:text-[12px] peer-focus:text-blue-500 ${password ? '-top-2.5 text-[12px] text-slate-500' : 'top-5 text-base text-slate-400'
                        }`}
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col items-center gap-4">
                  <button
                    type="submit"
                    disabled={loading || !!lockoutEnd}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm overflow-hidden transition-all hover:shadow-lg hover:shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>{t('loginSubmit')} <ChevronRight size={16} /></>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setError(''); setMessage(''); }}
                    className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 hover:underline transition-colors"
                  >
                    {t('loginForgotPassword')}
                  </button>
                </div>

                <div className="flex justify-between items-center pt-4 px-1 text-[10px] font-semibold tracking-wider text-slate-300 uppercase">
                  <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-indigo-400" /> Encrypted</span>
                  <span className="flex items-center gap-1.5"><Globe2 size={12} className="text-blue-400" /> Secure System</span>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-center space-y-5"
        >
          {/* Language Toggle */}
          <div className="inline-flex items-center rounded-lg p-0.5 bg-slate-100 border border-slate-200/50">
            <button
              onClick={() => setLanguage('en')}
              className={`px-4 py-1.5 rounded-md text-[11px] font-semibold transition-all ${language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
            >
              ENGLISH
            </button>
            <button
              onClick={() => setLanguage('am')}
              className={`px-4 py-1.5 rounded-md text-[11px] font-semibold transition-all ${language === 'am' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-700'}`}
            >
              አማርኛ
            </button>
          </div>

          <p className="text-slate-400 text-xs text-center mt-2">
            {!showForgotPassword ? (
              <span>{t('loginForget')}</span>
            ) : null}
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
