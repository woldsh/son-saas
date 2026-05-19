'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, onSnapshot
} from 'firebase/firestore';
import {
    FiSend, FiCheckSquare, FiUser, FiMail,
    FiBox, FiClock, FiCheckCircle, FiXCircle,
    FiPackage
} from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserReportItem {
    id: string;
    requestId: string;
    requesterId: string;
    requesterName: string;
    department: string;
    materialId: string;
    materialName: string;
    materialCode: string;
    quantity: number;
    unit: string;
    materialType: string;
    condition: string;
    image?: string;
    acceptedAt?: string;
    status: string;
}

interface TransferRecord {
    id: string;
    receiverName: string;
    receiverEmail: string;
    materials: any[];
    status: string;
    reason: string;
    createdAt: any;
}

export default function TransferInitiator() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [materials, setMaterials] = useState<UserReportItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [receiverName, setReceiverName] = useState('');
    const [receiverEmail, setReceiverEmail] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [transfers, setTransfers] = useState<TransferRecord[]>([]);

    // User Search State
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        if (!user || !db) { setLoading(false); return; }

        const q = query(
            collection(db!, 'User-Report'),
            where('requesterId', '==', user.uid),
            where('status', '==', 'accepted')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserReportItem));
            setMaterials(data);
            setLoading(false);
        }, () => setLoading(false));

        const fetchTransfers = async () => {
            if (!db) return;
            const tq = query(collection(db!, 'Material_transfers'), where('senderId', '==', user.uid), orderBy('createdAt', 'desc'));
            const tSnapshot = await getDocs(tq);
            setTransfers(tSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as TransferRecord)));
        };
        fetchTransfers();

        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const searchUsers = async () => {
            if (!receiverName.trim() || receiverName.length < 2) { setSearchResults([]); return; }
            setIsSearching(true);
            try {
                const snapshot = await getDocs(query(collection(db!, 'users')));
                const filtered = snapshot.docs
                    .map(uDoc => ({ id: uDoc.id, ...uDoc.data() }))
                    .filter((u: any) =>
                        (u.id !== user?.uid && u.email !== user?.email) && (
                            u.displayName?.toLowerCase().includes(receiverName.toLowerCase()) ||
                            u.email?.toLowerCase().includes(receiverName.toLowerCase())
                        )
                    ).slice(0, 5);
                setSearchResults(filtered);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally { setIsSearching(false); }
        };
        const tid = setTimeout(searchUsers, 300);
        return () => clearTimeout(tid);
    }, [receiverName, user]);

    const handleSelectUser = (u: any) => {
        setReceiverName(u.displayName || '');
        setReceiverEmail(u.email || '');
        setShowResults(false);
    };

    const toggleMaterial = (id: string) => {
        const s = new Set(selectedIds);
        s.has(id) ? s.delete(id) : s.add(id);
        setSelectedIds(s);
    };

    const selectedMaterials = materials.filter(m => selectedIds.has(m.id));

    const handleSubmit = async () => {
        if (!user || !db || selectedMaterials.length === 0 || !receiverName || !receiverEmail) return;
        setSubmitting(true);
        try {
            await addDoc(collection(db!, 'Material_transfers'), {
                senderId: user.uid,
                senderName: user.displayName || 'Unknown',
                senderEmail: user.email,
                receiverName: receiverName.trim(),
                receiverEmail: receiverEmail.trim().toLowerCase(),
                receiverId: null,
                materials: selectedMaterials.map(m => ({
                    name: m.materialName, materialCode: m.materialCode,
                    quantity: m.quantity, unit: m.unit,
                    materialType: m.materialType, condition: m.condition,
                    image: m.image || '', userReportId: m.id,
                })),
                status: 'pending_receiver',
                reason: reason.trim(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                approvedByReceiverAt: null,
                completedAt: null,
            });
            setSubmitted(true);
            setSelectedIds(new Set());
            setReceiverName('');
            setReceiverEmail('');
            setReason('');
            const tq = query(collection(db!, 'Material_transfers'), where('senderId', '==', user.uid), orderBy('createdAt', 'desc'));
            const tSnap = await getDocs(tq);
            setTransfers(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as TransferRecord)));
            setTimeout(() => setSubmitted(false), 4000);
        } catch (error) {
            console.error('Error submitting transfer:', error);
        } finally { setSubmitting(false); }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending_receiver': return { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: FiClock };
            case 'approved_by_receiver': return { label: 'Approved', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: FiCheckCircle };
            case 'rejected_by_receiver': return { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', icon: FiXCircle };
            case 'completed': return { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FiCheckCircle };
            default: return { label: status, color: 'bg-slate-50 text-slate-700 border-slate-200', icon: FiClock };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <AnimatePresence>
                {submitted && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                        <FiCheckCircle className="text-emerald-600 text-xl" />
                        <p className="text-sm font-semibold text-emerald-800">{t('transfer_initiated_success') || "Transfer initiated successfully!"}</p>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Material Selection */}
                <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                            <FiPackage className="text-blue-600" />
                            <h2 className="text-lg font-bold text-slate-800">{t('my_assets_to_transfer') || "Select Assets to Transfer"}</h2>
                        </div>
                        {selectedIds.size > 0 && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold">
                                {selectedIds.size} Selected
                            </span>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        {materials.length === 0 ? (
                            <div className="p-12 text-center">
                                <FiBox className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                                <p className="text-slate-500 font-medium">{t('no_assets_in_custody') || "No active assets to transfer."}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                {materials.map((mat) => {
                                    const isSelected = selectedIds.has(mat.id);
                                    return (
                                        <div key={mat.id} onClick={() => toggleMaterial(mat.id)}
                                            className={`p-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'}`}>
                                                {isSelected && <FiCheckSquare size={14} />}
                                            </div>
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                {mat.image ? <img src={mat.image} alt="" className="w-full h-full object-cover rounded-lg" /> : <FiBox className="text-slate-400" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-bold text-slate-900 truncate">{mat.materialName}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-mono">{mat.materialCode}</span>
                                                    <span className="text-[10px] text-slate-400">{mat.quantity} {mat.unit}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Receiver Info */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 text-slate-800">
                            <FiUser className="text-blue-600" />
                            <h2 className="font-bold">{t('recipient_details') || "Recipient Details"}</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5 relative">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('receiver_name') || "Receiver Name"}</label>
                                <input type="text" value={receiverName}
                                    onChange={(e) => { setReceiverName(e.target.value); setShowResults(true); }}
                                    onFocus={() => setShowResults(true)}
                                    placeholder={t('search_user_placeholder') || "Search user..."}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm font-semibold"
                                />
                                {isSearching && <Loader2 className="absolute right-3 top-9 w-4 h-4 text-blue-500 animate-spin" />}

                                <AnimatePresence>
                                    {showResults && searchResults.length > 0 && (
                                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                                            className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                                            {searchResults.map((u) => (
                                                <button key={u.id} onClick={() => handleSelectUser(u)}
                                                    className="w-full p-3 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left">
                                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><FiUser size={14} /></div>
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-900">{u.displayName}</p>
                                                        <p className="text-[10px] text-slate-500">{u.email}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('receiver_email') || "Receiver Email"}</label>
                                <div className="relative">
                                    <FiMail className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
                                    <input type="email" value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)}
                                        placeholder="email@example.com"
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm font-semibold"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('reason') || "Reason"}</label>
                                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
                                    placeholder={t('transfer_reason_placeholder') || "Why are you transferring?"}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm font-semibold resize-none"
                                />
                            </div>

                            <button onClick={handleSubmit}
                                disabled={submitting || selectedIds.size === 0 || !receiverEmail}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                                {submitting ? <Loader2 className="animate-spin" size={18} /> : <FiSend size={18} />}
                                {t('initiate_transfer') || "Initiate Transfer"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* History */}
            {transfers.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <FiClock className="text-blue-600" />
                        <h2 className="font-bold text-slate-800">{t('transfer_history') || "Transfer History"}</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {transfers.map((tr) => {
                            const badge = getStatusBadge(tr.status);
                            const Icon = badge.icon;
                            return (
                                <div key={tr.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <span className="text-sm font-bold text-slate-900">To: {tr.receiverName}</span>
                                        <div className="flex flex-wrap gap-1">
                                            {tr.materials.map((m: any, i: number) => (
                                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-slate-500">
                                                    {m.name} (x{m.quantity})
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1.5 ${badge.color}`}>
                                        <Icon size={12} /> {badge.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
