'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, getDocs, updateDoc, doc, serverTimestamp, orderBy
} from 'firebase/firestore';
import {
    FiDownloadCloud, FiCheckCircle, FiXCircle, FiClock, FiUser,
    FiMail, FiBox, FiArrowRight, FiPackage, FiFileText
} from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TransferRecord {
    id: string;
    senderId: string;
    senderName: string;
    senderEmail: string;
    receiverName: string;
    receiverEmail: string;
    receiverId: string | null;
    materials: any[];
    status: string;
    reason: string;
    createdAt: any;
    updatedAt: any;
}

export default function ReceiveGoodsPage() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [pendingTransfers, setPendingTransfers] = useState<TransferRecord[]>([]);
    const [historyTransfers, setHistoryTransfers] = useState<TransferRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        const fetchTransfers = async () => {
            if (!user || !db) return;

            try {
                const email = user.email?.toLowerCase() || '';

                const transfersRef = collection(db, 'Material_transfers');

                // Fetch pending transfers for this user
                const pendingQuery = query(
                    transfersRef,
                    where('receiverEmail', '==', email),
                    where('status', '==', 'pending_receiver')
                );
                const pendingSnapshot = await getDocs(pendingQuery);
                setPendingTransfers(pendingSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as TransferRecord)));

                // Fetch transfer history (approved/rejected)
                const historyQuery = query(
                    transfersRef,
                    where('receiverEmail', '==', email),
                    orderBy('createdAt', 'desc')
                );
                const historySnapshot = await getDocs(historyQuery);
                const allTransfers = historySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as TransferRecord));
                setHistoryTransfers(allTransfers.filter(t => t.status !== 'pending_receiver'));

            } catch (error) {
                console.error('Error fetching transfers:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTransfers();
    }, [user]);

    const handleApprove = async (transferId: string) => {
        if (!user || !db) return;
        setProcessingId(transferId);

        try {
            const transferRef = doc(db, 'Material_transfers', transferId);
            await updateDoc(transferRef, {
                status: 'approved_by_receiver',
                receiverId: user.uid,
                approvedByReceiverAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            // Move from pending to history
            const transfer = pendingTransfers.find(t => t.id === transferId);
            if (transfer) {
                setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
                setHistoryTransfers(prev => [{ ...transfer, status: 'approved_by_receiver', updatedAt: { seconds: Date.now() / 1000 } }, ...prev]);
            }
        } catch (error) {
            console.error('Error approving transfer:', error);
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (transferId: string) => {
        if (!user || !db) return;
        setProcessingId(transferId);

        try {
            const transferRef = doc(db, 'Material_transfers', transferId);
            await updateDoc(transferRef, {
                status: 'rejected_by_receiver',
                receiverId: user.uid,
                updatedAt: serverTimestamp(),
            });

            const transfer = pendingTransfers.find(t => t.id === transferId);
            if (transfer) {
                setPendingTransfers(prev => prev.filter(t => t.id !== transferId));
                setHistoryTransfers(prev => [{ ...transfer, status: 'rejected_by_receiver', updatedAt: { seconds: Date.now() / 1000 } }, ...prev]);
            }
        } catch (error) {
            console.error('Error rejecting transfer:', error);
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved_by_receiver': return { label: t('transfer_approved') || 'Approved', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: FiCheckCircle };
            case 'rejected_by_receiver': return { label: t('transfer_rejected') || 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', icon: FiXCircle };
            case 'completed': return { label: t('transfer_completed') || 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: FiCheckCircle };
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
                            <FiDownloadCloud className="text-2xl text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">
                                {t('receive_goods') || "Receive Goods"}
                            </h1>
                            <p className="text-sm font-medium text-slate-500 mt-1">
                                {t('incoming_transfers') || "Manage materials transferred to your account"}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Pending Transfers Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                    <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                <FiClock className="text-lg" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">{t('pending_transfers') || "Pending Transfers"}</h2>
                                <p className="text-xs text-slate-500">{pendingTransfers.length} {t('items_label') || "Items"}</p>
                            </div>
                        </div>
                        {pendingTransfers.length > 0 && (
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-semibold">
                                Action Required
                            </span>
                        )}
                    </div>

                    {pendingTransfers.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                <FiCheckCircle className="text-2xl text-slate-300" />
                            </div>
                            <h3 className="font-semibold text-slate-900 text-lg">{t('no_incoming_transfers') || "All caught up!"}</h3>
                            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                                {t('no_incoming_desc') || "You have no pending material transfers to review at this time."}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            <AnimatePresence>
                                {pendingTransfers.map((transfer, index) => (
                                    <motion.div 
                                        key={transfer.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="p-6 hover:bg-slate-50/50 transition-colors"
                                    >
                                        <div className="flex flex-col md:flex-row items-start gap-6">
                                            {/* Sender Info - Simple Box */}
                                            <div className="flex items-start gap-4 min-w-[220px]">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0 text-slate-600 font-bold text-sm">
                                                    {transfer.senderName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900 text-sm">{transfer.senderName}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{transfer.senderEmail}</p>
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        {transfer.createdAt?.seconds ? new Date(transfer.createdAt.seconds * 1000).toLocaleDateString() : 'Recently'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Transfer Details */}
                                            <div className="flex-1 min-w-0 w-full space-y-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {transfer.materials?.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm text-slate-700 shadow-sm">
                                                            <FiBox className="text-slate-400 text-xs" />
                                                            <span className="font-medium">{item.name} {item.model ? `(${item.model})` : ''}</span>
                                                            <span className="text-slate-400 text-xs px-1">×{item.quantity}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {transfer.reason && (
                                                    <div className="flex items-start gap-2 bg-slate-50 rounded-lg p-3 border border-slate-100">
                                                        <FiFileText className="text-sm text-slate-400 mt-0.5" />
                                                        <p className="text-sm text-slate-600">"{transfer.reason}"</p>
                                                    </div>
                                                )}

                                                {/* Action Buttons */}
                                                <div className="flex flex-wrap items-center gap-3 pt-2">
                                                    <button
                                                        onClick={() => handleApprove(transfer.id)}
                                                        disabled={processingId === transfer.id}
                                                        className={`px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${processingId === transfer.id
                                                                ? 'bg-blue-400 text-white cursor-not-allowed'
                                                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                                            }`}
                                                    >
                                                        {processingId === transfer.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <FiCheckCircle className="text-sm" />
                                                        )}
                                                        {t('approve_transfer') || "Accep Transfer"}
                                                    </button>
                                                    
                                                    <button
                                                        onClick={() => handleReject(transfer.id)}
                                                        disabled={processingId === transfer.id}
                                                        className={`px-6 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${processingId === transfer.id
                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 shadow-sm'
                                                            }`}
                                                    >
                                                        {processingId === transfer.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <FiXCircle className="text-sm" />
                                                        )}
                                                        {t('reject_transfer') || "Reject"}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </motion.div>

                {/* History Section */}
                <AnimatePresence>
                    {historyTransfers.length > 0 && (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                                        <FiPackage className="text-lg" />
                                    </div>
                                    <h2 className="text-lg font-semibold text-slate-900">{t('transfer_history') || "History Logs"}</h2>
                                </div>
                            </div>

                            <div className="divide-y divide-slate-100">
                                {historyTransfers.map((transfer, idx) => {
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
                                                    {/* Sender Basic */}
                                                    <div className="flex items-center gap-3 min-w-[200px]">
                                                        <span className="font-semibold text-slate-900 text-sm">{transfer.senderName}</span>
                                                        <FiArrowRight className="text-slate-400 text-sm" />
                                                        <span className="text-sm text-slate-500">You</span>
                                                    </div>
                                                    
                                                    {/* Items Basic */}
                                                    <div className="flex flex-wrap gap-2">
                                                        {transfer.materials?.map((item: any, i: number) => (
                                                            <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600 shadow-sm">
                                                                {item.name} <span className="text-slate-400 ml-1">×{item.quantity}</span>
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
                                                            ? new Date(transfer.updatedAt.seconds * 1000).toLocaleString()
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
