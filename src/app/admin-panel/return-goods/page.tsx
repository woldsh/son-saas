'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, doc, getDoc, onSnapshot
} from 'firebase/firestore';
import {
    FiRotateCcw, FiSend, FiCheckSquare, FiUser, FiMail,
    FiFileText, FiBox, FiClock, FiCheckCircle, FiXCircle, FiArrowRight,
    FiPackage, FiTag
} from 'react-icons/fi';
import { Loader2, Search, UserCheck } from 'lucide-react';
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
    updatedAt?: any;
}

export default function ReturnGoodsPage() {
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
    const [userName, setUserName] = useState('');
    
    // User Search State
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    useEffect(() => {
        if (!user || !db) return;

        const fetchUserName = async () => {
            if (!db) return;
            const userDoc = await getDoc(doc(db!, 'users', user.uid));
            if (userDoc.exists()) {
                setUserName(userDoc.data().displayName || '');
            }
        };
        fetchUserName();

        // Real-time listener for User-Report (materials taken out from store)
        const q = query(
            collection(db!, 'User-Report'),
            where('requesterId', '==', user.uid),
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as UserReportItem))
                .filter(d => d.status === 'accepted'); // Only show accepted (handed-out) items
            setMaterials(data);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching materials:', error);
            setLoading(false);
        });

        // Fetch transfer history
        const fetchTransfers = async () => {
            if (!db) return;
            const transfersRef = collection(db!, 'Material_transfers');
            const tq = query(transfersRef, where('senderId', '==', user.uid), orderBy('createdAt', 'desc'));
            const tSnapshot = await getDocs(tq);
            setTransfers(tSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as TransferRecord)));
        };
        fetchTransfers();

        return () => unsubscribe();
    }, [user]);

    // Handle User Search
    useEffect(() => {
        const searchUsers = async () => {
            if (!receiverName.trim() || receiverName.length < 2) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                const usersRef = collection(db!, 'users');
                const q = query(usersRef);
                const snapshot = await getDocs(q);
                
                const filtered = snapshot.docs
                    .map(uDoc => ({ id: uDoc.id, ...uDoc.data() }))
                    .filter((u: any) => 
                        (u.id !== user?.uid && u.email !== user?.email) && (
                            u.displayName?.toLowerCase().includes(receiverName.toLowerCase()) ||
                            u.email?.toLowerCase().includes(receiverName.toLowerCase())
                        )
                    )
                    .slice(0, 5); // Limit results

                setSearchResults(filtered);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setIsSearching(false);
            }
        };

        const timeoutId = setTimeout(searchUsers, 300);
        return () => clearTimeout(timeoutId);
    }, [receiverName]);

    const handleSelectUser = (u: any) => {
        setReceiverName(u.displayName || '');
        setReceiverEmail(u.email || '');
        setShowResults(false);
    };

    const toggleMaterial = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const selectedMaterials = materials.filter(m => selectedIds.has(m.id));

    const handleSubmit = async () => {
        if (!user || !db || selectedMaterials.length === 0 || !receiverName || !receiverEmail) return;
        setSubmitting(true);

        try {
            const transferMaterials = selectedMaterials.map(m => ({
                name: m.materialName,
                materialCode: m.materialCode,
                quantity: m.quantity,
                unit: m.unit,
                materialType: m.materialType,
                condition: m.condition,
                image: m.image || '',
                userReportId: m.id,
            }));

            await addDoc(collection(db!, 'Material_transfers'), {
                senderId: user.uid,
                senderName: userName || user.displayName || 'Unknown',
                senderEmail: user.email,
                receiverName: receiverName.trim(),
                receiverEmail: receiverEmail.trim().toLowerCase(),
                receiverId: null,
                materials: transferMaterials,
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

            // Refresh transfers
            const transfersRef = collection(db!, 'Material_transfers');
            const tq = query(transfersRef, where('senderId', '==', user.uid), orderBy('createdAt', 'desc'));
            const tSnapshot = await getDocs(tq);
            setTransfers(tSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as TransferRecord)));

            setTimeout(() => setSubmitted(false), 4000);
        } catch (error) {
            console.error('Error submitting transfer:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending_receiver': return { label: t('pending_receiver_approval') || 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: FiClock };
            case 'approved_by_receiver': return { label: t('approved_by_receiver_label') || 'Approved', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: FiCheckCircle };
            case 'rejected_by_receiver': return { label: t('rejected_by_receiver_label') || 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', icon: FiXCircle };
            case 'completed': return { label: t('completed_label') || 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FiCheckCircle };
            default: return { label: status, color: 'bg-slate-50 text-slate-700 border-slate-200', icon: FiClock };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 min-h-screen bg-slate-50">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4"
                >
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto" />
                    <p className="text-slate-500 text-sm font-semibold tracking-wide">{t('loading')}</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                            <FiRotateCcw className="text-2xl text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                {t('return_goods') || "Transfer Goods"}
                            </h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">
                                {t('select_materials') || "Select materials from your inventory to transfer to someone else."}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Success Banner */}
                <AnimatePresence>
                    {submitted && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.98 }}
                            className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-4"
                        >
                            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                                <FiCheckCircle className="text-xl" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-emerald-900">{t('transfer_submitted') || "Transfer Submitted"}</h3>
                                <p className="text-sm text-emerald-700 mt-0.5">{t('transfer_submitted_desc') || "The receiver will be notified to approve the transfer."}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: My Materials */}
                    <div className="lg:col-span-7 space-y-6">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full"
                        >
                            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                        <FiPackage className="text-lg" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">{t('my_materials') || "My Inventory"}</h2>
                                        <p className="text-xs text-slate-500">{materials.length} {t('items_label') || "Items"}</p>
                                    </div>
                                </div>
                                <AnimatePresence>
                                    {selectedIds.size > 0 && (
                                        <motion.span
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.9, opacity: 0 }}
                                            className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-sm font-semibold"
                                        >
                                            {selectedIds.size} Selected
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>

                            {materials.length === 0 ? (
                                <div className="p-12 text-center flex-1 flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                        <FiBox className="text-2xl text-slate-300" />
                                    </div>
                                    <h3 className="font-semibold text-slate-900 text-lg">{t('no_materials_found') || "Empty Inventory"}</h3>
                                    <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                                        {t('no_materials_desc') || "You don't have any materials assigned to you right now."}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar p-2">
                                    <AnimatePresence>
                                        {materials.map((mat, index) => {
                                            const isSelected = selectedIds.has(mat.id);
                                            const isFixed = mat.materialType === 'fixed_asset' || mat.materialType === 'fixed';
                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    key={mat.id}
                                                    onClick={() => toggleMaterial(mat.id)}
                                                    className={`p-4 m-2 rounded-xl flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer transition-all border ${isSelected
                                                        ? 'bg-blue-50/50 border-blue-200'
                                                        : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}
                                                >
                                                    {/* Checkbox & Image container */}
                                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected
                                                            ? 'bg-blue-600 border-blue-600 text-white'
                                                            : 'border border-slate-300 bg-white'}`}>
                                                            {isSelected && <FiCheckSquare className="text-xs" />}
                                                        </div>

                                                        <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0 border border-slate-200">
                                                            {mat.image ? (
                                                                <img src={mat.image} alt={mat.materialName} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <FiBox className="text-xl text-slate-300" />
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0 sm:hidden">
                                                            <h3 className="font-semibold text-slate-900 text-sm truncate">{mat.materialName}</h3>
                                                            <p className="text-xs text-slate-500 mt-0.5">{mat.quantity} {mat.unit}</p>
                                                        </div>
                                                    </div>

                                                    {/* Details for larger screens */}
                                                    <div className="flex-1 min-w-0 hidden sm:block">
                                                        <h3 className="font-semibold text-slate-900 text-sm truncate">{mat.materialName}</h3>
                                                        <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-600">
                                                                <FiTag className="text-[10px] text-slate-400" /> {mat.materialCode}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide border ${isFixed ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-cyan-50 border-cyan-100 text-cyan-700'}`}>
                                                                {mat.materialType.replace(/_/g, ' ')}
                                                            </span>
                                                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-xs font-semibold">
                                                                {mat.quantity} {mat.unit}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Right Column: Transfer Form */}
                    <div className="lg:col-span-5 space-y-8">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                        <FiSend className="text-lg" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">{t('transfer_to') || "Transfer Materials"}</h2>
                                        <p className="text-xs text-slate-500">{t('enter_receiver_name') || "Enter recipient details"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Selected indicator */}
                                <AnimatePresence>
                                    {selectedMaterials.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="bg-blue-50/50 rounded-xl p-4 border border-blue-100"
                                        >
                                            <p className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wide">Items Ready</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedMaterials.map((item) => (
                                                    <span key={item.id} className="px-2 py-1 bg-white rounded-md text-xs text-blue-700 border border-blue-200 flex items-center gap-1 shadow-sm">
                                                        <FiBox className="text-[10px]" />
                                                        {item.materialName} ({item.quantity})
                                                    </span>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-4">
                                    <div className="space-y-1.5 relative">
                                        <label className="text-sm font-semibold text-slate-700">
                                            {t('receiver_name') || "Receiver Name"}
                                        </label>
                                        <div className="relative">
                                            <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={receiverName}
                                                onChange={(e) => {
                                                    setReceiverName(e.target.value);
                                                    setShowResults(true);
                                                }}
                                                onFocus={() => setShowResults(true)}
                                                placeholder={t('search_user_placeholder') || "Search user by name or email..."}
                                                className="w-full pl-10 pr-4 py-2.5 bg-blue-50/50 border-2 border-blue-100 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm font-bold text-slate-800 placeholder:text-slate-400"
                                            />
                                            {isSearching && (
                                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                                </div>
                                            )}

                                            {/* Search Results Dropdown */}
                                            <AnimatePresence>
                                                {showResults && (receiverName.length >= 2) && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 10 }}
                                                        className="absolute z-[60] left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-blue-500/10 overflow-hidden"
                                                    >
                                                        {searchResults.length > 0 ? (
                                                            <div className="p-2">
                                                                {searchResults.map((u) => (
                                                                    <button
                                                                        key={u.id}
                                                                        onClick={() => handleSelectUser(u)}
                                                                        className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 rounded-xl transition-colors text-left group"
                                                                    >
                                                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                                            <FiUser />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-sm font-bold text-slate-900 truncate">{u.displayName}</p>
                                                                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                                                                        </div>
                                                                        <UserCheck className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ) : !isSearching ? (
                                                            <div className="p-8 text-center">
                                                                <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No users found</p>
                                                            </div>
                                                        ) : null}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-slate-700">
                                            {t('receiver_email') || "Receiver Email"}
                                        </label>
                                        <div className="relative">
                                            <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="email"
                                                value={receiverEmail}
                                                onChange={(e) => setReceiverEmail(e.target.value)}
                                                placeholder="e.g. john@example.com"
                                                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-sm font-semibold text-slate-700">
                                            {t('transfer_reason') || "Transfer Reason"} <span className="text-slate-400 font-normal">(Optional)</span>
                                        </label>
                                        <div className="relative">
                                            <textarea
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                placeholder="Why are these items being transferred?"
                                                rows={3}
                                                className="w-full px-4 py-2.5 bg-white rounded-lg border border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting || selectedMaterials.length === 0 || !receiverName || !receiverEmail}
                                    className={`w-full py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${submitting || selectedMaterials.length === 0 || !receiverName || !receiverEmail
                                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                        }`}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            {t('submitting_transfer') || "Processing..."}
                                        </>
                                    ) : (
                                        <>
                                            <FiSend className="text-sm" />
                                            {t('initiate_transfer') || "Initiate Transfer"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Transfer History */}
                <AnimatePresence>
                    {transfers.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-3 bg-slate-50/50">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                                    <FiClock className="text-lg" />
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900">{t('transfer_history') || "Past Initiated Transfers"}</h2>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {transfers.map((transfer, idx) => {
                                    const badge = getStatusBadge(transfer.status);
                                    const BadgeIcon = badge.icon;
                                    return (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: idx * 0.05 }}
                                            key={transfer.id}
                                            className="p-5 hover:bg-slate-50/50 transition-colors"
                                        >
                                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                                <div className="flex-1 w-full flex flex-col md:flex-row gap-4">
                                                    <div className="flex flex-col gap-1 min-w-[200px]">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs text-slate-500">To:</span>
                                                            <span className="font-semibold text-slate-900 text-sm">{transfer.receiverName}</span>
                                                        </div>
                                                        <span className="text-xs text-slate-500">{transfer.receiverEmail}</span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        {transfer.materials?.map((item: any, i: number) => (
                                                            <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 shadow-sm flex items-center gap-1">
                                                                <FiBox className="text-[10px] text-slate-400" />
                                                                {item.name} <span className="text-slate-400">×{item.quantity}</span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 w-full md:w-auto border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${badge.color}`}>
                                                        <BadgeIcon className="text-[10px]" /> {badge.label}
                                                    </span>
                                                    <span className="text-xs text-slate-500">
                                                        {transfer.updatedAt?.seconds
                                                            ? new Date(transfer.updatedAt.seconds * 1000).toLocaleDateString()
                                                            : 'Recently'}
                                                    </span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
