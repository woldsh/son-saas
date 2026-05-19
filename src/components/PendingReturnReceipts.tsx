'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDocs
} from 'firebase/firestore';
import { FiInbox, FiCheck, FiX, FiClock } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

export default function PendingReturnReceipts() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [transfers, setTransfers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !user.email || !db) {
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, 'Material_transfers'),
            where('receiverEmail', '==', user.email.toLowerCase()),
            where('status', '==', 'pending_receiver')
        );

        const unsub = onSnapshot(q, (snap) => {
            setTransfers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    const handleAction = async (transferId: string, action: 'approve' | 'reject') => {
        if (!db || !user) return;
        try {
            const status = action === 'approve' ? 'approved_by_receiver' : 'rejected_by_receiver';
            
            await updateDoc(doc(db, 'Material_transfers', transferId), {
                status,
                receiverId: user.uid,
                updatedAt: serverTimestamp(),
                ...(action === 'approve' ? { approvedByReceiverAt: serverTimestamp() } : { rejectedByReceiverAt: serverTimestamp() })
            });

            if (action === 'approve') {
                // When receiver approves, in the new workflow, this transfer might go to PTL
                // or just stay as approved_by_receiver until the formal Transfer Order is made.
                // For now, we just update the status so the sender knows it was accepted.
            } else {
                // If rejected, revert User-Report status from 'transferring' back to 'accepted'
                const transferDoc = transfers.find(t => t.id === transferId);
                if (transferDoc && transferDoc.materials) {
                    for (const mat of transferDoc.materials) {
                        if (mat.userReportId) {
                            await updateDoc(doc(db, 'User-Report', mat.userReportId), {
                                status: 'accepted',
                                updatedAt: serverTimestamp()
                            });
                        }
                    }
                }
            }

        } catch (e) {
            console.error(`Error ${action}ing transfer:`, e);
        }
    };

    if (loading) return null;
    if (transfers.length === 0) return null;

    return (
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700">
                    <FiInbox className="text-xl" />
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-slate-900">{t('incoming_transfers') || 'Incoming Transfer Requests'}</h2>
                    <p className="text-sm text-slate-600">You have materials being transferred to you. Please approve or reject them.</p>
                </div>
                <span className="px-4 py-2 bg-blue-200 text-blue-900 rounded-full text-sm font-bold">{transfers.length}</span>
            </motion.div>

            <AnimatePresence>
                {transfers.map((transfer, idx) => (
                    <motion.div key={transfer.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                        
                        <div className="flex flex-col md:flex-row gap-4 justify-between md:items-center">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <span className="font-bold text-slate-900">{transfer.senderName}</span> is transferring items to you
                                </div>
                                {transfer.reason && (
                                    <p className="text-sm text-slate-600 italic">"{transfer.reason}"</p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {transfer.materials?.map((m: any, i: number) => (
                                        <span key={i} className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 font-medium">
                                            {m.name} ×{m.quantity}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                                <button
                                    onClick={() => handleAction(transfer.id, 'reject')}
                                    className="flex-1 md:flex-none px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <FiX /> Reject
                                </button>
                                <button
                                    onClick={() => handleAction(transfer.id, 'approve')}
                                    className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                                >
                                    <FiCheck /> Accept Items
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
