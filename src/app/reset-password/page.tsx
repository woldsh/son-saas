'use client';

import { useState, FormEvent, Suspense, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LockKeyhole,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Building2,
  ChevronRight,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  KeyRound
} from 'lucide-react';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const { confirmResetPassword } = useAuth();
  const router = useRouter();

  // Redirect to login if user eventually navigates away or successfully resets
  useEffect(() => {
    if (success) {
      const timeout = setTimeout(() => {
        router.push('/login');
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [success, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!oobCode) {
      setError('Invalid or missing Reset Token. Please request a new password reset link from the login page.');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please ensure both fields contain the exact same password.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await confirmResetPassword(oobCode, newPassword);
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to securely update password. The link might have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6 bg-slate-50 selection:bg-indigo-500/20">

      {/* Subtle Background Accents */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[200px] -right-[200px] w-[600px] h-[600px] rounded-full bg-indigo-50/60 blur-[120px]" />
        <div className="absolute -bottom-[150px] -left-[150px] w-[500px] h-[500px] rounded-full bg-blue-50/50 blur-[100px]" />
        {/* Dot grid */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[460px]"
      >
        {/* Institutional Branding Above Card */}
        <div className="flex flex-col items-center mb-10">
          <Link href="/login" className="group flex flex-col items-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/20 mb-5"
            >
              <Building2 className="text-white w-7 h-7" />
            </motion.div>
            <div className="text-center">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1.5">
                DMU <span className="text-indigo-600 font-medium">Property System</span>
              </h2>
              <span className="text-[10px] text-slate-400 font-semibold tracking-[0.3em] uppercase">Secure Password Reset</span>
            </div>
          </Link>
        </div>

        {/* Clean White Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 md:p-10 relative overflow-hidden">
          
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />

          {success ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-6"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Password Updated!</h3>
              <p className="text-slate-500 text-sm mb-8">
                Your password has been successfully reset. You can now use your new password to access the system.
              </p>
              
              <Link 
                href="/login"
                className="inline-flex w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-emerald-600/25 active:scale-[0.98] items-center justify-center gap-2.5"
              >
                Return to Login <ChevronRight size={16} />
              </Link>
            </motion.div>
          ) : (
            <div className="relative z-10">
              <div className="mb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-1.5 flex items-center gap-2.5">
                  Set New Password
                  <KeyRound size={20} className="text-indigo-500" />
                </h3>
                <p className="text-slate-400 text-sm">
                  Please enter and confirm your new strong password below.
                </p>
              </div>

              {!oobCode && (
                <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm">No valid reset token found in the URL. Please ensure you clicked the exact link from your email.</p>
                </div>
              )}

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
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-0.5">Reset Error</h4>
                        <p className="text-xs font-medium text-red-700">{error}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">New Password</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                        <LockKeyhole size={18} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white transition-all duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors p-1"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Confirm Password</label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors">
                        <Lock size={18} />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Retype your new password"
                        required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 focus:bg-white transition-all duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600 transition-colors p-1"
                      >
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={loading || !oobCode}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm overflow-hidden transition-all hover:shadow-lg hover:shadow-indigo-600/25 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2.5"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>Commit New Password <ChevronRight size={16} /></>
                    )}
                  </button>

                  <Link
                    href="/login"
                    className="w-full h-12 rounded-xl border border-slate-200 bg-white text-slate-600 font-semibold text-sm transition-all hover:bg-slate-50 active:scale-[0.98] flex items-center justify-center gap-2.5"
                  >
                    <ArrowLeft size={16} /> Back to Login
                  </Link>
                </div>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
