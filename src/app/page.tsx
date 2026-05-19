'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import {
  Menu,
  X,
  Sparkles,
  ArrowRight,
  Box,
  FileText,
  Layers,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  Globe,
  Shuffle,
  Bot
} from 'lucide-react';

import { useLanguage } from '@/contexts/LanguageContext';

export default function LandingPage() {
  const { language, setLanguage, t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }
    })
  };

  const features = [
    { icon: <Box size={18} />, title: t('feat_asset_title'), desc: t('feat_asset_desc'), color: 'text-indigo-600 bg-indigo-50' },
    { icon: <FileText size={18} />, title: t('feat_model_title'), desc: t('feat_model_desc'), color: 'text-blue-600 bg-blue-50' },
    { icon: <Layers size={18} />, title: t('feat_req_title'), desc: t('feat_req_desc'), color: 'text-violet-600 bg-violet-50' },
    { icon: <LayoutDashboard size={18} />, title: t('feat_dash_title'), desc: t('feat_dash_desc'), color: 'text-fuchsia-600 bg-fuchsia-50' },
    { icon: <ShieldCheck size={18} />, title: t('feat_role_title'), desc: t('feat_role_desc'), color: 'text-emerald-600 bg-emerald-50' },
    { icon: <Globe size={18} />, title: t('feat_lang_title'), desc: t('feat_lang_desc'), color: 'text-amber-600 bg-amber-50' },
    { icon: <Shuffle size={18} />, title: t('feat_transfer_title'), desc: t('feat_transfer_desc'), color: 'text-rose-600 bg-rose-50' },
    { icon: <Bot size={18} />, title: t('feat_other_title'), desc: t('feat_other_desc'), color: 'text-cyan-600 bg-cyan-50' },
  ];

  return (
    <div className="min-h-screen w-screen overflow-x-hidden overflow-y-auto bg-slate-50 text-slate-900 flex flex-col">

      {/* ===== NAVBAR ===== */}
      <nav className="w-full z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-md shadow-slate-200/50 overflow-hidden border border-slate-100 transition-transform group-hover:scale-105 relative">
                <Image src="/logo.png" alt="DMU Logo" fill sizes="40px" className="object-contain p-0.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-slate-900 leading-tight">{t('landing_dmu')}</span>
                <span className="text-[11px] font-semibold text-indigo-600 leading-tight">{t('landing_property')}</span>
              </div>
            </Link>

            {/* Desktop Right */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex items-center rounded-lg p-0.5 bg-slate-100/80 border border-slate-200/50">
                <button onClick={() => setLanguage('en')} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>EN</button>
                <button onClick={() => setLanguage('am')} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${language === 'am' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>አማ</button>
              </div>
              <Link href="/login" className="ml-2 flex items-center gap-1.5 px-5 py-2 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 active:scale-[0.97] transition-all shadow-lg shadow-indigo-600/20">
                {t('login')} <ArrowRight size={14} />
              </Link>
            </div>

            <button className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-700" onClick={() => setIsMenuOpen(true)}>
              <Menu size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* ===== MAIN CONTENT — single viewport ===== */}
      <main className="flex-1 flex items-center justify-center relative w-full py-24 lg:py-0">

        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full blur-[160px] bg-indigo-100/60" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full blur-[140px] bg-violet-100/40" />
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 lg:px-8 relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Left — Hero Content */}
            <motion.div initial="hidden" animate="visible" className="flex flex-col items-start">

              <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold mb-5">
                <Sparkles size={13} className="text-indigo-500" />
                <span>{t('landing_next_gen')}</span>
              </motion.div>

              <motion.h1 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-tight text-slate-900 leading-[1.15] mb-4">
                {t('landing_dmu')}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
                  {t('landing_property')}
                </span>{' '}
                {t('landing_system')}
              </motion.h1>

              <motion.p variants={fadeUp} custom={2} className="text-base text-slate-600 font-medium mb-6 max-w-md leading-relaxed">
                {t('landing_hero_desc')}
              </motion.p>

              <motion.div variants={fadeUp} custom={3} className="flex items-center gap-3 mb-8">
                <Link href="/login" className="px-6 py-3 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/20 active:scale-[0.97] transition-all flex items-center gap-2">
                  {t('landing_access_system')} <ArrowRight size={16} />
                </Link>
              </motion.div>

              {/* Project Expression Card */}
              <motion.div variants={fadeUp} custom={4} className="mt-4 p-5 rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200/60 shadow-sm w-full max-w-md">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <Sparkles size={20} className="text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">{t('landing_built_for')}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {t('landing_built_desc')}
                    </p>
                  </div>
                </div>
              </motion.div>

            </motion.div>

            {/* Right — Feature Cards Grid */}
            <motion.div initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  custom={i + 2}
                  className="group bg-white p-4.5 rounded-2xl border border-slate-200/60 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-default flex flex-col justify-between"
                >
                  <div>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2.5 ${f.color}`}>
                      {f.icon}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1">{f.title}</h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

          </div>
        </div>
      </main>

      {/* ===== BOTTOM BAR ===== */}
      <footer className="w-full bg-white border-t border-slate-200/50 py-3 px-6 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-400 font-medium">
          <span>&copy; {new Date().getFullYear()} {t('landing_dmu')}</span>
          <div className="flex items-center gap-1.5">
            <Zap size={12} className="text-indigo-400" />
            <span>{t('footer_powered_by')}</span>
          </div>
        </div>
      </footer>

      {/* ===== MOBILE NAV ===== */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex flex-col bg-white">
            <div className="flex justify-end p-5">
              <button onClick={() => setIsMenuOpen(false)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 text-slate-700">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-8 pb-20">
              <div className="flex items-center rounded-xl p-1 bg-slate-100">
                <button onClick={() => setLanguage('en')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>EN</button>
                <button onClick={() => setLanguage('am')} className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${language === 'am' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>አማ</button>
              </div>
              <Link href="/login" onClick={() => setIsMenuOpen(false)} className="px-12 py-4 bg-indigo-600 text-white font-bold rounded-xl text-lg shadow-xl shadow-indigo-600/25 active:scale-95 transition-all">
                {t('login')}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
