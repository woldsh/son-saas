'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { MessageSquare, Send, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FeedbackForm() {
    const { user, userRole, department, userData } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        type: 'suggestion',
        subject: '',
        message: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.subject.trim() || !formData.message.trim()) {
            setError('Please fill in both subject and message.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            await addDoc(collection(db, 'system_feedback'), {
                userId: user?.uid || 'unknown',
                userName: userData?.displayName || user?.email || 'Unknown User',
                userRole: userRole || 'unknown',
                department: department || 'unknown',
                type: formData.type,
                subject: formData.subject,
                message: formData.message,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            setIsSuccess(true);
            setFormData({ type: 'suggestion', subject: '', message: '' });

            setTimeout(() => {
                setIsSuccess(false);
            }, 5000);
        } catch (err) {
            console.error('Error submitting feedback:', err);
            setError('Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/60 overflow-hidden relative">
                {/* Decorative Background */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50/50 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-50/50 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />

                <div className="relative p-8 md:p-12">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100/50">
                            <MessageSquare className="text-blue-600" size={24} strokeWidth={2} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Feedback</h2>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Help us improve your experience</p>
                        </div>
                    </div>

                    <div className="w-16 h-1 bg-blue-600/20 rounded-full mb-10" />

                    <AnimatePresence mode="wait">
                        {isSuccess ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[400px]"
                            >
                                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                                    <CheckCircle className="text-emerald-500 w-10 h-10" strokeWidth={2.5} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-3">Feedback Received!</h3>
                                <p className="text-slate-500 font-medium max-w-md">
                                    Thank you for your valuable feedback. It has been forwarded to the system administration team for review.
                                </p>
                                <button
                                    onClick={() => setIsSuccess(false)}
                                    className="mt-8 px-6 py-3 bg-white text-emerald-600 font-bold uppercase tracking-widest text-[11px] rounded-xl border border-emerald-200 hover:bg-emerald-600 hover:text-white transition-all duration-300"
                                >
                                    Submit Another
                                </button>
                            </motion.div>
                        ) : (
                            <motion.form
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onSubmit={handleSubmit}
                                className="space-y-8 relative z-10"
                            >
                                {error && (
                                    <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 text-sm font-medium">
                                        <AlertCircle size={18} className="shrink-0" />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="space-y-6">
                                    {/* Feedback Type Selection */}
                                    <div>
                                        <label className="block text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3 ml-1">
                                            Feedback Type
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {[
                                                { id: 'suggestion', label: 'Suggestion', icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-200' },
                                                { id: 'issue', label: 'Report Issue', icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-500', border: 'border-rose-200' },
                                                { id: 'general', label: 'General', icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-500', border: 'border-indigo-200' }
                                            ].map((type) => {
                                                const Icon = type.icon;
                                                const isSelected = formData.type === type.id;
                                                return (
                                                    <button
                                                        key={type.id}
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, type: type.id })}
                                                        className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 ${isSelected
                                                                ? `${type.border} bg-white shadow-md scale-[1.02]`
                                                                : 'border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 text-slate-400'
                                                            }`}
                                                    >
                                                        {isSelected && (
                                                            <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${type.bg} shadow-sm animate-pulse`} />
                                                        )}
                                                        <Icon className={`mb-2 w-6 h-6 ${isSelected ? type.color : 'text-slate-400'}`} strokeWidth={maxStroke(isSelected)} />
                                                        <span className={`text-[12px] font-semibold tracking-wide ${isSelected ? 'text-slate-800' : 'text-slate-500'}`}>
                                                            {type.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Subject */}
                                    <div>
                                        <label htmlFor="subject" className="block text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2 ml-1">
                                            Subject
                                        </label>
                                        <input
                                            id="subject"
                                            type="text"
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                            placeholder="Brief summary of your feedback"
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all"
                                            maxLength={100}
                                        />
                                    </div>

                                    {/* Message */}
                                    <div>
                                        <div className="flex justify-between items-end mb-2 ml-1 mr-1">
                                            <label htmlFor="message" className="block text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">
                                                Detailed Message
                                            </label>
                                            <span className="text-[10px] font-bold text-slate-300">
                                                {formData.message.length}/1000
                                            </span>
                                        </div>
                                        <textarea
                                            id="message"
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            placeholder="Please provide as much detail as possible..."
                                            rows={6}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[15px] font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white transition-all resize-none"
                                            maxLength={1000}
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || !formData.subject.trim() || !formData.message.trim()}
                                        className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black uppercase text-[12px] tracking-widest transition-all duration-300 shadow-xl ${isSubmitting || !formData.subject.trim() || !formData.message.trim()
                                                ? 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed'
                                                : 'bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-500 hover:shadow-blue-500/30 hover:-translate-y-0.5 active:scale-95'
                                            }`}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                Submit Feedback
                                                <Send size={16} strokeWidth={2.5} />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

// Helper to adjust stroke width based on selection
function maxStroke(isSelected: boolean) {
    return isSelected ? 2.5 : 2;
}
