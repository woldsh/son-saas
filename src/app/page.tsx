'use client';

// Triggering re-compile after directory structure cleanup
import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  GraduationCap,
  Menu,
  X,
  Lock,
  ArrowUpRight,
  Layers,
  Cpu,
  MousePointer2,
  BarChart3,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { FaFacebook, FaTwitter, FaLinkedin, FaYoutube } from 'react-icons/fa';

import { useLanguage } from '@/contexts/LanguageContext';

export default function LandingPage() {
  const { language, setLanguage, t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fadeUp = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.7, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
    })
  };

  const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12 } }
  };

  const slideUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* Subtle Background Accents */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[300px] -right-[300px] w-[800px] h-[800px] rounded-full blur-[200px] bg-indigo-50" />
        <div className="absolute -bottom-[200px] -left-[200px] w-[600px] h-[600px] rounded-full blur-[180px] bg-blue-50/80" />
      </div>

      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 w-full z-[100] bg-white/80 backdrop-blur-2xl border-b border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3.5 group">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white shadow-lg shadow-slate-200 transition-all duration-300 group-hover:scale-105 overflow-hidden border border-slate-100">
                <img src="/logo.png" alt="DMU Logo" className="w-full h-full object-contain p-1" />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-black tracking-tight leading-none text-slate-900">
                  Burie Campus <span className="text-indigo-600 font-medium">Property System</span>
                </span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden lg:flex items-center gap-1">
              {[
                { label: t('navigation_home') || 'Home', href: '#' },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="px-4 py-2 text-[13px] font-medium rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
                >
                  {item.label}
                </Link>
              ))}

              <div className="mx-3 w-px h-5 bg-slate-200" />

              {/* Language Toggle */}
              <div className="flex items-center rounded-lg p-0.5 bg-slate-100">
                <button
                  onClick={() => setLanguage('en')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${language === 'en'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-slate-700'
                    }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('am')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${language === 'am'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-700'
                    }`}
                >
                  አማ
                </button>
              </div>

              <Link
                href="/login"
                className="ml-3 px-5 py-2.5 bg-indigo-600 text-white text-[13px] font-semibold rounded-lg hover:bg-indigo-700 active:scale-[0.97] transition-all shadow-lg shadow-indigo-600/20"
              >
                {t('login')}
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-700 transition-all"
              onClick={() => setIsMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Hero Background Decorations */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Dot grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
          {/* Gradient orbs */}
          <div className="absolute top-[15%] right-[10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-100/60 to-blue-50/40 blur-[100px]" />
          <div className="absolute bottom-[10%] left-[5%] w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-violet-100/40 to-cyan-50/30 blur-[80px]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10 pt-32 pb-20 w-full">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Left Content */}
            <motion.div
              initial="hidden"
              animate="visible"
              className="space-y-8 flex flex-col items-center"
            >
              <motion.div
                variants={fadeUp}
                custom={0}
                className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full text-xs font-semibold bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-600 border border-indigo-100/80 shadow-sm"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600" />
                </span>
                {t('heroTag')}
                <Sparkles size={12} className="text-indigo-400" />
              </motion.div>

              <motion.h1
                variants={fadeUp}
                custom={1}
                className="text-5xl sm:text-6xl lg:text-[4.5rem] font-extrabold tracking-tight leading-[1.05] text-slate-900"
              >
                {t('heroStreamline')}{' '}
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent bg-[length:200%_100%] animate-[gradientShift_4s_ease_infinite]">
                  {t('heroProperty')}
                </span>
                <br />
                <span className="text-[0.8em] font-medium opacity-80">{t('heroCampus')}</span>
              </motion.h1>

              <motion.p
                variants={fadeUp}
                custom={2}
                className="text-lg leading-relaxed max-w-2xl text-slate-500"
              >
                {t('heroSub')}
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/login"
                  className="group px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl flex items-center gap-3 shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-[0.97] transition-all duration-300"
                >
                  {t('getStarted')}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>

              </motion.div>


            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-slate-300"
        >
          <div className="w-5 h-8 rounded-full border-2 border-current flex items-start justify-center p-1">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-1 h-1.5 rounded-full bg-current"
            />
          </div>
        </motion.div>
      </section>

      {/* ===== MOBILE NAV ===== */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex flex-col bg-white">
            <div className="flex justify-end p-6">
              <button onClick={() => setIsMenuOpen(false)} className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-100 text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-6 pb-20">
              {[
                { label: 'Home', href: '#' },
              ].map((item, idx) => (
                <motion.a key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * idx }}
                  href={item.href} onClick={() => setIsMenuOpen(false)}
                  className="text-3xl font-bold tracking-tight text-slate-900 hover:text-indigo-600 transition-colors">
                  {item.label}
                </motion.a>
              ))}
              <div className="flex items-center gap-3 mt-6">
                <div className="flex items-center rounded-lg p-0.5 bg-slate-100">
                  <button onClick={() => setLanguage('en')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>EN</button>
                  <button onClick={() => setLanguage('am')} className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${language === 'am' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>አማ</button>
                </div>
              </div>
              <Link href="/login" onClick={() => setIsMenuOpen(false)} className="mt-4 px-10 py-4 bg-indigo-600 text-white font-semibold rounded-xl text-lg shadow-xl shadow-indigo-600/25">
                {t('login')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
