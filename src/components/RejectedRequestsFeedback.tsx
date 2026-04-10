'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, writeBatch, getDocs, doc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, AlertCircle, XCircle, Search, Package, Calendar } from 'lucide-react';

interface RequestItem {
    materialName: string;
    quantity: number;
    unit: string;
}

interface RequestHistory {
    status: string;
    note: string;
    timestamp: string;
    user: string;
    userName?: string;
    userRole?: string;
    rejectorRole?: string;
}

interface RejectedRequest {
    id: string;
    createdAt: any;
    items: RequestItem[];
    history: RequestHistory[];
    status: string;
    isAdjusted?: boolean;
    userRole?: string;
    userName?: string;
}

export default function RejectedRequestsFeedback() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [requests, setRequests] = useState<RejectedRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'adjusted' | 'rejected'>('adjusted');
    
    // Mark notifications as read when viewing this page
    useEffect(() => {
        if (!db || !user?.uid) return;

        const markAsRead = async () => {
            const q = query(
                collection(db!, 'Request_materials'),
                where('requesterId', '==', user.uid),
                where('isFeedbackSeen', '==', false)
            );

            const snapshot = await getDocs(q);
            if (snapshot.empty) return;

            const batch = writeBatch(db!);
            snapshot.docs.forEach((doc) => {
                batch.update(doc.ref, { isFeedbackSeen: true });
            });

            try {
                await batch.commit();
            } catch (error) {
                console.error("Error marking feedback as read:", error);
            }
        };

        markAsRead();
    }, [user?.uid]);

    useEffect(() => {
        if (!user || !db) return;

        const requestsRef = collection(db, 'Request_materials');
        const q = query(
            requestsRef,
            where('requesterId', '==', user.uid),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let requestList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as RejectedRequest[];

            // Filter for rejected OR adjusted
            requestList = requestList.filter(r => r.status === 'rejected' || r.isAdjusted === true);

            // Sort by latest first
            requestList.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.()?.getTime() || 0;
                const dateB = b.createdAt?.toDate?.()?.getTime() || 0;
                return dateB - dateA;
            });

            // Auto-clean old records from Database if there are more than 5 rejected (hard delete) or adjusted (soft delete so we don't break clerk view)
            const rejectedList = requestList.filter(r => r.status === 'rejected' && !r.isAdjusted);
            if (rejectedList.length > 5 && db) {
                const batch = writeBatch(db);
                rejectedList.slice(5).forEach(r => {
                    batch.delete(doc(db, 'Request_materials', r.id));
                });
                batch.commit().catch(console.error);
            }

            setRequests(requestList);
            // Auto switch to rejected if no adjusted exists but rejected exists
            const hasAdjusted = requestList.some(r => r.isAdjusted === true);
            if (!hasAdjusted && requestList.some(r => r.status === 'rejected')) {
                setActiveTab('rejected');
            }
            
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const filteredRequests = requests.filter(r => {
        return r.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.items.some(item => item.materialName.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    const adjustedRequests = filteredRequests.filter(r => r.isAdjusted === true).slice(0, 5);
    const rejectedRequests = filteredRequests.filter(r => r.status === 'rejected' && r.isAdjusted !== true).slice(0, 5);

    const currentTabRequests = activeTab === 'adjusted' ? adjustedRequests : rejectedRequests;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                        <MessageSquare className="text-white" size={24} strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Feedback & Decisions</h1>
                        <p className="text-slate-500 font-medium mt-1 text-sm">
                            Review coordinator responses to your material requests.
                        </p>
                    </div>
                </div>

                <div className="relative w-full md:w-80 z-10">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search feedback..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-px">
                <button
                    onClick={() => setActiveTab('adjusted')}
                    className={`pb-4 px-2 text-sm font-bold transition-all relative ${
                        activeTab === 'adjusted' 
                        ? 'text-blue-700' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <AlertCircle size={16} className={activeTab === 'adjusted' ? 'text-blue-600' : 'text-slate-400'} />
                        Quantity Adjustments
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'adjusted' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {adjustedRequests.length}
                        </span>
                    </div>
                    {activeTab === 'adjusted' && (
                        <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('rejected')}
                    className={`pb-4 px-2 text-sm font-bold transition-all relative ${
                        activeTab === 'rejected' 
                        ? 'text-red-700' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <XCircle size={16} className={activeTab === 'rejected' ? 'text-red-600' : 'text-slate-400'} />
                        Rejected Requests
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                            {rejectedRequests.length}
                        </span>
                    </div>
                    {activeTab === 'rejected' && (
                        <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600 rounded-t-full" />
                    )}
                </button>
            </div>

            {/* Content List */}
            <div className="space-y-6">
                <AnimatePresence mode="popLayout">
                    {currentTabRequests.length > 0 ? (
                        currentTabRequests.map((request, index) => {
                            const feedbackEntry = request.history?.filter(h => h.status === 'rejected' || h.note.includes('adjusted')).pop();

                            const rawNote = feedbackEntry?.note || 'No reasoning provided.';
                            const feedbackNote = rawNote
                                .replace(/^Quantity adjusted by .*?\. Note:\s*/i, '')
                                .replace(/^Quantity adjusted by .*?\s*/i, '')
                                .replace(/^Note:\s*/i, '')
                                .trim();
                            
                            let feedbackUser = feedbackEntry?.userRole || feedbackEntry?.rejectorRole || feedbackEntry?.userName;
                            if (!feedbackUser || /^[a-zA-Z0-9]{20,}$/.test(feedbackUser)) {
                                if (feedbackNote.toLowerCase().includes('department head')) feedbackUser = 'Department Head';
                                else if (feedbackNote.toLowerCase().includes('academic coordinator')) feedbackUser = 'Academic Coordinator';
                                else if (feedbackNote.toLowerCase().includes('managing director')) feedbackUser = 'Managing Director';
                                else if (feedbackNote.toLowerCase().includes('stock clerk')) feedbackUser = 'Stock Clerk';
                                else if (feedbackEntry?.status === 'rejected') feedbackUser = 'the Approver';
                                else feedbackUser = 'the Coordinator';
                            }
                            
                            const feedbackDate = feedbackEntry?.timestamp;
                            const isAdjustment = request.isAdjusted;
                            const statusColor = isAdjustment ? 'blue' : 'red';

                            return (
                                <motion.div
                                    key={request.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                                >
                                    <div className="p-6 flex flex-col lg:flex-row gap-6">

                                        {/* Left Side: Request Info */}
                                        <div className="flex-1 space-y-4">
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-bold uppercase tracking-widest border border-slate-200">
                                                        REQ #{request.id.slice(0, 8)}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                                    <Calendar size={14} />
                                                    {request.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {request.items.map((item, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md">
                                                            <Package size={14} className="text-slate-400" />
                                                            <span className="text-sm font-semibold text-slate-800">{item.materialName}</span>
                                                            <span className="text-xs font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                                                                {item.quantity} {item.unit}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Side: Feedback Box */}
                                        <div className="lg:w-[400px] flex-shrink-0">
                                            <div className={`h-full border border-${statusColor}-100 bg-${statusColor}-50/30 p-5 rounded-xl`}>
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-8 h-8 rounded-lg bg-${statusColor}-100 flex items-center justify-center flex-shrink-0 mt-0.5 border border-${statusColor}-200`}>
                                                        {isAdjustment ? <AlertCircle className="text-blue-600" size={16} /> : <XCircle className="text-red-600" size={16} />}
                                                    </div>
                                                    <div className="w-full">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className={`text-sm font-bold text-${statusColor}-800 tracking-wide`}>
                                                                {isAdjustment ? 'Quantity Adjustment' : 'Request Rejection'}
                                                            </h4>
                                                            {feedbackDate && (
                                                                <span className="text-xs font-semibold text-slate-500">
                                                                    {new Date(feedbackDate).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                                            <p className="text-slate-700 text-sm font-medium italic">
                                                                {isAdjustment ? (
                                                                    <span>"Adjusted by <span className="font-bold text-slate-900 not-italic">{feedbackUser}</span>: <span className="text-blue-700 not-italic">{feedbackNote}</span>"</span>
                                                                ) : (
                                                                    <span>"Rejected by <span className="font-bold text-slate-900 not-italic">{feedbackUser}</span>: reason is "<span className="text-red-700 not-italic">{feedbackNote}</span>""</span>
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </motion.div>
                            );
                        })
                    ) : (
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            className="flex flex-col items-center justify-center py-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm"
                        >
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                                <AlertCircle className="text-slate-300 w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-1">
                                No {activeTab === 'adjusted' ? 'Adjustments' : 'Rejections'} Found
                            </h3>
                            <p className="text-slate-500 text-sm max-w-sm">
                                {activeTab === 'adjusted' 
                                    ? "There are no quantity adjustments on your requests right now." 
                                    : "You don't have any rejected requests right now. All is well!"}
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
