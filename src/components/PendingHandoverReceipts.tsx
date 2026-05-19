'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import {
    collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { FiInbox, FiClock, FiCheck } from 'react-icons/fi';
import { Loader2, Printer, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HandoverReceiptForm from '@/components/HandoverReceiptForm';

interface TransferOrder {
    id: string;
    recipientId: string;
    recipientName: string;
    recipientEmail: string;
    recipientRole: string;
    newPosition: string;
    itemReceiverName: string;
    itemReceiverId: string;
    overseerName: string;
    refNumber: string;
    date: string;
    ccName: string;
    status: string;
    createdBy: string;
    createdByName: string;
    createdAt: any;
    receiverAcknowledged?: boolean;
    receiverAcknowledgedAt?: any;
    items?: any[];
    completedAt?: any;
    receiverSignatureData?: string;
    delivererSignatureData?: string;
    overseerAcknowledged?: boolean;
    overseerAcknowledgedAt?: any;
    overseerSignatureData?: string;
}

export default function PendingHandoverReceipts() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [orders, setOrders] = useState<TransferOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [currentSignature, setCurrentSignature] = useState<string | null>(null);

    useEffect(() => {
        if (!user || !db) { setLoading(false); return; }

        const q = query(
            collection(db!, 'Transfer_Orders'),
            where('itemReceiverId', '==', user.uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as TransferOrder))
                // Filter locally for orders the receiver hasn't acknowledged yet
                .filter(o => !o.receiverAcknowledged);

            setOrders(data);
            if (data.length === 1) setExpandedOrderId(data[0].id);
            setLoading(false);
            setCurrentSignature(null);
        }, () => setLoading(false));

        return () => unsub();
    }, [user]);

    const handleAcknowledge = async (orderId: string, signatureData: string) => {
        if (!db) return;
        try {
            await updateDoc(doc(db!, 'Transfer_Orders', orderId), {
                receiverAcknowledged: true,
                receiverAcknowledgedAt: serverTimestamp(),
                receiverSignatureData: signatureData
            });
            // Update local state
            setOrders(prev => prev.map(o => 
                o.id === orderId 
                    ? { ...o, receiverAcknowledged: true, receiverAcknowledgedAt: { seconds: Date.now() / 1000 }, receiverSignatureData: signatureData } 
                    : o
            ));
            setCurrentSignature(null);
        } catch (e) {
            console.error('Error acknowledging receipt:', e);
            throw e;
        }
    };

    if (loading) return null;
    if (orders.length === 0) return null;

    return (
        <div className="space-y-6">
            {/* Section header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 flex items-center gap-4 print:hidden"
            >
                <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
                    <FiInbox className="text-xl" />
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-slate-900">
                        Pending Property Handover Receipts
                    </h2>
                    <p className="text-sm text-slate-600">
                        You have incoming property handovers assigned to you. Please review and acknowledge the receipts.
                    </p>
                </div>
                <span className="px-4 py-2 bg-emerald-200 text-emerald-900 rounded-full text-sm font-bold">
                    {orders.length}
                </span>
            </motion.div>

            <AnimatePresence>
                {orders.map((order, idx) => {
                    const isExpanded = expandedOrderId === order.id;

                    return (
                        <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                        >
                            {/* Collapsed header */}
                            <button
                                onClick={() => {
                                    setExpandedOrderId(isExpanded ? null : order.id);
                                    setCurrentSignature(null);
                                }}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors print:hidden"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                                        {order.recipientName?.charAt(0)?.toUpperCase() || 'H'}
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-slate-900 text-sm">Handover from {order.recipientName}</p>
                                        <p className="text-xs text-slate-500">Ref: {order.refNumber || '—'} • {order.date || '—'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded text-xs font-semibold flex items-center gap-1">
                                        <FiClock className="text-[10px]" /> Action Required
                                    </span>
                                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                                </div>
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                                <div className="border-t border-slate-200">
                                    <div className="flex items-center gap-3 px-6 py-3 bg-slate-50 border-b border-slate-200 print:hidden justify-end">
                                        <button
                                            onClick={() => window.print()}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all shadow-sm"
                                        >
                                            <Printer className="w-4 h-4" /> Print
                                        </button>
                                    </div>

                                    {/* A4 PAPER - Receipt Form */}
                                    <div className="w-full overflow-x-auto bg-slate-100 print:bg-white custom-scrollbar">
                                        <div className="flex justify-center py-8 px-4 min-w-[210mm] print:py-0 print:px-0">
                                            <HandoverReceiptForm
                                                recipientName={order.recipientName}
                                                itemReceiverName={order.itemReceiverName}
                                                overseerName={order.overseerName}
                                                recipientRole={order.recipientRole}
                                                items={order.items || []}
                                                delivererSigned={order.status === 'completed' || order.status === 'pending_receipt' || order.completedAt != null}
                                                delivererSignatureDate={order.completedAt}
                                                delivererSignatureData={order.delivererSignatureData}
                                                receiverSigned={!!order.receiverAcknowledged}
                                                receiverSignatureDate={order.receiverAcknowledgedAt}
                                                receiverSignatureData={order.receiverSignatureData}
                                                overseerSigned={!!order.overseerAcknowledged}
                                                overseerSignatureDate={order.overseerAcknowledgedAt}
                                                overseerSignatureData={order.overseerSignatureData}
                                                interactiveRole={!order.receiverAcknowledged ? "receiver" : undefined}
                                                onSignatureChange={setCurrentSignature}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Inline Action Area */}
                                    {!order.receiverAcknowledged ? (
                                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col items-center justify-center print:hidden">
                                            {!currentSignature ? (
                                                <div className="flex flex-col items-center gap-2 text-slate-500 animate-pulse">
                                                    <span className="text-xl">✍️</span>
                                                    <p className="text-sm font-semibold">Please sign on the dotted line above...</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={async () => await handleAcknowledge(order.id, currentSignature)}
                                                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-sm active:scale-95"
                                                >
                                                    <FiCheck className="text-xl" /> Confirm & Receive Material
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center py-4 bg-emerald-50 print:hidden">
                                            <div className="flex items-center gap-2 text-emerald-700 font-bold">
                                                <FiCheck className="text-xl" />
                                                <span>Successfully Received & Signed</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
            
            <style jsx global>{`
                @media print {
                    body { background: white !important; padding: 0 !important; margin: 0 !important; }
                    body * { visibility: hidden; }
                    .handover-receipt-print-area, .handover-receipt-print-area * { visibility: visible; }
                    .handover-receipt-print-area {
                        position: absolute; left: 0; top: 0; width: 100% !important;
                        padding: 20mm !important; box-shadow: none !important; border: none !important;
                    }
                    @page { size: A4; margin: 0; }
                }
            `}</style>
        </div>
    );
}
